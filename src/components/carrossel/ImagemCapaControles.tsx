import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
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
  const temImagem = Boolean(carrossel.imagem_capa_path);
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
              disabled={enviando}
            >
              {enviando ? (
                <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              ) : (
                <Upload className="w-4 h-4 mr-1.5" />
              )}
              {enviando ? "Enviando…" : temImagem ? "Trocar imagem" : "Enviar imagem"}
            </Button>
            {temImagem && (
              <Button size="sm" variant="ghost" onClick={remover} disabled={removendo}>
                <Trash2 className="w-4 h-4 mr-1.5" /> Remover
              </Button>
            )}
          </div>

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
