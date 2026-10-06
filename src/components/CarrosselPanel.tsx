import { useEffect, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { gerarCarrossel } from "@/lib/agentes.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Images, Loader2, RefreshCw } from "lucide-react";
import { toPng } from "html-to-image";
import { CarrosselSlide } from "@/components/CarrosselSlide";
import { useFontesCarrossel } from "@/hooks/use-fontes-carrossel";
import {
  fotoAsDataUrl,
  mergeSlides,
  parseTemplate,
  type CarrosselRow,
} from "@/lib/carrossel-template";

export function CarrosselPanel({
  pautaId,
  perfilTemplateRaw,
}: {
  pautaId: string;
  perfilTemplateRaw: unknown;
}) {
  const [carrossel, setCarrossel] = useState<CarrosselRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [gerando, setGerando] = useState(false);
  const [fotoDataUrl, setFotoDataUrl] = useState("");
  const slideRefs = useRef<Array<HTMLDivElement | null>>([]);
  const solicitarCarrossel = useServerFn(gerarCarrossel);

  const template = parseTemplate(perfilTemplateRaw);
  const slides = mergeSlides(carrossel);
  // A exportação só sai na fonte certa com o CSS embutido (ver carrossel-fontes).
  const fontes = useFontesCarrossel(template.fonte_titulo, template.fonte_texto);

  async function load() {
    const { data } = await supabase
      .from("carrosseis")
      .select("id, status, erro, copy, visual")
      .eq("pauta_id", pautaId)
      .maybeSingle();
    setCarrossel((data as CarrosselRow | null) ?? null);
    setLoading(false);
    return data as CarrosselRow | null;
  }

  useEffect(() => {
    load();
    fotoAsDataUrl(template.foto_path).then(setFotoDataUrl);
  }, [pautaId, template.foto_path]);

  async function gerar() {
    setGerando(true);
    try {
      await solicitarCarrossel({ data: { pautaId } });
      const row = await load();
      toast.success(`Carrossel pronto com ${mergeSlides(row).length} slides.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao gerar carrossel");
      await load();
    } finally {
      setGerando(false);
    }
  }

  async function baixar(index: number) {
    const node = slideRefs.current[index];
    if (!node) return;
    try {
      const dataUrl = await toPng(node, {
        width: 1080,
        height: 1350,
        pixelRatio: 1,
        style: { transform: "none" },
        fontEmbedCSS: fontes.css,
      });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = `carrossel-${pautaId.slice(0, 8)}-slide-${index + 1}.png`;
      a.click();
    } catch {
      toast.error("Não foi possível exportar este slide.");
    }
  }

  async function baixarTodos() {
    for (let i = 0; i < slides.length; i++) {
      await baixar(i);
      await new Promise((r) => setTimeout(r, 350));
    }
  }

  const templateIncompleto = !template.arroba && !template.nome_exibicao;

  return (
    <Card className="p-6 bg-surface border-border mt-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Carrossel
        </h2>
        <div className="flex flex-wrap gap-2">
          {slides.length > 0 && (
            <Button variant="outline" size="sm" onClick={baixarTodos} disabled={!fontes.pronto}>
              <Download className="w-4 h-4 mr-2" /> Baixar todos
            </Button>
          )}
          <Button size="sm" onClick={gerar} disabled={gerando}>
            {gerando ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" /> Gerando...
              </>
            ) : slides.length > 0 ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2" /> Regerar
              </>
            ) : (
              <>
                <Images className="w-4 h-4 mr-2" /> Gerar carrossel
              </>
            )}
          </Button>
        </div>
      </div>

      {templateIncompleto && (
        <p className="text-xs text-muted-foreground mb-4">
          Configure modelo, arroba, foto, cores e fontes em{" "}
          <Link
            to="/configuracoes"
            search={{ aba: "carrossel" }}
            className="font-semibold underline underline-offset-2"
          >
            Configurações → Carrossel
          </Link>{" "}
          para os slides saírem com a identidade certa.
        </p>
      )}

      {carrossel?.status === "erro" && (
        <p className="text-sm text-destructive mb-4">{carrossel.erro}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground italic">Carregando...</p>
      ) : slides.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Nenhum carrossel gerado. A prevIA parte da tese do roteiro e escreve um carrossel próprio
          para leitura: capa que prende, uma ideia por slide e um fechamento que vale salvar.
        </p>
      ) : (
        <>
          {carrossel?.copy?.formato ? (
            <p className="text-sm text-muted-foreground mb-4">
              <span className="font-medium text-foreground">{carrossel.copy.formato}.</span>{" "}
              {carrossel.copy.estrategia}
            </p>
          ) : (
            carrossel?.visual?.observacao_geral && (
              <p className="text-sm text-muted-foreground mb-4">
                {carrossel.visual.observacao_geral}
              </p>
            )
          )}
          <div className="flex gap-4 overflow-x-auto pb-3">
            {slides.map((s, i) => (
              <div key={i} className="shrink-0">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Badge variant="outline" className="text-[11px] font-mono uppercase">
                    {s.tipo || `slide ${i + 1}`}
                  </Badge>
                  <button
                    onClick={() => baixar(i)}
                    disabled={!fontes.pronto}
                    className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    baixar
                  </button>
                </div>
                <CarrosselSlide
                  ref={(el) => {
                    slideRefs.current[i] = el;
                  }}
                  slide={s}
                  template={template}
                  fotoDataUrl={fotoDataUrl}
                  index={i}
                  total={slides.length}
                  scale={0.24}
                />
              </div>
            ))}
          </div>
          {carrossel?.copy?.legenda_sugerida && (
            <div className="mt-4">
              <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                Legenda sugerida
              </div>
              <p className="text-sm">{carrossel.copy.legenda_sugerida}</p>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
