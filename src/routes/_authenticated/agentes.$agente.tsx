import { createFileRoute, Link, useNavigate, notFound } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

const AGENTES = ["curador", "ideador", "copy", "visual", "revisor"] as const;
type Agente = (typeof AGENTES)[number];

export const Route = createFileRoute("/_authenticated/agentes/$agente")({
  parseParams: (params) => {
    if (!AGENTES.includes(params.agente as Agente)) throw notFound();
    return { agente: params.agente as Agente };
  },
  component: AgenteDetalhePage,
  notFoundComponent: () => (
    <div className="p-8 text-muted-foreground">Agente não encontrado.</div>
  ),
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

type Item = {
  id: string;
  data: string | null;
  perfil: string | null;
  titulo: string;
  preview: string;
  badge?: string;
  pautaId?: string | null;
};

const PAGE_SIZE = 50;

async function fetchTimeline(agente: Agente): Promise<Item[]> {
  if (agente === "curador") {
    const { data, error } = await supabase
      .from("conteudos_curados")
      .select("id, tema, gancho, score_curadoria, capturado_em, perfis_referencia:perfis_referencia(handle, nicho)")
      .order("capturado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      data: r.capturado_em,
      perfil: r.perfis_referencia?.handle ? `@${r.perfis_referencia.handle}` : r.perfis_referencia?.nicho ?? null,
      titulo: r.tema ?? "(sem tema)",
      preview: r.gancho ?? "",
      badge: r.score_curadoria != null ? `score ${r.score_curadoria}` : undefined,
    }));
  }

  if (agente === "ideador") {
    const { data, error } = await supabase
      .from("pautas_geradas")
      .select("id, tema, angulo, formato_sugerido, criado_em, perfis:perfis(nome)")
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r: any) => ({
      id: r.id,
      data: r.criado_em,
      perfil: r.perfis?.nome ?? null,
      titulo: r.tema ?? "(sem tema)",
      preview: r.angulo ?? "",
      badge: r.formato_sugerido ?? undefined,
      pautaId: r.id,
    }));
  }

  if (agente === "copy") {
    const { data, error } = await supabase
      .from("roteiros")
      .select("id, pauta_id, conteudo, criado_em, pautas_geradas:pautas_geradas(tema, perfis:perfis(nome))")
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r: any) => {
      const c = r.conteudo as any;
      return {
        id: r.id,
        data: r.criado_em,
        perfil: r.pautas_geradas?.perfis?.nome ?? null,
        titulo: r.pautas_geradas?.tema ?? "(pauta sem tema)",
        preview: c?.gancho ?? (typeof c === "string" ? c : ""),
        pautaId: r.pauta_id,
      };
    });
  }

  if (agente === "visual") {
    const { data, error } = await supabase
      .from("artes")
      .select("id, pauta_id, briefing, criado_em, pautas_geradas:pautas_geradas(tema, perfis:perfis(nome))")
      .order("criado_em", { ascending: false })
      .limit(200);
    if (error) throw error;
    return (data ?? []).map((r: any) => {
      const b = r.briefing as any;
      return {
        id: r.id,
        data: r.criado_em,
        perfil: r.pautas_geradas?.perfis?.nome ?? null,
        titulo: r.pautas_geradas?.tema ?? "(pauta sem tema)",
        preview: b?.estilo_geral ?? "",
        pautaId: r.pauta_id,
      };
    });
  }

  // revisor
  const { data, error } = await supabase
    .from("pautas_geradas")
    .select("id, tema, angulo, status, criado_em, perfis:perfis(nome)")
    .in("status", ["aguardando_aprovacao", "aprovada", "rejeitada"])
    .order("criado_em", { ascending: false })
    .limit(200);
  if (error) throw error;
  return (data ?? []).map((r: any) => ({
    id: r.id,
    data: r.criado_em,
    perfil: r.perfis?.nome ?? null,
    titulo: r.tema ?? "(sem tema)",
    preview: r.angulo ?? "",
    badge: r.status,
    pautaId: r.id,
  }));
}

