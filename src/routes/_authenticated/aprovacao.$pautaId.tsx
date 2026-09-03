import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { CarrosselPanel } from "@/components/CarrosselPanel";
import { ArrowLeft, Check, X, Send, Copy } from "lucide-react";

function copyToClipboard(text: string, label = "Copiado") {
  navigator.clipboard.writeText(text).then(
    () => toast.success(label),
    () => toast.error("Não foi possível copiar"),
  );
}

function RawFallback({ data }: { data: unknown }) {
  return (
    <details className="mt-4 text-xs">
      <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
        Ver dados brutos
      </summary>
      <pre className="mt-2 p-3 bg-background/50 rounded border border-border whitespace-pre-wrap font-mono text-[11px] leading-relaxed">
        {JSON.stringify(data, null, 2)}
      </pre>
    </details>
  );
}

function RoteiroView({ conteudo }: { conteudo: any }) {
  if (!conteudo || typeof conteudo !== "object") return <RawFallback data={conteudo} />;

  // Novo formato: reel falado
  const gancho_falado = conteudo.gancho_falado ?? conteudo.gancho;
  const desenvolvimento_falado =
    conteudo.desenvolvimento_falado ??
    (typeof conteudo.corpo === "string" ? conteudo.corpo : null);
  const cta_falado = conteudo.cta_falado ?? conteudo.cta;
  const legenda = conteudo.legenda_sugerida;

  // Fallback p/ conteúdo antigo em slides
  const corpoSlides = Array.isArray(conteudo.corpo) ? conteudo.corpo : null;

  const hasShape = gancho_falado || desenvolvimento_falado || cta_falado || legenda || corpoSlides;
  if (!hasShape) return <RawFallback data={conteudo} />;

  const falaContinua = [gancho_falado, desenvolvimento_falado, cta_falado]
    .filter(Boolean)
    .join("\n\n");

  const textoPlano = [
    falaContinua && `ROTEIRO PARA GRAVAR:\n\n${falaContinua}`,
    corpoSlides &&
      corpoSlides
        .map((s: any, i: number) => `Slide ${i + 1}: ${typeof s === "string" ? s : JSON.stringify(s)}`)
        .join("\n\n"),
    legenda && `\nLegenda:\n${legenda}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return (
    <div className="space-y-5">
      {falaContinua && (
        <section>
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Roteiro para gravar
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => copyToClipboard(falaContinua, "Roteiro copiado")}
            >
              <Copy className="w-3 h-3 mr-1" /> Copiar fala
            </Button>
          </div>

          {gancho_falado && (
            <div className="mb-3 p-3 rounded border border-primary/40 bg-primary/5">
              <div className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">
                Gancho (0-3s)
              </div>
              <p className="text-base leading-snug font-medium">{gancho_falado}</p>
            </div>
          )}

          {desenvolvimento_falado && (
            <div className="mb-3 p-3 rounded border border-border/60 bg-background/40">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Desenvolvimento
              </div>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">{desenvolvimento_falado}</p>
            </div>
          )}

          {cta_falado && (
            <div className="p-3 rounded border border-border/60 bg-background/40">
              <div className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground mb-1">
                Fechamento (CTA)
              </div>
              <p className="text-sm leading-relaxed">{cta_falado}</p>
            </div>
          )}
        </section>
      )}

      {corpoSlides && (
        <section>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
            Corpo (formato antigo em slides)
          </div>
          <ol className="space-y-2">
            {corpoSlides.map((slide: any, i: number) => (
              <li key={i} className="p-3 bg-background/40 rounded border border-border/60">
                <div className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">
                  Slide {i + 1}
                </div>
                <div className="text-sm leading-relaxed whitespace-pre-wrap">
                  {typeof slide === "string" ? slide : JSON.stringify(slide, null, 2)}
                </div>
              </li>
            ))}
          </ol>
        </section>
      )}

      {legenda && (
        <section>
          <div className="flex items-center justify-between mb-1.5">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
              Legenda sugerida
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-xs"
              onClick={() => copyToClipboard(legenda, "Legenda copiada")}
            >
              <Copy className="w-3 h-3 mr-1" /> Copiar
            </Button>
          </div>
          <div className="p-3 bg-background/40 rounded border border-border/60 text-sm leading-relaxed whitespace-pre-wrap">
            {legenda}
          </div>
        </section>
      )}

      <div className="pt-2 border-t border-border/40">
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => copyToClipboard(textoPlano, "Conteúdo copiado")}
        >
          <Copy className="w-3 h-3 mr-1.5" /> Copiar tudo
        </Button>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <section>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
        {label}
      </div>
      <p className="text-sm leading-relaxed whitespace-pre-wrap">{value}</p>
    </section>
  );
}

function BriefingView({ briefing }: { briefing: any }) {
  if (!briefing || typeof briefing !== "object") return <RawFallback data={briefing} />;

  // Novo formato v2: linguagem visual do reel
  const formato = briefing.formato;
  const tomVisual = briefing.tom_visual;
  const expressao = briefing.expressao_e_linguagem_corporal;
  const elementoGancho = briefing.elemento_visual_do_gancho;
  const textoTela = briefing.texto_em_tela;
  const reforcoMeio = briefing.reforco_no_meio;
  const cenarioMin = briefing.cenario_minimo;

  // Formato v1 (direção de gravação)
  const cenario = briefing.cenario;
  const enquadramento = briefing.enquadramento;
  const figurino = briefing.figurino_e_postura;
  const legendaVisual = briefing.legenda_visual_de_apoio;
  const clima = briefing.clima;

  // Fallback p/ formato antigo (carrossel)
  const { estilo_geral, paleta_cores, estrutura_por_slide_ou_frame, tipografia, observacoes_producao } = briefing;
  const paleta = Array.isArray(paleta_cores) ? paleta_cores : [];
  const estrutura = Array.isArray(estrutura_por_slide_ou_frame) ? estrutura_por_slide_ou_frame : [];

  const hasV2 = formato || tomVisual || expressao || elementoGancho || reforcoMeio || cenarioMin;
  const hasV1 = cenario || enquadramento || figurino || legendaVisual || clima;
  const hasNovo = hasV2 || hasV1 || textoTela;
  const hasAntigo = estilo_geral || paleta.length || estrutura.length || tipografia || observacoes_producao;
  if (!hasNovo && !hasAntigo) return <RawFallback data={briefing} />;

  const textoPlano = [
    formato && `Formato: ${formato}`,
    tomVisual && `Tom visual: ${tomVisual}`,
    expressao && `Expressão/corpo: ${expressao}`,
    elementoGancho && `Elemento do gancho: ${elementoGancho}`,
    textoTela && `Texto em tela: ${textoTela}`,
    reforcoMeio && `Reforço no meio: ${reforcoMeio}`,
    cenarioMin && `Cenário: ${cenarioMin}`,
    cenario && `Cenário: ${cenario}`,
    enquadramento && `Enquadramento: ${enquadramento}`,
    figurino && `Figurino/postura: ${figurino}`,
    legendaVisual && `Apoio no meio: ${legendaVisual}`,
    clima && `Clima: ${clima}`,
    estilo_geral && `Estilo: ${estilo_geral}`,
    paleta.length && `Paleta: ${paleta.join(", ")}`,
    estrutura.length && `Estrutura:\n${estrutura.map((s, i) => `  ${i + 1}. ${s}`).join("\n")}`,
    tipografia && `Tipografia: ${tipografia}`,
    observacoes_producao && `Observações: ${observacoes_producao}`,
  ]
    .filter(Boolean)
    .join("\n");

  return (
    <div className="space-y-5">
      {hasV2 && (
        <div className="space-y-4">
          <Field label="Formato" value={formato} />
          <Field label="Tom visual" value={tomVisual} />
          <Field label="Expressão e linguagem corporal" value={expressao} />
          {elementoGancho && (
            <section>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Elemento visual do gancho (primeiros 3s)
              </div>
              <div className="p-3 rounded border border-primary/40 bg-primary/5 text-sm leading-relaxed">
                {elementoGancho}
              </div>
            </section>
          )}
          {textoTela && (
            <section>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Texto em tela (abertura)
              </div>
              <div className="inline-block px-3 py-2 rounded border border-primary/40 bg-primary/5 text-sm font-medium">
                {textoTela}
              </div>
            </section>
          )}
          {reforcoMeio && <Field label="Reforço no meio do vídeo" value={reforcoMeio} />}
          {cenarioMin && <Field label="Cenário mínimo" value={cenarioMin} />}
        </div>
      )}

      {hasV1 && (
        <div className="space-y-4">
          <Field label="Cenário" value={cenario} />
          <Field label="Enquadramento" value={enquadramento} />
          <Field label="Figurino e postura" value={figurino} />
          {textoTela && !hasV2 && (
            <section>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Texto em tela (abertura)
              </div>
              <div className="inline-block px-3 py-2 rounded border border-primary/40 bg-primary/5 text-sm font-medium">
                {textoTela}
              </div>
            </section>
          )}
          {legendaVisual && <Field label="Apoio no meio do vídeo" value={legendaVisual} />}
          {clima && (
            <section>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Clima
              </div>
              <Badge variant="outline" className="text-xs font-normal">{clima}</Badge>
            </section>
          )}
        </div>
      )}

      {hasAntigo && (
        <div className="space-y-4 pt-4 border-t border-border/40">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            Direção (formato antigo)
          </div>
          {estilo_geral && <Field label="Estilo geral" value={estilo_geral} />}
          {paleta.length > 0 && (
            <section>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">Paleta</div>
              <div className="flex flex-wrap gap-2">
                {paleta.map((hex: string, i: number) => (
                  <div key={i} className="flex items-center gap-2 p-1.5 pr-3 bg-background/40 rounded border border-border/60">
                    <div className="w-7 h-7 rounded border border-border/60" style={{ background: hex }} aria-label={hex} />
                    <span className="text-xs font-mono">{hex}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
          {estrutura.length > 0 && (
            <section>
              <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5">
                Estrutura por slide/frame
              </div>
              <ol className="space-y-2">
                {estrutura.map((s: any, i: number) => (
                  <li key={i} className="p-3 bg-background/40 rounded border border-border/60">
                    <div className="text-[10px] font-mono uppercase tracking-wider text-primary mb-1">{i + 1}</div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap">
                      {typeof s === "string" ? s : JSON.stringify(s, null, 2)}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}
          {tipografia && <Field label="Tipografia" value={tipografia} />}
          {observacoes_producao && <Field label="Observações de produção" value={observacoes_producao} />}
        </div>
      )}

      <div className="pt-2 border-t border-border/40">
        <Button
          size="sm"
          variant="outline"
          className="text-xs"
          onClick={() => copyToClipboard(textoPlano, "Direção copiada")}
        >
          <Copy className="w-3 h-3 mr-1.5" /> Copiar direção
        </Button>
      </div>
    </div>
  );
}

export const Route = createFileRoute("/_authenticated/aprovacao/$pautaId")({
  head: () => ({
    meta: [
      { title: "Aprovação de conteúdo | prevIA - CONTENT" },
      {
        name: "description",
        content: "Revise roteiro, direção visual e carrossel antes de liberar a publicação.",
      },
      { property: "og:title", content: "Aprovação de conteúdo | prevIA - CONTENT" },
      { property: "og:description", content: "Última etapa humana antes da publicação." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AprovacaoPage,
});

const MOTIVOS = ["tom", "tema", "formato", "gancho", "outro"] as const;
type Motivo = (typeof MOTIVOS)[number];

function AprovacaoPage() {
  const { pautaId } = Route.useParams();
  const navigate = useNavigate();
  const [decision, setDecision] = useState<"aprovar" | "rejeitar" | null>(null);
  const [motivo, setMotivo] = useState<Motivo | "">("");
  const [comentario, setComentario] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["aprovacao", pautaId],
    queryFn: async () => {
      const [pautaRes, roteiroRes, arteRes, pubRes] = await Promise.all([
        supabase
          .from("pautas_geradas")
          .select("*, perfis:perfis(nome,tipo,diretrizes,identidade_visual,template_carrossel)")
          .eq("id", pautaId)
          .single(),
        supabase
          .from("roteiros")
          .select("*")
          .eq("pauta_id", pautaId)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("artes")
          .select("*")
          .eq("pauta_id", pautaId)
          .order("criado_em", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("publicacoes").select("*").eq("pauta_id", pautaId).maybeSingle(),
      ]);
      if (pautaRes.error) throw pautaRes.error;
      return {
        pauta: pautaRes.data,
        roteiro: roteiroRes.data,
        arte: arteRes.data,
        publicacao: pubRes.data,
      };
    },
  });

  async function submitDecision() {
    if (!data) return;
    if (decision === "rejeitar" && !motivo) {
      toast.error("Selecione um motivo de rejeição.");
      return;
    }
    setSubmitting(true);
    try {
      const novoStatus = decision === "aprovar" ? "aprovada" : "rejeitada";

      const { error: e1 } = await supabase
        .from("pautas_geradas")
        .update({ status: novoStatus })
        .eq("id", pautaId);
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("decisoes_aprovacao").insert({
        item_id: pautaId,
        item_tipo: "pauta",
        decisao: decision === "aprovar" ? "aprovado" : "rejeitado",
        motivo_categoria: motivo || null,
        comentario_livre: comentario || null,
        perfil_id: data.pauta.perfil_id,
      });
      if (e2) throw e2;

      if (decision === "aprovar") {
        await supabase.from("publicacoes").insert({
          pauta_id: pautaId,
          perfil_id: data.pauta.perfil_id,
          status: "pendente",
        });
      }

      toast.success(decision === "aprovar" ? "Aprovado." : "Rejeitado.");
      navigate({ to: "/pipeline" });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function marcarPostado() {
    await supabase
      .from("publicacoes")
      .update({ status: "postado", postado_em: new Date().toISOString() })
      .eq("pauta_id", pautaId);
    toast.success("Marcado como postado.");
    refetch();
  }

  if (!data) {
    return <div className="p-8 text-muted-foreground">Carregando...</div>;
  }

  const { pauta, roteiro, arte, publicacao } = data;
  const isAprovada = pauta.status === "aprovada";
  const isAguardando = pauta.status === "aguardando_aprovacao";

  return (
    <div className="p-8 max-w-[1400px]">
      <button
        onClick={() => navigate({ to: "/pipeline" })}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar ao pipeline
      </button>

      <header className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Badge className="bg-primary/20 text-primary border-0 font-mono uppercase">
            {(pauta as any).perfis?.nome}
          </Badge>
          <Badge variant="outline" className="font-mono uppercase text-xs">
            {pauta.formato_sugerido}
          </Badge>
          <Badge variant="outline" className="font-mono uppercase text-xs">
            {pauta.status}
          </Badge>
        </div>
        <h1 className="text-3xl font-display font-bold leading-tight">{pauta.tema}</h1>
        <p className="text-muted-foreground mt-2">{pauta.angulo}</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <Card className="p-6 bg-surface border-border">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Roteiro
          </h2>
          {roteiro?.conteudo ? (
            <RoteiroView conteudo={roteiro.conteudo} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Aguardando produção.</p>
          )}
        </Card>

        <Card className="p-6 bg-surface border-border">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Direção de gravação
          </h2>
          {arte?.briefing ? (
            <BriefingView briefing={arte.briefing} />
          ) : (
            <p className="text-sm text-muted-foreground italic">Aguardando produção.</p>
          )}
        </Card>
      </div>

      {isAguardando && (
        <Card className="p-6 bg-surface border-border">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Decisão humana
          </h2>

          <div className="flex gap-3 mb-6">
            <Button
              variant={decision === "aprovar" ? "default" : "outline"}
              onClick={() => setDecision("aprovar")}
              className={decision === "aprovar" ? "bg-success text-background hover:bg-success/90" : ""}
            >
              <Check className="w-4 h-4 mr-2" /> Aprovar
            </Button>
            <Button
              variant={decision === "rejeitar" ? "default" : "outline"}
              onClick={() => setDecision("rejeitar")}
              className={decision === "rejeitar" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
            >
              <X className="w-4 h-4 mr-2" /> Rejeitar
            </Button>
          </div>

          {decision === "rejeitar" && (
            <div className="space-y-4 mb-4 border-l-2 border-destructive/40 pl-4">
              <div>
                <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                  Motivo (obrigatório)
                </Label>
                <RadioGroup
                  value={motivo}
                  onValueChange={(v) => setMotivo(v as Motivo)}
                  className="mt-2 flex flex-wrap gap-3"
                >
                  {MOTIVOS.map((m) => (
                    <div key={m} className="flex items-center gap-2">
                      <RadioGroupItem value={m} id={m} />
                      <Label htmlFor={m} className="capitalize cursor-pointer">
                        {m}
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            </div>
          )}

          {decision && (
            <div className="space-y-2 mb-4">
              <Label className="text-xs font-mono uppercase tracking-wider text-muted-foreground">
                Comentário {decision === "rejeitar" ? "(opcional, mas recomendado)" : "(opcional)"}
              </Label>
              <Textarea
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="O que você quer que os agentes aprendam dessa decisão?"
                rows={3}
              />
            </div>
          )}

          {decision && (
            <Button onClick={submitDecision} disabled={submitting} className="w-full">
              {submitting ? "Salvando..." : "Confirmar decisão"}
            </Button>
          )}
        </Card>
      )}

      {isAprovada && (
        <Card className="p-6 bg-surface border-border">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Publicação
          </h2>
          {publicacao?.status === "postado" ? (
            <div className="text-sm">
              <Badge className="bg-success/20 text-success border-0">Postado</Badge>
              <span className="text-muted-foreground ml-2">
                em {publicacao.postado_em ? new Date(publicacao.postado_em).toLocaleString("pt-BR") : ""}
              </span>
            </div>
          ) : (
            <Button onClick={marcarPostado}>
              <Send className="w-4 h-4 mr-2" /> Marcar como postado
            </Button>
          )}
        </Card>
      )}

      {isAprovada && (
        <CarrosselPanel
          pautaId={pauta.id}
          perfilTemplateRaw={(pauta as any).perfis?.template_carrossel}
        />
      )}

    </div>
  );
}
