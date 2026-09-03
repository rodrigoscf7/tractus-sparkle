import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useIsPlatformAdmin } from "@/hooks/use-platform-admin";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração da plataforma | prevIA - CONTENT" },
      {
        name: "description",
        content: "Contas, planos, consumo e falhas de agentes de toda a plataforma.",
      },
      { property: "og:title", content: "Administração da plataforma | prevIA - CONTENT" },
      { property: "og:description", content: "Operação interna prevIA - CONTENT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const cicloAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

function AdminPage() {
  const { data: isAdmin, isLoading: loadingRole } = useIsPlatformAdmin();

  const { data: planos } = useQuery({
    queryKey: ["admin-planos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("planos").select("*").order("ordem");
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!isAdmin,
  });

  const { data: contas, refetch } = useQuery({
    queryKey: ["admin-contas"],
    queryFn: async () => {
      const ciclo = cicloAtual();
      const [c, u, m, e] = await Promise.all([
        supabase.from("contas").select("*, planos:planos(*)").order("criado_em"),
        supabase.from("uso_mensal").select("conta_id, tipo, quantidade").eq("ciclo", ciclo),
        supabase.from("conta_membros").select("conta_id, user_id, papel"),
        supabase.from("carrosseis").select("conta_id, erro").not("erro", "is", null),
      ]);
      if (c.error) throw c.error;
      return (c.data ?? []).map((conta) => ({
        ...conta,
        uso: Object.fromEntries(
          (u.data ?? []).filter((x) => x.conta_id === conta.id).map((x) => [x.tipo, x.quantidade]),
        ) as Record<string, number>,
        membros: (m.data ?? []).filter((x) => x.conta_id === conta.id).length,
        falhas: (e.data ?? []).filter((x) => x.conta_id === conta.id).length,
      }));
    },
    enabled: !!isAdmin,
  });

  async function trocarPlano(contaId: string, codigo: string) {
    const { error } = await supabase
      .from("contas")
      .update({ plano_codigo: codigo })
      .eq("id", contaId);
    if (error) return toast.error(error.message);
    toast.success("Plano atualizado.");
    refetch();
  }

  async function alternarStatus(contaId: string, status: string) {
    const novo = status === "ativa" ? "suspensa" : "ativa";
    const { error } = await supabase.from("contas").update({ status: novo }).eq("id", contaId);
    if (error) return toast.error(error.message);
    toast.success(novo === "ativa" ? "Conta reativada." : "Conta suspensa.");
    refetch();
  }

  if (loadingRole) return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  if (!isAdmin) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Esta área é restrita à administração da plataforma.
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1200px]">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-semibold">Administração</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Contas da plataforma, plano, consumo do ciclo e falhas registradas.
        </p>
      </header>

      <div className="space-y-3">
        {(contas ?? []).map((conta) => (
          <Card key={conta.id} className="p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="font-display text-lg font-semibold truncate">{conta.nome}</div>
                <div className="num text-xs text-muted-foreground mt-1">
                  {conta.membros} membro(s) · ciclo desde{" "}
                  {new Date(conta.ciclo_inicio).toLocaleDateString("pt-BR")}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {conta.falhas > 0 && (
                  <Badge variant="destructive" className="num">
                    {conta.falhas} falha(s)
                  </Badge>
                )}
                <Badge variant={conta.status === "ativa" ? "outline" : "destructive"}>
                  {conta.status}
                </Badge>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                  Plano
                </div>
                <Select
                  value={conta.plano_codigo}
                  onValueChange={(v) => trocarPlano(conta.id, v)}
                >
                  <SelectTrigger className="mt-1 h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(planos ?? []).map((p) => (
                      <SelectItem key={p.codigo} value={p.codigo}>
                        {p.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Metrica
                label="Curadorias"
                usado={conta.uso["curadoria"] ?? 0}
                limite={conta.planos?.limite_curadorias_mes ?? 0}
              />
              <Metrica
                label="Roteiros"
                usado={conta.uso["roteiro"] ?? 0}
                limite={conta.planos?.limite_roteiros_mes ?? 0}
              />
              <Metrica
                label="Carrosséis"
                usado={conta.uso["carrossel"] ?? 0}
                limite={conta.planos?.limite_carrosseis_mes ?? 0}
              />
            </div>

            <div className="mt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => alternarStatus(conta.id, conta.status)}
              >
                {conta.status === "ativa" ? "Suspender conta" : "Reativar conta"}
              </Button>
            </div>
          </Card>
        ))}
        {contas?.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
        )}
      </div>
    </div>
  );
}

function Metrica({ label, usado, limite }: { label: string; usado: number; limite: number }) {
  const estourou = limite > 0 && usado >= limite;
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`num mt-1 text-sm ${estourou ? "text-destructive" : ""}`}>
        {usado} / {limite}
      </div>
      <div className="mt-2 h-1.5 w-full rounded-md bg-secondary overflow-hidden">
        <div
          className={estourou ? "h-full bg-destructive" : "h-full bg-primary"}
          style={{ width: `${limite > 0 ? Math.min(100, (usado / limite) * 100) : 0}%` }}
        />
      </div>
    </div>
  );
}
