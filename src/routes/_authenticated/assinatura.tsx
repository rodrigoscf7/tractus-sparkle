import { createFileRoute } from "@tanstack/react-router";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useConta, TIPOS_USO } from "@/hooks/use-conta";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura e consumo | prevIA - CONTENT" },
      {
        name: "description",
        content: "Plano da conta, consumo por tipo de geração e data de renovação do ciclo.",
      },
      { property: "og:title", content: "Assinatura e consumo | prevIA - CONTENT" },
      { property: "og:description", content: "Limites de geração da sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssinaturaPage,
});

function Barra({ usado, limite }: { usado: number; limite: number }) {
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  const estourou = usado >= limite;
  return (
    <div className="mt-2 h-1.5 w-full rounded-md bg-secondary overflow-hidden">
      <div
        className={estourou ? "h-full bg-destructive" : "h-full bg-primary"}
        style={{ width: `${Math.max(pct, 2)}%` }}
      />
    </div>
  );
}

function Linha({ label, usado, limite }: { label: string; usado: number; limite: number }) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-sm">{label}</span>
        <span className="num text-sm text-muted-foreground">
          {usado} / {limite}
        </span>
      </div>
      <Barra usado={usado} limite={limite} />
    </div>
  );
}

function AssinaturaPage() {
  const { data, isLoading } = useConta();

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!data) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Seu usuário ainda não está vinculado a uma conta.
      </div>
    );
  }

  const plano = data.plano;
  const preco = (plano?.preco_mensal_centavos ?? 0) / 100;

  return (
    <div className="p-4 sm:p-8 max-w-3xl">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-semibold">Assinatura</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Plano da conta {data.conta.nome} e consumo do ciclo atual.
        </p>
      </header>

      <Card className="p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Plano atual
            </div>
            <div className="font-display text-xl font-semibold mt-1">{plano?.nome}</div>
            <div className="num text-sm text-muted-foreground mt-1">
              {preco === 0
                ? "Sem custo"
                : preco.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) + " / mês"}
            </div>
          </div>
          <div className="text-right">
            <Badge variant={data.conta.status === "ativa" ? "outline" : "destructive"}>
              {data.conta.status}
            </Badge>
            <div className="num text-xs text-muted-foreground mt-2">
              Renova em {data.resetEm.toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-5 sm:p-6 mt-4 space-y-5">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Consumo do ciclo
        </div>
        {TIPOS_USO.map((t) => (
          <Linha
            key={t.tipo}
            label={t.label}
            usado={data.uso[t.tipo] ?? 0}
            limite={Number((plano as Record<string, unknown>)?.[t.campoLimite] ?? 0)}
          />
        ))}
      </Card>

      <Card className="p-5 sm:p-6 mt-4 space-y-5">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Capacidade da conta
        </div>
        <Linha
          label="Perfis ativos"
          usado={data.perfisCount}
          limite={plano?.limite_perfis ?? 0}
        />
        <Linha
          label="Referências monitoradas"
          usado={data.refsCount}
          limite={plano?.limite_referencias ?? 0}
        />
      </Card>

      <p className="text-xs text-muted-foreground mt-4">
        Ao atingir um limite, as gerações daquele tipo param até a renovação do ciclo. Para mudar de
        plano, fale com a equipe prevIA.
      </p>
    </div>
  );
}
