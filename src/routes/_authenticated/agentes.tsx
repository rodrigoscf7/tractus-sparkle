import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export const Route = createFileRoute("/_authenticated/agentes")({
  component: AgentesPage,
});

const AGENTES = ["curador", "ideador", "copy", "visual", "revisor"] as const;

const STATE_META: Record<string, { label: string; tone: string; dot: string }> = {
  idle: { label: "Parado", tone: "text-muted-foreground", dot: "bg-muted-foreground/40" },
  working: { label: "Trabalhando", tone: "text-primary", dot: "bg-primary animate-pulse" },
  waiting: { label: "Aguardando", tone: "text-warning", dot: "bg-warning" },
  error: { label: "Erro", tone: "text-destructive", dot: "bg-destructive" },
};

function AgentesPage() {
  const { data, refetch } = useQuery({
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
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Agentes</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Status em tempo real dos 5 agentes do pipeline.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {AGENTES.map((nome) => {
          const a = byName.get(nome);
          const meta = STATE_META[a?.estado_atual ?? "idle"] ?? STATE_META.idle;
          return (
            <Card key={nome} className="p-5 sm:p-6 bg-surface border-border">
              <div className="flex items-start justify-between gap-2 mb-4">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold capitalize text-lg truncate">{nome}</h3>
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mt-1">
                    Agent
                  </p>
                </div>
                <Badge className={`${meta.tone} bg-transparent border-current shrink-0 whitespace-nowrap`}>
                  <span className={`inline-block w-2 h-2 rounded-full mr-2 ${meta.dot}`} />
                  {meta.label}
                </Badge>
              </div>
              <div className="text-xs text-muted-foreground border-t border-border pt-3">
                <div className="font-mono uppercase tracking-wider text-[10px] mb-1">
                  Última ação
                </div>
                <div className="text-foreground/80 text-xs leading-relaxed">
                  {a?.ultima_acao ?? "—"}
                </div>
                {a?.atualizado_em && (
                  <div className="mt-2 text-[10px] font-mono text-muted-foreground/60">
                    {new Date(a.atualizado_em).toLocaleString("pt-BR")}
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
