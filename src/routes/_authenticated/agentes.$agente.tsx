import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ArrowLeft, ChevronDown, ExternalLink, Heart, MessageCircle, Play } from "lucide-react";
import { AGENTE_CRITERIOS, type AgenteNome } from "@/lib/agente-criterios";

const AGENTES: AgenteNome[] = ["curador", "ideador", "copy", "visual", "revisor"];

export const Route = createFileRoute("/_authenticated/agentes/$agente")({
  parseParams: (params) => {
    if (!AGENTES.includes(params.agente as AgenteNome)) throw notFound();
    return { agente: params.agente as AgenteNome };
  },
  component: AgenteDetalhePage,
  notFoundComponent: () => <div className="p-8 text-muted-foreground">Agente não encontrado.</div>,
  errorComponent: ({ error }) => (
    <div className="p-8 text-destructive">Erro ao carregar: {error.message}</div>
  ),
});

const STATE_META: Record<string, { label: string; tone: string; dot: string }> = {
  idle: { label: "Parado", tone: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  working: { label: "Trabalhando", tone: "text-primary", dot: "bg-primary animate-pulse" },
  waiting: { label: "Aguardando", tone: "text-warning", dot: "bg-warning" },
  error: { label: "Erro", tone: "text-destructive", dot: "bg-destructive" },
};

const TABLE_BY_AGENT: Record<AgenteNome, string> = {
  curador: "conteudos_curados",
  ideador: "pautas_geradas",
  copy: "roteiros",
  visual: "artes",
  revisor: "pautas_geradas",
};

const PAGE_SIZE = 25;

// ---------- Fetch por agente (dados enriquecidos) ----------

async function fetchExecucoes(agente: AgenteNome): Promise<any[]> {
  if (agente === "curador") {
    const { data, error } = await supabase
      .from("conteudos_curados")
      .select(
        "id, tema, gancho, score_curadoria, capturado_em, formato, url, texto_original, likes, comentarios, views, postado_em, perfil_referencia_id, perfis_referencia:perfis_referencia(handle, nicho, perfil_id_relacionado, perfis:perfis(nome))",
      )
      .order("views", { ascending: false, nullsFirst: false })
      .order("capturado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    // pauta vinculada
    const ids = (data ?? []).map((r: any) => r.id);
    let pautasByOrigem = new Map<string, { id: string; tema: string | null }>();
    if (ids.length) {
      const { data: pautas } = await supabase
        .from("pautas_geradas")
        .select("id, tema, origem_curadoria_id")
        .in("origem_curadoria_id", ids);
      pautasByOrigem = new Map((pautas ?? []).map((p: any) => [p.origem_curadoria_id, { id: p.id, tema: p.tema }]));
    }
    return (data ?? []).map((r: any) => ({ ...r, pauta_vinculada: pautasByOrigem.get(r.id) ?? null }));
  }

  if (agente === "ideador") {
    const { data, error } = await supabase
      .from("pautas_geradas")
      .select(
        "id, tema, angulo, formato_sugerido, status, criado_em, origem_curadoria_id, perfil_id, perfis:perfis(nome), conteudos_curados:conteudos_curados!pautas_geradas_origem_curadoria_id_fkey(id, tema, gancho, url, score_curadoria, perfis_referencia:perfis_referencia(handle))",
      )
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  if (agente === "copy") {
    const { data, error } = await supabase
      .from("roteiros")
      .select(
        "id, pauta_id, conteudo, criado_em, status, pautas_geradas:pautas_geradas(id, tema, angulo, formato_sugerido, perfil_id, perfis:perfis(nome))",
      )
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  if (agente === "visual") {
    const { data, error } = await supabase
      .from("artes")
      .select(
        "id, pauta_id, briefing, criado_em, status, pautas_geradas:pautas_geradas(id, tema, angulo, perfil_id, perfis:perfis(nome))",
      )
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    return data ?? [];
  }

  // revisor: pautas revisadas + decisoes
  const { data, error } = await supabase
    .from("pautas_geradas")
    .select("id, tema, angulo, status, criado_em, perfis:perfis(nome)")
    .in("status", ["aguardando_aprovacao", "aprovada", "rejeitada"])
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) throw error;
  const ids = (data ?? []).map((r: any) => r.id);
  let decByItem = new Map<string, any>();
  if (ids.length) {
    const { data: decs } = await supabase
      .from("decisoes_aprovacao")
      .select("item_id, decisao, motivo_categoria, comentario_livre, criado_em")
      .in("item_id", ids)
      .order("criado_em", { ascending: false });
    for (const d of decs ?? []) if (!decByItem.has(d.item_id)) decByItem.set(d.item_id, d);
  }
  return (data ?? []).map((r: any) => ({ ...r, decisao: decByItem.get(r.id) ?? null }));
}

// ---------- Formatters ----------

const fmtNum = (n: number | null | undefined) =>
  n == null ? "—" : n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}k` : String(n);

const fmtDate = (s: string | null | undefined) =>
  s ? new Date(s).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "—";

// ---------- Card por execução ----------

function ExecucaoCard({ agente, item }: { agente: AgenteNome; item: any }) {
  const [open, setOpen] = useState(false);

  const header = renderHeader(agente, item);
  const linkPauta = pautaIdFromItem(agente, item);

  return (
    <Card className="bg-surface border-border overflow-hidden">
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger className="w-full text-left p-4 hover:bg-surface-hover transition flex items-start justify-between gap-3 cursor-pointer">
          <div className="min-w-0 flex-1">{header}</div>
          <ChevronDown
            className={`w-4 h-4 text-muted-foreground shrink-0 mt-1 transition-transform ${open ? "rotate-180" : ""}`}
          />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="border-t border-border p-4 space-y-4">
            {renderDetalhe(agente, item)}
            {linkPauta && (
              <div className="pt-2">
                <Link to="/aprovacao/$pautaId" params={{ pautaId: linkPauta }}>
                  <Button size="sm" variant="outline">
                    Ver na aprovação →
                  </Button>
                </Link>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}

function pautaIdFromItem(agente: AgenteNome, item: any): string | null {
  if (agente === "ideador" || agente === "revisor") return item.id;
  if (agente === "copy" || agente === "visual") return item.pauta_id ?? null;
  if (agente === "curador") return item.pauta_vinculada?.id ?? null;
  return null;
}

function renderHeader(agente: AgenteNome, item: any) {
  if (agente === "curador") {
    const ref = item.perfis_referencia;
    const perfilDestino = ref?.perfis?.nome as string | undefined;
    return (
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {perfilDestino && (
            <Badge className="text-[10px] font-mono border-transparent bg-primary/15 text-primary">
              {perfilDestino}
            </Badge>
          )}
          {ref?.handle && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              @{ref.handle}
            </span>
          )}
          {item.score_curadoria != null && (
            <Badge variant="outline" className="text-[10px] font-mono">
              score {item.score_curadoria}
            </Badge>
          )}
          {item.pauta_vinculada && (
            <Badge className="text-[10px] font-mono bg-primary/15 text-primary border-transparent">
              virou pauta
            </Badge>
          )}
        </div>
        <h3 className="font-medium text-sm leading-snug">{item.tema ?? "(sem tema)"}</h3>
        {item.gancho && <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">{item.gancho}</p>}
        <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground/80">
          {item.likes != null && (
            <span className="flex items-center gap-1">
              <Heart className="w-3 h-3" /> {fmtNum(item.likes)}
            </span>
          )}
          {item.comentarios != null && (
            <span className="flex items-center gap-1">
              <MessageCircle className="w-3 h-3" /> {fmtNum(item.comentarios)}
            </span>
          )}
          {item.views != null && (
            <span className="flex items-center gap-1">
              <Play className="w-3 h-3" /> {fmtNum(item.views)}
            </span>
          )}
          <span className="ml-auto font-mono text-[10px]">{fmtDate(item.capturado_em)}</span>
        </div>
      </div>
    );
  }

  if (agente === "ideador") {
    return (
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {item.perfis?.nome && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {item.perfis.nome}
            </span>
          )}
          {item.formato_sugerido && (
            <Badge variant="outline" className="text-[10px] font-mono">
              {item.formato_sugerido}
            </Badge>
          )}
          {!item.origem_curadoria_id && (
            <Badge className="text-[10px] font-mono bg-warning/15 text-warning border-transparent">
              evergreen
            </Badge>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">
            {item.status}
          </Badge>
        </div>
        <h3 className="font-medium text-sm leading-snug">{item.tema ?? "(sem tema)"}</h3>
        {item.angulo && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{item.angulo}</p>}
        <div className="text-[10px] font-mono text-muted-foreground/60 mt-2">{fmtDate(item.criado_em)}</div>
      </div>
    );
  }

  if (agente === "copy") {
    const c = item.conteudo ?? {};
    return (
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {item.pautas_geradas?.perfis?.nome && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {item.pautas_geradas.perfis.nome}
            </span>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">
            {item.status}
          </Badge>
        </div>
        <h3 className="font-medium text-sm leading-snug">{item.pautas_geradas?.tema ?? "(pauta sem tema)"}</h3>
        {c?.gancho_falado && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5 italic">"{c.gancho_falado}"</p>
        )}
        <div className="text-[10px] font-mono text-muted-foreground/60 mt-2">{fmtDate(item.criado_em)}</div>
      </div>
    );
  }

  if (agente === "visual") {
    const b = item.briefing ?? {};
    return (
      <div>
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          {item.pautas_geradas?.perfis?.nome && (
            <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
              {item.pautas_geradas.perfis.nome}
            </span>
          )}
          <Badge variant="outline" className="text-[10px] font-mono">
            {item.status}
          </Badge>
        </div>
        <h3 className="font-medium text-sm leading-snug">{item.pautas_geradas?.tema ?? "(pauta sem tema)"}</h3>
        {b?.estilo_geral && (
          <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{b.estilo_geral}</p>
        )}
        <div className="text-[10px] font-mono text-muted-foreground/60 mt-2">{fmtDate(item.criado_em)}</div>
      </div>
    );
  }

  // revisor
  const dec = item.decisao;
  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        {item.perfis?.nome && (
          <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">
            {item.perfis.nome}
          </span>
        )}
        <Badge
          className={`text-[10px] font-mono border-transparent ${
            item.status === "aprovada"
              ? "bg-success/15 text-success"
              : item.status === "rejeitada"
                ? "bg-destructive/15 text-destructive"
                : "bg-warning/15 text-warning"
          }`}
        >
          {item.status}
        </Badge>
      </div>
      <h3 className="font-medium text-sm leading-snug">{item.tema ?? "(sem tema)"}</h3>
      {dec?.comentario_livre && (
        <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">"{dec.comentario_livre}"</p>
      )}
      <div className="text-[10px] font-mono text-muted-foreground/60 mt-2">{fmtDate(item.criado_em)}</div>
    </div>
  );
}

function renderDetalhe(agente: AgenteNome, item: any) {
  if (agente === "curador") {
    return (
      <>
        <Section label="Post original no Instagram">
          <KV
            k="Perfil destino"
            v={item.perfis_referencia?.perfis?.nome ?? "—"}
          />
          <KV k="Perfil" v={item.perfis_referencia?.handle ? `@${item.perfis_referencia.handle}` : "—"} />
          <KV k="Nicho" v={item.perfis_referencia?.nicho ?? "—"} />
          <KV k="Formato" v={item.formato ?? "—"} />
          <KV k="Publicado em" v={fmtDate(item.postado_em)} />
          <KV k="Likes" v={fmtNum(item.likes)} />
          <KV k="Comentários" v={fmtNum(item.comentarios)} />
          <KV k="Views" v={fmtNum(item.views)} />
          {item.url && (
            <a
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-2"
            >
              Abrir no Instagram <ExternalLink className="w-3 h-3" />
            </a>
          )}
        </Section>
        <Section label="Decisão do curador">
          <KV k="Score" v={String(item.score_curadoria ?? "—")} />
          <KV k="Tema" v={item.tema ?? "—"} />
          <KV k="Gancho" v={item.gancho ?? "—"} />
        </Section>
        {item.texto_original && (
          <Section label="Caption original">
            <p className="text-xs text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {item.texto_original}
            </p>
          </Section>
        )}
        {item.pauta_vinculada && (
          <Section label="Pauta gerada">
            <p className="text-xs">{item.pauta_vinculada.tema}</p>
          </Section>
        )}
      </>
    );
  }

  if (agente === "ideador") {
    const orig = item.conteudos_curados;
    return (
      <>
        <Section label="Origem">
          {orig ? (
            <>
              <KV k="Curadoria base" v={orig.tema ?? "—"} />
              <KV k="Handle" v={orig.perfis_referencia?.handle ? `@${orig.perfis_referencia.handle}` : "—"} />
              <KV k="Score" v={String(orig.score_curadoria ?? "—")} />
              {orig.url && (
                <a
                  href={orig.url}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                >
                  Ver post original <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </>
          ) : (
            <p className="text-xs text-muted-foreground">
              Sem curadoria de entrada — pauta evergreen gerada a partir das diretrizes do perfil.
            </p>
          )}
        </Section>
        <Section label="Pauta produzida">
          <KV k="Tema" v={item.tema ?? "—"} />
          <KV k="Ângulo" v={item.angulo ?? "—"} />
          <KV k="Formato" v={item.formato_sugerido ?? "—"} />
          <KV k="Status atual" v={item.status} />
        </Section>
      </>
    );
  }

  if (agente === "copy") {
    const c = item.conteudo ?? {};
    return (
      <>
        <Section label="Pauta de entrada">
          <KV k="Tema" v={item.pautas_geradas?.tema ?? "—"} />
          <KV k="Ângulo" v={item.pautas_geradas?.angulo ?? "—"} />
        </Section>
        <Section label="Roteiro falado">
          {c.gancho_falado && (
            <div className="text-xs mb-2">
              <span className="text-muted-foreground uppercase text-[10px] font-mono">Gancho</span>
              <p className="mt-0.5">"{c.gancho_falado}"</p>
            </div>
          )}
          {c.desenvolvimento_falado && (
            <div className="text-xs mb-2">
              <span className="text-muted-foreground uppercase text-[10px] font-mono">Desenvolvimento</span>
              <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">{c.desenvolvimento_falado}</p>
            </div>
          )}
          {c.cta_falado && (
            <div className="text-xs mb-2">
              <span className="text-muted-foreground uppercase text-[10px] font-mono">CTA</span>
              <p className="mt-0.5">"{c.cta_falado}"</p>
            </div>
          )}
          {c.legenda_sugerida && (
            <div className="text-xs">
              <span className="text-muted-foreground uppercase text-[10px] font-mono">Legenda sugerida</span>
              <p className="mt-0.5">{c.legenda_sugerida}</p>
            </div>
          )}
        </Section>
      </>
    );
  }

  if (agente === "visual") {
    const b = item.briefing ?? {};
    return (
      <>
        <Section label="Pauta de entrada">
          <KV k="Tema" v={item.pautas_geradas?.tema ?? "—"} />
          <KV k="Ângulo" v={item.pautas_geradas?.angulo ?? "—"} />
        </Section>
        <Section label="Direções de gravação">
          {typeof b === "string" ? (
            <p className="text-xs whitespace-pre-wrap leading-relaxed">{b}</p>
          ) : (
            Object.entries(b).map(([k, v]) => (
              <div key={k} className="text-xs mb-2">
                <span className="text-muted-foreground uppercase text-[10px] font-mono">{k.replace(/_/g, " ")}</span>
                <p className="mt-0.5 whitespace-pre-wrap leading-relaxed">
                  {typeof v === "string" ? v : JSON.stringify(v)}
                </p>
              </div>
            ))
          )}
        </Section>
      </>
    );
  }

  // revisor
  const dec = item.decisao;
  return (
    <>
      <Section label="Pauta revisada">
        <KV k="Tema" v={item.tema ?? "—"} />
        <KV k="Ângulo" v={item.angulo ?? "—"} />
        <KV k="Status" v={item.status} />
      </Section>
      {dec ? (
        <Section label="Decisão registrada">
          <KV k="Resultado" v={dec.decisao ?? "—"} />
          <KV k="Motivo" v={dec.motivo_categoria ?? "—"} />
          {dec.comentario_livre && (
            <p className="text-xs text-muted-foreground mt-1 italic">"{dec.comentario_livre}"</p>
          )}
          <div className="text-[10px] font-mono text-muted-foreground/60 mt-1">{fmtDate(dec.criado_em)}</div>
        </Section>
      ) : (
        <Section label="Decisão">
          <p className="text-xs text-muted-foreground">Ainda sem decisão do humano registrada.</p>
        </Section>
      )}
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </div>
      <div className="space-y-1">{children}</div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-baseline gap-2 text-xs">
      <span className="text-muted-foreground w-28 shrink-0">{k}</span>
      <span className="text-foreground/90 break-words">{v}</span>
    </div>
  );
}

// ---------- Página ----------

function AgenteDetalhePage() {
  const { agente } = Route.useParams() as { agente: AgenteNome };
  const navigate = useNavigate();
  const [page, setPage] = useState(0);
  const criterios = AGENTE_CRITERIOS[agente];

  const { data: status } = useQuery({
    queryKey: ["agentes-status", agente],
    queryFn: async () => {
      const { data } = await supabase
        .from("agentes_status")
        .select("*")
        .eq("agente_nome", agente)
        .maybeSingle();
      return data;
    },
  });

  const { data: items = [], refetch } = useQuery({
    queryKey: ["agente-execucoes", agente],
    queryFn: () => fetchExecucoes(agente),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`agente-exec-${agente}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE_BY_AGENT[agente] }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "agentes_status" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agente, refetch]);

  const meta = STATE_META[status?.estado_atual ?? "idle"] ?? STATE_META.idle;

  // stats
  const total = items.length;
  const hoje = items.filter((i: any) => {
    const d = i.capturado_em ?? i.criado_em;
    if (!d) return false;
    const t = new Date(d).getTime();
    return Date.now() - t < 24 * 3600 * 1000;
  }).length;

  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="p-4 sm:p-8 max-w-[1000px]">
      <button
        onClick={() => navigate({ to: "/agentes" })}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para agentes
      </button>

      <header className="mb-6">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-bold capitalize">{agente}</h1>
            <p className="text-muted-foreground text-sm mt-1">{criterios.papel}</p>
          </div>
          <Badge className={`${meta.tone} bg-transparent border-current shrink-0 whitespace-nowrap`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${meta.dot}`} />
            {meta.label}
          </Badge>
        </div>
      </header>

      {/* Critérios */}
      <Card className="p-5 bg-surface border-border mb-4">
        <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
          Como este agente decide
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground/70 mb-1">Fontes de dados</div>
            <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80">
              {criterios.fontes.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase text-muted-foreground/70 mb-1">Critérios</div>
            <ul className="text-xs space-y-1 list-disc list-inside text-foreground/80">
              {criterios.criterios.map((c) => (
                <li key={c}>{c}</li>
              ))}
            </ul>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-border text-xs">
          <span className="text-[10px] font-mono uppercase text-muted-foreground/70 mr-2">Quando roda:</span>
          <span className="text-foreground/80">{criterios.gatilho}</span>
        </div>
      </Card>

      {/* Estado atual */}
      {status?.ultima_acao && (
        <Card className="p-4 bg-surface border-border mb-6">
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Última ação
          </div>
          <div className="text-sm text-foreground/80 leading-relaxed break-words">{status.ultima_acao}</div>
          {status.atualizado_em && (
            <div className="mt-2 text-[10px] font-mono text-muted-foreground/60">
              {fmtDate(status.atualizado_em)}
            </div>
          )}
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Card className="p-4 bg-surface border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Total registrado</div>
          <div className="text-2xl font-display mt-1">{total}</div>
        </Card>
        <Card className="p-4 bg-surface border-border">
          <div className="text-[10px] font-mono uppercase text-muted-foreground">Últimas 24h</div>
          <div className="text-2xl font-display mt-1">{hoje}</div>
        </Card>
      </div>

      {/* Timeline */}
      <div className="mb-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Execuções (mais recentes primeiro)
      </div>
      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">Nenhuma execução registrada ainda.</div>
      ) : (
        <>
          <div className="space-y-2">
            {slice.map((item: any) => (
              <ExecucaoCard key={item.id} agente={agente} item={item} />
            ))}
          </div>
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 text-xs">
              <Button size="sm" variant="outline" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
                ← Anterior
              </Button>
              <span className="text-muted-foreground font-mono">
                {page + 1} / {totalPages}
              </span>
              <Button
                size="sm"
                variant="outline"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              >
                Próxima →
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
