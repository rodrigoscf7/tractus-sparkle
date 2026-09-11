import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EstadoCarregando, EstadoErro } from "@/components/estados";

export const Route = createFileRoute("/_authenticated/agentes/")({
  head: () => ({
    meta: [
      { title: "Agentes | prevIA - CONTENT" },
      {
        name: "description",
        content: "Estado, última ação e produção de cada agente do pipeline.",
      },
      { property: "og:title", content: "Agentes | prevIA - CONTENT" },
      { property: "og:description", content: "Operação dos agentes de curadoria e produção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgentesPage,
});

const AGENTES = ["curador", "ideador", "copy", "visual", "revisor"] as const;

// O amarelo entra no ponto pulsante, nunca no texto do rótulo.
const STATE_META: Record<string, { label: string; tone: string; dot: string }> = {
  idle: { label: "Parado", tone: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  working: {
    label: "Trabalhando",
    tone: "text-foreground",
    dot: "bg-primary animate-pulse motion-reduce:animate-none",
  },
  waiting: { label: "Aguardando", tone: "text-warning", dot: "bg-warning" },
  error: { label: "Erro", tone: "text-destructive", dot: "bg-destructive" },
};

function formatLastAction(action?: string | null) {
  if (!action) return "—";
  if (action.includes("OpenRouter error 429") || action.includes("rate limit")) {
    return "Limite temporário do modelo atingido; o agente tentará novamente no próximo ciclo.";
  }
  return action.length > 180 ? `${action.slice(0, 180)}…` : action;
}

function AgentesPage() {
  const { data, refetch, isLoading, isError } = useQuery({
    queryKey: ["agentes-status"],
    queryFn: async () => {
      const { data, error } = await supabase.from("agentes_status").select("*");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("agentes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "agentes_status" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  const byName = new Map((data ?? []).map((a) => [a.agente_nome, a]));

  return (
    <div className="p-4 sm:p-8 max-w-[1200px]">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Bastidores</h1>
        <p className="text-muted-foreground text-sm mt-1">
          O que a prevIA está fazendo agora. Você não precisa acompanhar isto — está aqui para
          quando der vontade de ver a máquina rodando.
        </p>
      </header>

      {isLoading && <EstadoCarregando linhas={3} rotulo="Carregando o estado dos agentes" />}

      {isError && (
        <EstadoErro
          titulo="Não consegui ler o estado dos agentes"
          descricao="Isso não interrompe a produção — a esteira continua rodando no servidor."
          onTentarDeNovo={() => refetch()}
        />
      )}

      {!isLoading && !isError && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTES.map((nome) => {
          const a = byName.get(nome);
          const meta = STATE_META[a?.estado_atual ?? "idle"] ?? STATE_META.idle;
          return (
            <Link
              key={nome}
              to="/agentes/$agente"
              params={{ agente: nome }}
              className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Card className="p-5 sm:p-6 bg-surface border-border hover:border-primary/40 transition motion-reduce:transition-none h-full">
                <div className="flex items-start justify-between gap-2 mb-4">
                  <h3 className="font-display font-semibold capitalize text-lg truncate min-w-0">
                    {nome}
                  </h3>
                  <Badge className={`${meta.tone} bg-transparent border-current shrink-0 whitespace-nowrap`}>
                    <span className={`inline-block w-2 h-2 rounded-full mr-2 ${meta.dot}`} />
                    {meta.label}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground border-t border-border pt-3">
                  <div className="font-mono uppercase tracking-wider text-[11px] mb-1">
                    Última ação
                  </div>
                  <div className="text-foreground text-xs leading-relaxed break-words">
                    {formatLastAction(a?.ultima_acao)}
                  </div>
                  {a?.atualizado_em && (
                    <div className="mt-2 text-[11px] font-mono text-muted-foreground num">
                      {new Date(a.atualizado_em).toLocaleString("pt-BR")}
                    </div>
                  )}
                  <div className="mt-3 text-[11px] font-mono uppercase tracking-wider text-foreground">
                    Ver produção →
                  </div>
                </div>
              </Card>
            </Link>
          );
        })}
      </div>
      )}
    </div>
  );
}
