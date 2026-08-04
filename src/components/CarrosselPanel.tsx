import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Download, Images, Loader2, RefreshCw } from "lucide-react";
import { toPng } from "html-to-image";
import { CarrosselSlide } from "@/components/CarrosselSlide";
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

  const template = parseTemplate(perfilTemplateRaw);
  const slides = mergeSlides(carrossel);

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
    const { data, error } = await supabase.functions.invoke("carrossel-agent", {
      body: { pauta_id: pautaId },
    });
    setGerando(false);
    if (error || (data && (data as { ok?: boolean }).ok === false)) {
      const msg =
        (data as { error?: string } | null)?.error ?? error?.message ?? "Falha ao gerar carrossel";
      toast.error(msg);
      await load();
      return;
    }
    const row = await load();
    toast.success(`Carrossel pronto com ${mergeSlides(row).length} slides.`);
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
            <Button variant="outline" size="sm" onClick={baixarTodos}>
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
          Configure arroba, foto e cores em <strong>Perfis → Template do carrossel</strong> para os
          slides saírem com a identidade certa.
        </p>
      )}

      {carrossel?.status === "erro" && (
        <p className="text-sm text-destructive mb-4">{carrossel.erro}</p>
      )}

      {loading ? (
        <p className="text-sm text-muted-foreground italic">Carregando...</p>
      ) : slides.length === 0 ? (
        <p className="text-sm text-muted-foreground italic">
          Nenhum carrossel gerado. A copy adapta o roteiro aprovado em slides e o visual define a
          ênfase de cada um.
        </p>
      ) : (
        <>
          {carrossel?.visual?.observacao_geral && (
            <p className="text-sm text-muted-foreground mb-4">
              {carrossel.visual.observacao_geral}
            </p>
          )}
          <div className="flex gap-4 overflow-x-auto pb-3">
            {slides.map((s, i) => (
              <div key={i} className="shrink-0">
                <div className="flex items-center justify-between mb-2 gap-2">
                  <Badge variant="outline" className="text-[10px] font-mono uppercase">
                    {s.tipo || `slide ${i + 1}`}
                  </Badge>
                  <button
                    onClick={() => baixar(i)}
                    className="text-xs text-muted-foreground hover:text-foreground"
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
                  scale={0.3}
                />
              </div>
            ))}
          </div>
          {carrossel?.copy?.legenda_sugerida && (
            <div className="mt-4">
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
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