const TABLE_BY_AGENT: Record<Agente, string> = {
  curador: "conteudos_curados",
  ideador: "pautas_geradas",
  copy: "roteiros",
  visual: "artes",
  revisor: "pautas_geradas",
};

function AgenteDetalhePage() {
  const { agente } = Route.useParams() as { agente: Agente };
  const navigate = useNavigate();
  const [page, setPage] = useState(0);

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
    queryKey: ["agente-timeline", agente],
    queryFn: () => fetchTimeline(agente),
  });

  useEffect(() => {
    const ch = supabase
      .channel(`agente-timeline-${agente}`)
      .on("postgres_changes", { event: "*", schema: "public", table: TABLE_BY_AGENT[agente] }, () => refetch())
      .on("postgres_changes", { event: "*", schema: "public", table: "agentes_status" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [agente, refetch]);

  const meta = STATE_META[status?.estado_atual ?? "idle"] ?? STATE_META.idle;
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const slice = items.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div className="p-4 sm:p-8 max-w-[1200px]">
      <button
        onClick={() => navigate({ to: "/agentes" })}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-6"
      >
        <ArrowLeft className="w-4 h-4" /> Voltar para agentes
      </button>

      <header className="mb-6 sm:mb-8">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-display font-bold capitalize">{agente}</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Produção em ordem cronológica (mais recente primeiro).
            </p>
          </div>
          <Badge className={`${meta.tone} bg-transparent border-current shrink-0 whitespace-nowrap`}>
            <span className={`inline-block w-2 h-2 rounded-full mr-2 ${meta.dot}`} />
            {meta.label}
          </Badge>
        </div>
        {status?.ultima_acao && (
          <Card className="mt-4 p-4 bg-surface border-border">
            <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
              Última ação
            </div>
            <div className="text-sm text-foreground/80 leading-relaxed break-words">
              {status.ultima_acao}
            </div>
            {status.atualizado_em && (
              <div className="mt-2 text-[10px] font-mono text-muted-foreground/60">
                {new Date(status.atualizado_em).toLocaleString("pt-BR")}
              </div>
            )}
          </Card>
        )}
      </header>

      {items.length === 0 ? (
        <div className="text-sm text-muted-foreground italic">Nenhuma produção registrada ainda.</div>
      ) : (
        <>
          <div className="space-y-3">
            {slice.map((item) => {
              const card = (
                <Card className="p-4 bg-surface border-border hover:border-primary/40 transition">
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      {item.perfil && (
                        <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground truncate">
                          {item.perfil}
                        </span>
                      )}
                      {item.badge && (
                        <Badge variant="outline" className="text-[10px] font-mono uppercase">
                          {item.badge}
                        </Badge>
                      )}
                    </div>
                    {item.data && (
                      <span className="text-[10px] font-mono text-muted-foreground/60 shrink-0">
                        {new Date(item.data).toLocaleString("pt-BR")}
                      </span>
                    )}
                  </div>
                  <h3 className="font-medium text-sm leading-snug mb-1">{item.titulo}</h3>
                  {item.preview && (
                    <p className="text-xs text-muted-foreground line-clamp-2">{item.preview}</p>
                  )}
                </Card>
              );
              const linkable =
                item.pautaId && (agente === "copy" || agente === "visual" || agente === "revisor" || agente === "ideador");
              return linkable ? (
                <Link key={item.id} to="/aprovacao/$pautaId" params={{ pautaId: item.pautaId! }}>
                  {card}
                </Link>
              ) : (
                <div key={item.id}>{card}</div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6 text-xs">
              <Button
                size="sm"
                variant="outline"
                disabled={page === 0}
                onClick={() => setPage((p) => Math.max(0, p - 1))}
              >
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
