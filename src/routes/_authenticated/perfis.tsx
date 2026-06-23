import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/perfis")({
  component: PerfisPage,
});

const STATUS_ORDER = ["gerada", "em_producao", "aguardando_aprovacao", "aprovada", "rejeitada"];

function PerfisPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [novoHandle, setNovoHandle] = useState("");

  const { data: perfis } = useQuery({
    queryKey: ["perfis-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perfis").select("*").order("tipo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pautas } = useQuery({
    queryKey: ["perfis-pautas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pautas_geradas")
        .select("id, perfil_id, status, tema");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: refs, refetch: refetchRefs } = useQuery({
    queryKey: ["perfis-refs", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      const { data, error } = await supabase
        .from("perfis_referencia")
        .select("*")
        .eq("perfil_id_relacionado", activeId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeId,
  });

  const active = perfis?.find((p) => p.id === activeId);

  async function addReferencia() {
    if (!activeId || !novoHandle.trim()) return;
    const handle = novoHandle.replace(/^@/, "").trim();
    const { error } = await supabase
      .from("perfis_referencia")
      .insert({ handle, perfil_id_relacionado: activeId });
    if (error) {
      toast.error(error.message);
      return;
    }
    setNovoHandle("");
    refetchRefs();
    toast.success(`@${handle} adicionado.`);
  }

  async function removeRef(id: string) {
    await supabase.from("perfis_referencia").delete().eq("id", id);
    refetchRefs();
  }

  return (
    <div className="p-8 max-w-[1400px]">
      <header className="mb-8">
        <h1 className="text-3xl font-display font-bold">Perfis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Volume e status de conteúdo por perfil. Selecione um para gerenciar referências.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {perfis?.map((perfil) => {
          const ps = (pautas ?? []).filter((x) => x.perfil_id === perfil.id);
          const isActive = perfil.id === activeId;
          return (
            <Card
              key={perfil.id}
              onClick={() => setActiveId(isActive ? null : perfil.id)}
              className={`p-5 bg-surface border-border cursor-pointer transition hover:border-primary/40 ${
                isActive ? "border-primary" : ""
              }`}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-display font-semibold">{perfil.nome}</h3>
                  <Badge variant="outline" className="mt-1 text-[10px] uppercase font-mono">
                    {perfil.tipo}
                  </Badge>
                </div>
                <div className="text-2xl font-display font-bold tractus-gradient-text">
                  {ps.length}
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                {STATUS_ORDER.map((s) => {
                  const n = ps.filter((p) => p.status === s).length;
                  if (n === 0) return null;
                  return (
                    <div key={s} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{s.replace("_", " ")}</span>
                      <span className="font-mono">{n}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {active && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6 bg-surface border-border">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Identidade · {active.nome}
            </h2>
            <div className="space-y-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  Diretrizes
                </div>
                <pre className="text-xs bg-background p-3 rounded border border-border overflow-auto max-h-80 whitespace-pre-wrap">
                  {JSON.stringify(active.diretrizes, null, 2)}
                </pre>
              </div>
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                  Identidade visual
                </div>
                <pre className="text-xs bg-background p-3 rounded border border-border overflow-auto max-h-80 whitespace-pre-wrap">
                  {JSON.stringify(active.identidade_visual, null, 2)}
                </pre>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-surface border-border">
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Perfis de referência (Instagram)
            </h2>
            <div className="flex gap-2 mb-4">
              <Input
                value={novoHandle}
                onChange={(e) => setNovoHandle(e.target.value)}
                placeholder="@handle.instagram"
                onKeyDown={(e) => e.key === "Enter" && addReferencia()}
              />
              <Button onClick={addReferencia}>Adicionar</Button>
            </div>
            <div className="space-y-2">
              {refs?.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum perfil de referência ainda. O curador precisa deles para rodar.
                </p>
              )}
              {refs?.map((r) => (
                <div
                  key={r.id}
                  className="flex items-center justify-between p-3 rounded border border-border bg-background"
                >
                  <span className="font-mono text-sm">@{r.handle}</span>
                  <button
                    onClick={() => removeRef(r.id)}
                    className="text-xs text-muted-foreground hover:text-destructive"
                  >
                    remover
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
