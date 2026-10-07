import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useConta } from "@/hooks/use-conta";
import { gerarImagemCapa } from "@/lib/agentes.functions";
import { IMAGEM_BUCKET } from "@/lib/carrossel-template";
import { prepararImagem } from "@/lib/imagem";
import { mensagemErro } from "@/lib/mensagem-erro";
import { cn } from "@/lib/utils";

const ENQUADRAMENTOS = [
  { rotulo: "Alto", foco: 15 },
  { rotulo: "Centro", foco: 50 },
  { rotulo: "Baixo", foco: 85 },
] as const;

export type CarrosselComImagem = {
  id: string;
  conta_id?: string | null;
  imagem_capa_path?: string | null;
  imagem_capa_foco?: number | null;
};

/**
 * Imagem opcional da capa: enviar, enquadrar, trocar e remover. A imagem fica
 * em colunas próprias do carrossel, então continua ao "Regerar".
 */
export function ImagemCapaControles({
  carrossel,
  miniatura,
  onMudou,
}: {
  carrossel: CarrosselComImagem;
  /** Data URL já carregado pelo painel, para não baixar a imagem duas vezes. */
  miniatura: string;
  onMudou: (mudanca: Partial<CarrosselComImagem>) => void;
}) {
  const entrada = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [removendo, setRemovendo] = useState(false);
  const [pedindo, setPedindo] = useState(false);
  const [ideia, setIdeia] = useState("");
  const [gerando, setGerando] = useState(false);
  const gerarNoServidor = useServerFn(gerarImagemCapa);
  const queryClient = useQueryClient();
  const { data: conta } = useConta();
  const usadas = conta?.uso?.imagem ?? 0;
  const limite = Number(
    (conta?.plano as Record<string, unknown> | undefined)?.limite_imagens_mes ?? 0,
  );
  const semCota = limite > 0 && usadas >= limite;
  const temImagem = Boolean(carrossel.imagem_capa_path);
  const ocupado = enviando || gerando || removendo;
  const foco = carrossel.imagem_capa_foco ?? 50;

  async function enviar(arquivo: File) {
    if (!carrossel.conta_id) {
      toast.error("Não encontrei a conta deste carrossel. Recarregue a página.");
      return;
    }
    setEnviando(true);
    try {
      const imagem = await prepararImagem(arquivo);
      const caminho = `${carrossel.conta_id}/${carrossel.id}/${Date.now()}.jpg`;
      const { error: erroEnvio } = await supabase.storage
        .from(IMAGEM_BUCKET)
        .upload(caminho, imagem, { contentType: "image/jpeg" });
      if (erroEnvio) throw erroEnvio;

      const mudanca = {
        imagem_capa_path: caminho,
        imagem_capa_foco: 50,
        imagem_capa_origem: "envio" as const,
      };
      const { error } = await supabase.from("carrosseis").update(mudanca).eq("id", carrossel.id);
      if (error) {
        await supabase.storage.from(IMAGEM_BUCKET).remove([caminho]);
        throw error;
      }
      // A anterior não é mais usada por nenhum carrossel.
      if (carrossel.imagem_capa_path) {
        await supabase.storage.from(IMAGEM_BUCKET).remove([carrossel.imagem_capa_path]);
      }
      onMudou(mudanca);
      toast.success("Imagem na capa.");
    } catch (e) {
      toast.error(mensagemErro(e, "Não consegui colocar essa imagem."));
    } finally {
      setEnviando(false);
      if (entrada.current) entrada.current.value = "";
    }
  }

  async function enquadrar(novoFoco: number) {
    const anterior = foco;
    onMudou({ imagem_capa_foco: novoFoco });
    const { error } = await supabase
      .from("carrosseis")
      .update({ imagem_capa_foco: novoFoco })
      .eq("id", carrossel.id);
    if (error) {
      onMudou({ imagem_capa_foco: anterior });
      toast.error(mensagemErro(error, "Não consegui salvar o enquadramento."));
    }
  }

  async function remover() {
    if (!carrossel.imagem_capa_path) return;
    setRemovendo(true);
    const caminho = carrossel.imagem_capa_path;
    const { error } = await supabase
      .from("carrosseis")
      .update({ imagem_capa_path: null, imagem_capa_origem: null, imagem_capa_foco: 50 })
      .eq("id", carrossel.id);
    setRemovendo(false);
    if (error) {
      toast.error(mensagemErro(error, "Não consegui tirar a imagem."));
      return;
    }
    await supabase.storage.from(IMAGEM_BUCKET).remove([caminho]);
    onMudou({ imagem_capa_path: null, imagem_capa_foco: 50 });
    toast.success("Imagem removida da capa.");
  }

  async function gerar() {
    setGerando(true);
    try {
      const r = await gerarNoServidor({ data: { carrosselId: carrossel.id, ideia: ideia.trim() } });
      onMudou({ imagem_capa_path: r.caminho, imagem_capa_foco: 50 });
      setPedindo(false);
      setIdeia("");
      toast.success("Imagem gerada e colocada na capa.");
    } catch (e) {
      toast.error(mensagemErro(e, "Não consegui gerar a imagem. Tente de novo."));
    } finally {
      setGerando(false);
      // O consumo de imagens do mês mudou.
      queryClient.invalidateQueries({ queryKey: ["minha-conta"] });
    }
  }

  return (
    <section className="rounded-lg border border-border bg-background p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div
          className="grid h-24 w-[4.8rem] shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted"
          aria-hidden="true"
        >
          {temImagem && miniatura ? (
            <img
              src={miniatura}
              alt=""
              className="h-full w-full object-cover"
              style={{ objectPosition: `50% ${foco}%` }}
            />
          ) : (
            <ImagePlus className="h-5 w-5 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold">Imagem da capa</h3>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-[52ch]">
            {temImagem
              ? "Aparece só na capa e continua se você regerar o carrossel."
              : "Opcional. Uma foto na capa faz o post chamar mais atenção no feed. Os outros slides continuam só com texto."}
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              ref={entrada}
              type="file"
              accept="image/*"
              className="sr-only"
              aria-label="Escolher imagem para a capa"
              onChange={(e) => {
                const arquivo = e.target.files?.[0];
                if (arquivo) enviar(arquivo);
              }}
            />
            <Button
              size="sm"
              variant={temImagem ? "ghost" : "outline"}
              onClick={() => entrada.current?.click()}
              disabled={ocupado}
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-1.5" />
              )}
              {enviando ? "Enviando…" : temImagem ? "Trocar imagem" : "Enviar imagem"}
            </Button>
            {!pedindo && (
              <Button
                size="sm"
                variant={temImagem ? "ghost" : "outline"}
                onClick={() => setPedindo(true)}
                disabled={ocupado || semCota}
              >
                <span
                  aria-hidden="true"
                  className="mr-1.5 rounded bg-ai px-1 py-px text-[10px] font-bold leading-none text-ai-foreground"
                >
                  IA
                </span>
                {temImagem ? "Gerar outra com IA" : "Gerar com IA"}
              </Button>
            )}
            {temImagem && (
              <Button size="sm" variant="ghost" onClick={remover} disabled={ocupado}>
                <Trash2 className="w-4 h-4 mr-1.5" /> Remover
              </Button>
            )}
          </div>

          {limite > 0 && (
            <p className="mt-2 text-xs text-muted-foreground num">
              {semCota
                ? `Você usou as ${limite} imagens geradas do mês. Renova no dia 1; enviar uma imagem sua continua liberado.`
                : `${usadas} de ${limite} imagens geradas no mês. Enviar uma imagem sua não conta.`}
            </p>
          )}

          {pedindo && (
            <div className="mt-3 space-y-2 rounded-md border border-border bg-surface p-3">
              <label htmlFor={`ideia-${carrossel.id}`} className="text-sm font-medium">
                Quer algo específico? (opcional)
              </label>
              <Textarea
                id={`ideia-${carrossel.id}`}
                value={ideia}
                onChange={(e) => setIdeia(e.target.value)}
                maxLength={300}
                rows={2}
                disabled={gerando}
                placeholder="Ex.: uma senhora conferindo documentos na mesa da cozinha"
              />
              <p className="text-xs text-muted-foreground">
                Sem pedido, a prevIA cria uma foto a partir do tema. Sai sem texto na imagem, sem
                rostos em close e sem martelo ou balança.
              </p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" onClick={gerar} disabled={gerando}>
                  {gerando && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                  {gerando ? "Gerando imagem… (até 1 minuto)" : "Gerar imagem"}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setPedindo(false)}
                  disabled={gerando}
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}

          {temImagem && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span
                id={`enquadramento-${carrossel.id}`}
                className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
              >
                Enquadramento
              </span>
              <div
                role="radiogroup"
                aria-labelledby={`enquadramento-${carrossel.id}`}
                className="inline-flex rounded-md bg-muted p-0.5"
              >
                {ENQUADRAMENTOS.map((e) => {
                  const ativo = Math.abs(foco - e.foco) < 18;
                  return (
                    <button
                      key={e.rotulo}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      onClick={() => enquadrar(e.foco)}
                      className={cn(
                        "min-h-9 rounded px-3 text-xs font-medium transition-colors",
                        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                        ativo
                          ? "bg-surface text-foreground shadow-sm"
                          : "text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {e.rotulo}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
