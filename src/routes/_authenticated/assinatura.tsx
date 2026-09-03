import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, ExternalLink } from "lucide-react";
import { useConta, TIPOS_USO } from "@/hooks/use-conta";
import { getMinhaAssinatura } from "@/lib/assinatura.functions";

export const Route = createFileRoute("/_authenticated/assinatura")({
  head: () => ({
    meta: [
      { title: "Assinatura e consumo | prevIA - CONTENT" },
      {
        name: "description",
        content: "Plano da conta, consumo por tipo de geração, renovação e mudança de plano.",
      },
      { property: "og:title", content: "Assinatura e consumo | prevIA - CONTENT" },
      { property: "og:description", content: "Limites de geração e planos da sua conta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AssinaturaPage,
});

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const SITUACAO: Record<string, { label: string; variant: "outline" | "secondary" | "destructive" }> = {
  trial: { label: "Em teste", variant: "secondary" },
  ativa: { label: "Ativa", variant: "outline" },
  atrasada: { label: "Pagamento pendente", variant: "destructive" },
  cancelada: { label: "Cancelada", variant: "destructive" },
};

function Barra({ usado, limite }: { usado: number; limite: number }) {
  const pct = limite > 0 ? Math.min(100, Math.round((usado / limite) * 100)) : 0;
  const estourou = limite > 0 && usado >= limite;
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
  const carregar = useServerFn(getMinhaAssinatura);
  const { data: billing } = useQuery({
    queryKey: ["minha-assinatura"],
    queryFn: () => carregar(),
  });

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
  const assinatura = billing?.assinatura ?? null;
  const situacao = SITUACAO[assinatura?.situacao ?? "ativa"] ?? SITUACAO["ativa"]!;
  const diasTrial = assinatura?.trial_fim
    ? Math.max(
        0,
        Math.ceil((new Date(assinatura.trial_fim).getTime() - Date.now()) / 86400000),
      )
    : null;

  function checkout(p: Record<string, any>) {
    if (!p.checkout_url) return null;
    const url = new URL(String(p.checkout_url));
    if (billing?.email) url.searchParams.set("email", billing.email);
    if (billing?.contaId) url.searchParams.set("s1", billing.contaId);
    url.searchParams.set("s2", String(p.codigo));
    return url.toString();
  }

  return (
    <div className="p-4 sm:p-8 max-w-5xl">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-semibold">Assinatura</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Plano da conta {data.conta.nome}, consumo do ciclo e mudança de plano.
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
              {(plano?.preco_mensal_centavos ?? 0) === 0
                ? "Sem custo"
                : `${brl(plano?.preco_mensal_centavos ?? 0)} / mês`}
            </div>
          </div>
          <div className="text-right">
            <Badge variant={situacao.variant}>{situacao.label}</Badge>
            {diasTrial !== null && assinatura?.situacao === "trial" && (
              <div className="num text-xs text-muted-foreground mt-2">
                {diasTrial} dia(s) restantes de teste
              </div>
            )}
            {assinatura?.proxima_renovacao && assinatura.situacao === "ativa" && (
              <div className="num text-xs text-muted-foreground mt-2">
                Renova em {new Date(assinatura.proxima_renovacao).toLocaleDateString("pt-BR")}
              </div>
            )}
            <div className="num text-xs text-muted-foreground mt-1">
              Limites reiniciam em {data.resetEm.toLocaleDateString("pt-BR")}
            </div>
          </div>
        </div>
        {assinatura?.situacao === "atrasada" && (
          <p className="text-sm text-destructive mt-4">
            Encontramos um pagamento pendente. Regularize pelo checkout para não perder as gerações
            do ciclo.
          </p>
        )}
      </Card>

      <div className="grid gap-4 mt-4 md:grid-cols-2">
        <Card className="p-5 sm:p-6 space-y-5">
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

        <Card className="p-5 sm:p-6 space-y-5">
          <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Capacidade da conta
          </div>
          <Linha label="Perfis ativos" usado={data.perfisCount} limite={plano?.limite_perfis ?? 0} />
          <Linha
            label="Referências monitoradas"
            usado={data.refsCount}
            limite={plano?.limite_referencias ?? 0}
          />
        </Card>
      </div>

      <h2 className="font-display text-xl font-semibold mt-8 mb-3">Planos</h2>
      <div className="grid gap-4 md:grid-cols-3">
        {(billing?.planos ?? []).map((p: any) => {
          const atual = p.codigo === data.conta.plano_codigo;
          const link = checkout(p);
          return (
            <Card
              key={p.codigo}
              className={`p-5 flex flex-col ${p.recomendado ? "ring-1 ring-primary" : ""}`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-display text-lg font-semibold">{p.nome}</div>
                {p.recomendado && <Badge className="ai-chip">Recomendado</Badge>}
              </div>
              <div className="num font-display text-2xl mt-2">
                {p.preco_mensal_centavos === 0 ? "Grátis" : brl(p.preco_mensal_centavos)}
                {p.preco_mensal_centavos > 0 && (
                  <span className="text-sm text-muted-foreground font-sans"> /mês</span>
                )}
              </div>
              {p.trial_dias > 0 && (
                <div className="num text-xs text-muted-foreground mt-1">
                  {p.trial_dias} dias de teste
                </div>
              )}
              {p.descricao && (
                <p className="text-sm text-muted-foreground mt-3">{p.descricao}</p>
              )}
              <ul className="mt-4 space-y-2 text-sm flex-1">
                {(Array.isArray(p.beneficios) ? p.beneficios : []).map((b: string) => (
                  <li key={b} className="flex gap-2">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <span>{b}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-5">
                {atual ? (
                  <Button variant="outline" className="w-full" disabled>
                    Plano atual
                  </Button>
                ) : link ? (
                  <Button asChild className="w-full">
                    <a href={link} target="_blank" rel="noreferrer">
                      Assinar <ExternalLink className="h-4 w-4 ml-1" />
                    </a>
                  </Button>
                ) : (
                  <Button variant="outline" className="w-full" disabled>
                    Checkout em breve
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <p className="text-xs text-muted-foreground mt-6">
        Ao atingir um limite, as gerações daquele tipo param até a renovação do ciclo. O pagamento é
        processado pela Kiwify e o plano é liberado automaticamente após a aprovação.
      </p>
    </div>
  );
}
