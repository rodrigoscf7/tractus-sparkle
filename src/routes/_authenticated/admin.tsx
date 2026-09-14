import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { AlertTriangle, Check, Copy, UserPlus } from "lucide-react";
import { useIsPlatformAdmin } from "@/hooks/use-platform-admin";
import {
  getAdminDashboard,
  acaoConta,
  salvarPlano,
  salvarPrecoCusto,
  reprocessarEventoKiwify,
  criarContaConvidado,
} from "@/lib/billing.functions";
import { enviarNotificacaoTeste } from "@/lib/notificacoes.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Administração da plataforma | prevIA - CONTENT" },
      {
        name: "description",
        content:
          "Receita, contas pagantes, custo real de uso, margem por plano e eventos de cobrança.",
      },
      { property: "og:title", content: "Administração da plataforma | prevIA - CONTENT" },
      { property: "og:description", content: "Operação e economia do prevIA - CONTENT." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

const brl = (centavos: number) =>
  (Number(centavos || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 2,
  });

function Kpi({
  label,
  valor,
  detalhe,
  alerta,
}: {
  label: string;
  valor: string;
  detalhe?: string;
  alerta?: boolean;
}) {
  return (
    <Card className="p-4">
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </div>
      <div className={`num font-display text-2xl mt-1 ${alerta ? "text-destructive" : ""}`}>
        {valor}
      </div>
      {detalhe && <div className="num text-xs text-muted-foreground mt-1">{detalhe}</div>}
    </Card>
  );
}

function AdminPage() {
  const { data: isAdmin, isLoading: loadingRole } = useIsPlatformAdmin();
  const carregar = useServerFn(getAdminDashboard);
  const executar = useServerFn(acaoConta);
  const gravarPlano = useServerFn(salvarPlano);
  const gravarPreco = useServerFn(salvarPrecoCusto);
  const reprocessar = useServerFn(reprocessarEventoKiwify);
  const testarPush = useServerFn(enviarNotificacaoTeste);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["admin-dashboard"],
    queryFn: () => carregar(),
    enabled: !!isAdmin,
  });

  async function rodar(fn: () => Promise<unknown>, msg: string) {
    try {
      await fn();
      toast.success(msg);
      refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha na operação.");
    }
  }

  if (loadingRole || (isAdmin && isLoading)) {
    return <div className="p-8 text-sm text-muted-foreground">Carregando…</div>;
  }
  if (!isAdmin) {
    return (
      <div className="p-8 text-sm text-muted-foreground">
        Esta área é restrita à administração da plataforma.
      </div>
    );
  }

  const r = data?.resumo;

  return (
    <div className="p-4 sm:p-8 max-w-[1200px]">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-semibold">Administração</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Receita recorrente, custo real de uso, margem por plano e cobrança pela Kiwify.
        </p>
      </header>

      <Tabs defaultValue="financeiro">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="contas">Contas</TabsTrigger>
          <TabsTrigger value="planos">Planos</TabsTrigger>
          <TabsTrigger value="custos">Custos</TabsTrigger>
          <TabsTrigger value="kiwify">Cobrança</TabsTrigger>
          <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
        </TabsList>

        {/* ---------------- FINANCEIRO ---------------- */}
        <TabsContent value="financeiro" className="space-y-6 mt-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Receita recorrente (MRR)"
              valor={brl(r?.mrr_centavos ?? 0)}
              detalhe={`ARR ${brl(r?.arr_centavos ?? 0)}`}
            />
            <Kpi
              label="Contas pagantes"
              valor={String(r?.pagantes ?? 0)}
              detalhe={`${r?.trials ?? 0} em teste · ${r?.gratuitas ?? 0} gratuitas`}
            />
            <Kpi
              label="Ticket médio"
              valor={brl(r?.ticket_medio_centavos ?? 0)}
              detalhe={`Conversão de teste ${r?.conversao_trial_pct ?? 0}%`}
            />
            <Kpi
              label="Margem bruta do mês"
              valor={`${r?.margem_pct ?? 0}%`}
              detalhe={`${brl(r?.margem_centavos ?? 0)} · custo ${brl(r?.custo_mes_centavos ?? 0)}`}
              alerta={(r?.margem_pct ?? 0) < 50}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi
              label="Custo médio por conta / mês"
              valor={brl(r?.custo_por_conta_centavos ?? 0)}
            />
            <Kpi
              label="Pagamentos pendentes"
              valor={String(r?.atrasadas ?? 0)}
              alerta={(r?.atrasadas ?? 0) > 0}
            />
            <Kpi
              label="Cancelamentos no mês"
              valor={String(r?.canceladas_mes ?? 0)}
              alerta={(r?.canceladas_mes ?? 0) > 0}
            />
          </div>

          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Coerência de preço por plano
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Custo máximo = conta usando 100% dos limites, com o custo médio medido por tipo de
              geração. Margem abaixo de {data?.coerencia?.[0]?.piso_margem_pct ?? 60}% no uso máximo
              indica preço apertado.
            </p>
            <div className="mt-4 space-y-3">
              {(data?.coerencia ?? []).map((c) => (
                <div key={c.codigo} className="rounded-md border border-border p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="font-display font-semibold">
                      {c.nome}{" "}
                      <span className="num text-sm text-muted-foreground">
                        {c.preco_centavos === 0 ? "grátis" : `${brl(c.preco_centavos)}/mês`}
                      </span>
                    </div>
                    {c.alerta && (
                      <Badge variant="destructive" className="gap-1">
                        <AlertTriangle className="h-3 w-3" /> margem apertada
                      </Badge>
                    )}
                  </div>
                  <div className="grid gap-3 mt-3 sm:grid-cols-4 num text-sm">
                    <div>
                      <div className="text-[11px] font-mono uppercase text-muted-foreground">
                        Custo no uso máximo
                      </div>
                      {brl(c.custo_max_centavos)}
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase text-muted-foreground">
                        Custo real observado
                      </div>
                      {brl(c.custo_observado_centavos)}
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase text-muted-foreground">
                        Margem no uso máximo
                      </div>
                      <span className={c.alerta ? "text-destructive" : ""}>
                        {c.margem_max_pct}%
                      </span>
                    </div>
                    <div>
                      <div className="text-[11px] font-mono uppercase text-muted-foreground">
                        Margem no uso médio
                      </div>
                      {c.margem_media_pct}%
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Projeção
            </div>
            <div className="mt-4 grid gap-4 lg:grid-cols-3">
              {(data?.projecao ?? []).map((p) => (
                <div key={p.cenario} className="rounded-md border border-border p-3">
                  <div className="font-display font-semibold">{p.cenario}</div>
                  <div className="mt-2 space-y-2">
                    {p.meses.map((m) => (
                      <div key={m.mes} className="num text-sm">
                        <div className="text-muted-foreground text-xs">Em {m.mes} meses</div>
                        {m.contas} pagantes · {brl(m.receita_centavos)} · margem {m.margem_pct}%
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          {(data?.serie?.length ?? 0) > 0 && (
            <Card className="p-5">
              <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Custo por mês
              </div>
              <div className="mt-3 space-y-2">
                {(data?.serie ?? []).map((s) => (
                  <div key={s.ciclo} className="num text-sm flex justify-between gap-3">
                    <span>
                      {new Date(s.ciclo).toLocaleDateString("pt-BR", {
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    <span className="text-muted-foreground">
                      IA {brl(s.custo_ia_centavos)} · coleta {brl(s.custo_scraping_centavos)} ·{" "}
                      {s.geracoes} gerações
                    </span>
                    <span>{brl(s.custo_total_centavos)}</span>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </TabsContent>

        {/* ---------------- CONTAS ---------------- */}
        <TabsContent value="contas" className="space-y-3 mt-5">
          <ConvidarConta planos={data?.planos ?? []} aoCriar={refetch} />

          {(data?.contas ?? []).map((conta) => (
            <Card key={conta.id} className="p-4 sm:p-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="font-display text-lg font-semibold truncate">{conta.nome}</div>
                  <div className="num text-xs text-muted-foreground mt-1">
                    {conta.membros} membro(s) · desde{" "}
                    {new Date(conta.criado_em).toLocaleDateString("pt-BR")}
                    {conta.assinatura?.comprador_email
                      ? ` · ${conta.assinatura.comprador_email}`
                      : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {conta.alerta_consumo && (
                    <Badge variant="destructive" className="gap-1">
                      <AlertTriangle className="h-3 w-3" /> consumo alto
                    </Badge>
                  )}
                  <Badge variant="secondary">
                    {conta.assinatura?.situacao ?? "sem assinatura"}
                  </Badge>
                  <Badge variant={conta.status === "ativa" ? "outline" : "destructive"}>
                    {conta.status}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                    Plano
                  </div>
                  <Select
                    value={conta.plano_codigo}
                    onValueChange={(v) =>
                      rodar(
                        () =>
                          executar({
                            data: { contaId: conta.id, acao: "trocar_plano", planoCodigo: v },
                          }),
                        "Plano atualizado.",
                      )
                    }
                  >
                    <SelectTrigger className="mt-1 h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(data?.planos ?? []).map((p: any) => (
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
                  limite={conta.limites.curadoria}
                />
                <Metrica
                  label="Roteiros"
                  usado={conta.uso["roteiro"] ?? 0}
                  limite={conta.limites.roteiro}
                />
                <Metrica
                  label="Carrosséis"
                  usado={conta.uso["carrossel"] ?? 0}
                  limite={conta.limites.carrossel}
                />
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-3 num text-sm">
                <div>
                  <div className="text-[11px] font-mono uppercase text-muted-foreground">
                    Receita
                  </div>
                  {brl(conta.receita_centavos)}
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase text-muted-foreground">
                    Custo do ciclo
                  </div>
                  {brl(conta.custo_centavos)} · {conta.geracoes} gerações
                </div>
                <div>
                  <div className="text-[11px] font-mono uppercase text-muted-foreground">
                    Margem
                  </div>
                  <span className={conta.margem_centavos < 0 ? "text-destructive" : ""}>
                    {brl(conta.margem_centavos)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    rodar(
                      () =>
                        executar({
                          data: {
                            contaId: conta.id,
                            acao: conta.status === "ativa" ? "suspender" : "reativar",
                          },
                        }),
                      conta.status === "ativa" ? "Conta suspensa." : "Conta reativada.",
                    )
                  }
                >
                  {conta.status === "ativa" ? "Suspender" : "Reativar"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    rodar(
                      () =>
                        executar({ data: { contaId: conta.id, acao: "conceder_trial", dias: 14 } }),
                      "Teste de 14 dias concedido.",
                    )
                  }
                >
                  Conceder 14 dias
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    rodar(
                      () =>
                        executar({
                          data: {
                            contaId: conta.id,
                            acao: "pagamento_manual",
                            observacao: "Pagamento registrado manualmente pelo admin",
                          },
                        }),
                      "Pagamento manual registrado.",
                    )
                  }
                >
                  Marcar pagamento manual
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    rodar(
                      () => executar({ data: { contaId: conta.id, acao: "cancelar_assinatura" } }),
                      "Assinatura cancelada.",
                    )
                  }
                >
                  Cancelar assinatura
                </Button>
              </div>
            </Card>
          ))}
          {data?.contas?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma conta cadastrada.</p>
          )}
        </TabsContent>

        {/* ---------------- PLANOS ---------------- */}
        <TabsContent value="planos" className="space-y-3 mt-5">
          {(data?.planos ?? []).map((p: any) => (
            <PlanoEditor
              key={p.codigo}
              plano={p}
              onSalvar={(valores) =>
                rodar(() => gravarPlano({ data: { codigo: p.codigo, valores } }), "Plano salvo.")
              }
            />
          ))}
          <NovoPlano
            onCriar={(codigo, valores) =>
              rodar(() => gravarPlano({ data: { codigo, novo: true, valores } }), "Plano criado.")
            }
          />
        </TabsContent>

        {/* ---------------- CUSTOS ---------------- */}
        <TabsContent value="custos" className="space-y-4 mt-5">
          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Custo médio medido por tipo de geração
            </div>
            <div className="mt-3 space-y-2">
              {(data?.custo_medio_tipo ?? []).map((m) => (
                <div key={m.tipo} className="num text-sm flex justify-between gap-3">
                  <span className="capitalize">{m.tipo}</span>
                  <span className="text-muted-foreground">{m.eventos} evento(s)</span>
                  <span>
                    médio {brl(m.custo_medio_centavos)} · pico {brl(m.custo_max_centavos)}
                  </span>
                </div>
              ))}
              {(data?.custo_medio_tipo?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum evento de custo registrado ainda. Os valores aparecem após a próxima
                  execução dos agentes.
                </p>
              )}
            </div>
          </Card>

          {(data?.precos ?? []).map((p: any) => (
            <PrecoEditor
              key={p.chave}
              preco={p}
              onSalvar={(valores) =>
                rodar(
                  () => gravarPreco({ data: { ...valores, chave: p.chave } }),
                  "Preço atualizado.",
                )
              }
            />
          ))}
        </TabsContent>

        {/* ---------------- COBRANÇA / KIWIFY ---------------- */}
        <TabsContent value="kiwify" className="space-y-3 mt-5">
          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Endereço do webhook da Kiwify
            </div>
            <code className="block num text-xs mt-2 break-all">
              {typeof window !== "undefined" ? window.location.origin : ""}
              /api/public/webhooks/kiwify
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Cadastre esse endereço na Kiwify para compra aprovada, recusada, reembolso,
              cancelamento e atraso de assinatura.
            </p>
          </Card>

          {(data?.eventos_kiwify ?? []).map((e: any) => (
            <Card key={e.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-display font-semibold">{e.evento}</div>
                  <div className="num text-xs text-muted-foreground mt-1 break-all">
                    {new Date(e.criado_em).toLocaleString("pt-BR")}
                    {e.comprador_email ? ` · ${e.comprador_email}` : ""}
                    {e.valor_centavos ? ` · ${brl(e.valor_centavos)}` : ""}
                  </div>
                  {e.erro && <div className="text-xs text-destructive mt-1">{e.erro}</div>}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={e.processado ? "outline" : "destructive"}>
                    {e.processado ? "processado" : "pendente"}
                  </Badge>
                  {!e.processado && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        rodar(
                          () => reprocessar({ data: { eventoId: e.id } }),
                          "Evento reprocessado.",
                        )
                      }
                    >
                      Reprocessar
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {(data?.eventos_kiwify?.length ?? 0) === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum evento recebido ainda.</p>
          )}

          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Ações administrativas recentes
            </div>
            <div className="mt-3 space-y-1">
              {(data?.acoes ?? []).map((a: any) => (
                <div key={a.id} className="num text-xs text-muted-foreground">
                  {new Date(a.criado_em).toLocaleString("pt-BR")} · {a.acao}
                </div>
              ))}
              {(data?.acoes?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma ação registrada.</p>
              )}
            </div>
          </Card>
        </TabsContent>

        {/* ---------------- ONBOARDING ---------------- */}
        <TabsContent value="onboarding" className="space-y-4 mt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi
              label="Onboardings iniciados"
              valor={String(data?.onboarding?.iniciados ?? 0)}
              detalhe={`${data?.onboarding?.concluidos ?? 0} concluídos`}
            />
            <Kpi
              label="Conclusão do wizard"
              valor={`${data?.onboarding?.conversao_pct ?? 0}%`}
              alerta={(data?.onboarding?.conversao_pct ?? 100) < 70}
            />
            <Kpi
              label="Em aberto"
              valor={String(
                (data?.onboarding?.iniciados ?? 0) - (data?.onboarding?.concluidos ?? 0),
              )}
            />
          </div>

          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Notificações push
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cria um lote de teste na fila e chama o push-agent na hora, sem esperar o cron — use
              para confirmar que as chaves VAPID estão configuradas.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() =>
                rodar(
                  () => testarPush(),
                  "Notificação de teste enviada (confira as inscrições ativas do seu usuário).",
                )
              }
            >
              Enviar notificação de teste
            </Button>
          </Card>

          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Onde as pessoas param
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Contas que abriram o wizard e não terminaram, pelo passo em que estavam.
            </p>
            <div className="mt-4 space-y-2">
              {(data?.onboarding?.abandono_por_passo ?? []).map((p) => (
                <div key={p.passo} className="num text-sm flex justify-between gap-3">
                  <span>Passo {p.passo}</span>
                  <span className={p.quantidade > 0 ? "" : "text-muted-foreground"}>
                    {p.quantidade}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            <Distribuicao
              titulo="Como conheceram a prevIA"
              itens={data?.onboarding?.origem ?? []}
              total={data?.onboarding?.concluidos ?? 0}
            />
            <Distribuicao
              titulo="Área de atuação"
              itens={data?.onboarding?.area ?? []}
              total={data?.onboarding?.concluidos ?? 0}
            />
            <Distribuicao
              titulo="Situação declarada"
              itens={data?.onboarding?.situacao ?? []}
              total={data?.onboarding?.concluidos ?? 0}
            />
            <Distribuicao
              titulo="Tamanho do escritório"
              itens={data?.onboarding?.tamanho ?? []}
              total={data?.onboarding?.concluidos ?? 0}
            />
            <Distribuicao
              titulo="Tráfego pago"
              itens={data?.onboarding?.trafego ?? []}
              total={data?.onboarding?.concluidos ?? 0}
            />
            <Distribuicao
              titulo="Onde já publicam"
              itens={data?.onboarding?.canais ?? []}
              total={data?.onboarding?.concluidos ?? 0}
            />
          </div>

          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Respostas por conta
            </div>
            <div className="mt-4 space-y-2">
              {(data?.onboarding?.contas ?? []).map((c) => (
                <div
                  key={c.conta_id}
                  className="rounded-md border border-border p-3 flex flex-wrap items-center gap-x-4 gap-y-1"
                >
                  <span className="font-display font-semibold">{c.nome_informado ?? c.nome}</span>
                  {c.concluido_em ? (
                    <Badge variant="outline" className="num text-xs">
                      {new Date(c.concluido_em).toLocaleDateString("pt-BR")}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="text-xs">
                      parou no passo {c.passo_atual}
                    </Badge>
                  )}
                  <span className="text-sm text-muted-foreground">
                    {[
                      c.area,
                      c.nicho,
                      c.origem && `via ${c.origem}`,
                      c.tamanho,
                      c.trafego && `tráfego: ${c.trafego}`,
                      `${c.referencias} referência(s)`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {c.situacao && (
                    <span className="text-sm text-muted-foreground basis-full">“{c.situacao}”</span>
                  )}
                </div>
              ))}
              {(data?.onboarding?.contas?.length ?? 0) === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhuma conta passou pelo onboarding ainda.
                </p>
              )}
            </div>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Distribuicao({
  titulo,
  itens,
  total,
}: {
  titulo: string;
  itens: { label: string; quantidade: number }[];
  total: number;
}) {
  const maior = itens[0]?.quantidade ?? 0;
  return (
    <Card className="p-5">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        {titulo}
      </div>
      <div className="mt-4 space-y-3">
        {itens.map((item) => (
          <div key={item.label}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm">{item.label}</span>
              <span className="num text-sm text-muted-foreground">
                {item.quantidade}
                {total > 0 && ` · ${Math.round((item.quantidade / total) * 100)}%`}
              </span>
            </div>
            <div className="mt-1.5 h-1.5 w-full rounded-md bg-secondary overflow-hidden">
              <div
                className="h-full bg-primary"
                style={{ width: `${maior > 0 ? (item.quantidade / maior) * 100 : 0}%` }}
              />
            </div>
          </div>
        ))}
        {itens.length === 0 && (
          <p className="text-sm text-muted-foreground">Sem respostas ainda.</p>
        )}
      </div>
    </Card>
  );
}

function Metrica({ label, usado, limite }: { label: string; usado: number; limite: number }) {
  const estourou = limite > 0 && usado >= limite;
  return (
    <div>
      <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
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

const CAMPOS_PLANO: { campo: string; label: string; tipo: "texto" | "numero" | "bool" }[] = [
  { campo: "nome", label: "Nome", tipo: "texto" },
  { campo: "preco_mensal_centavos", label: "Preço mensal (centavos)", tipo: "numero" },
  { campo: "preco_anual_centavos", label: "Preço anual (centavos)", tipo: "numero" },
  { campo: "trial_dias", label: "Dias de teste", tipo: "numero" },
  { campo: "limite_perfis", label: "Perfis", tipo: "numero" },
  { campo: "limite_referencias", label: "Referências", tipo: "numero" },
  { campo: "limite_curadorias_mes", label: "Curadorias/mês", tipo: "numero" },
  { campo: "limite_roteiros_mes", label: "Roteiros/mês", tipo: "numero" },
  { campo: "limite_carrosseis_mes", label: "Carrosséis/mês", tipo: "numero" },
  { campo: "checkout_url", label: "Link de checkout Kiwify", tipo: "texto" },
  { campo: "kiwify_produto_id", label: "ID do produto Kiwify", tipo: "texto" },
  { campo: "kiwify_oferta_id", label: "ID da oferta Kiwify", tipo: "texto" },
  { campo: "descricao", label: "Descrição", tipo: "texto" },
  { campo: "ordem", label: "Ordem", tipo: "numero" },
];

function PlanoEditor({
  plano,
  onSalvar,
}: {
  plano: Record<string, any>;
  onSalvar: (valores: Record<string, unknown>) => void;
}) {
  const [form, setForm] = useState<Record<string, any>>(plano);
  const [beneficios, setBeneficios] = useState(
    (Array.isArray(plano.beneficios) ? plano.beneficios : []).join("\n"),
  );

  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="font-display text-lg font-semibold">
          {plano.nome} <span className="num text-xs text-muted-foreground">{plano.codigo}</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={form.publico ? "outline" : "secondary"}>
            {form.publico ? "público" : "oculto"}
          </Badge>
          <Badge variant={form.recomendado ? "default" : "secondary"}>
            {form.recomendado ? "recomendado" : "padrão"}
          </Badge>
        </div>
      </div>

      <div className="grid gap-3 mt-4 sm:grid-cols-2 lg:grid-cols-3">
        {CAMPOS_PLANO.map((c) => (
          <div key={c.campo}>
            <Label className="text-xs">{c.label}</Label>
            <Input
              className="mt-1 h-9"
              type={c.tipo === "numero" ? "number" : "text"}
              value={form[c.campo] ?? ""}
              onChange={(e) =>
                setForm({
                  ...form,
                  [c.campo]: c.tipo === "numero" ? Number(e.target.value) : e.target.value,
                })
              }
            />
          </div>
        ))}
        <div className="sm:col-span-2 lg:col-span-3">
          <Label className="text-xs">Benefícios (um por linha)</Label>
          <textarea
            className="mt-1 w-full min-h-24 rounded-md border border-input bg-background p-2 text-sm"
            value={beneficios}
            onChange={(e) => setBeneficios(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button
          size="sm"
          onClick={() =>
            onSalvar({
              nome: form.nome,
              descricao: form.descricao,
              preco_mensal_centavos: Number(form.preco_mensal_centavos ?? 0),
              preco_anual_centavos: Number(form.preco_anual_centavos ?? 0),
              trial_dias: Number(form.trial_dias ?? 0),
              limite_perfis: Number(form.limite_perfis ?? 0),
              limite_referencias: Number(form.limite_referencias ?? 0),
              limite_curadorias_mes: Number(form.limite_curadorias_mes ?? 0),
              limite_roteiros_mes: Number(form.limite_roteiros_mes ?? 0),
              limite_carrosseis_mes: Number(form.limite_carrosseis_mes ?? 0),
              checkout_url: form.checkout_url || null,
              kiwify_produto_id: form.kiwify_produto_id || null,
              kiwify_oferta_id: form.kiwify_oferta_id || null,
              ordem: Number(form.ordem ?? 0),
              publico: !!form.publico,
              recomendado: !!form.recomendado,
              ativo: !!form.ativo,
              beneficios: beneficios
                .split("\n")
                .map((b) => b.trim())
                .filter(Boolean),
            })
          }
        >
          Salvar plano
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForm({ ...form, publico: !form.publico })}
        >
          {form.publico ? "Ocultar da vitrine" : "Publicar na vitrine"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForm({ ...form, recomendado: !form.recomendado })}
        >
          {form.recomendado ? "Remover destaque" : "Marcar como recomendado"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setForm({ ...form, ativo: !form.ativo })}
        >
          {form.ativo ? "Desativar plano" : "Ativar plano"}
        </Button>
      </div>
    </Card>
  );
}

function NovoPlano({
  onCriar,
}: {
  onCriar: (codigo: string, valores: Record<string, unknown>) => void;
}) {
  const [codigo, setCodigo] = useState("");
  const [nome, setNome] = useState("");
  const [preco, setPreco] = useState(0);
  return (
    <Card className="p-4 sm:p-5">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Novo plano
      </div>
      <div className="grid gap-3 mt-3 sm:grid-cols-4">
        <div>
          <Label className="text-xs">Código</Label>
          <Input className="mt-1 h-9" value={codigo} onChange={(e) => setCodigo(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Nome</Label>
          <Input className="mt-1 h-9" value={nome} onChange={(e) => setNome(e.target.value)} />
        </div>
        <div>
          <Label className="text-xs">Preço mensal (centavos)</Label>
          <Input
            className="mt-1 h-9"
            type="number"
            value={preco}
            onChange={(e) => setPreco(Number(e.target.value))}
          />
        </div>
        <div className="flex items-end">
          <Button
            size="sm"
            disabled={!codigo || !nome}
            onClick={() => onCriar(codigo, { nome, preco_mensal_centavos: preco, publico: false })}
          >
            Criar plano
          </Button>
        </div>
      </div>
    </Card>
  );
}

/**
 * Convite de cortesia.
 *
 * O cadastro público está desligado no Auth do projeto: quem entra ou comprou
 * pela Kiwify, ou nasce aqui. Este card é a segunda porta — demonstração,
 * parceiro, teste — sem reabrir a primeira para a internet inteira.
 *
 * A senha aparece UMA vez e some ao fechar. Não é teatro de segurança: ela não
 * fica gravada em lugar nenhum, nem no log de ações, então esta tela é
 * literalmente a única chance de copiá-la.
 */
function ConvidarConta({
  planos,
  aoCriar,
}: {
  planos: { codigo: string; nome: string }[];
  aoCriar: () => void;
}) {
  const criar = useServerFn(criarContaConvidado);
  const [aberto, setAberto] = useState(false);
  const [email, setEmail] = useState("");
  const [nome, setNome] = useState("");
  const [plano, setPlano] = useState("starter");
  const [dias, setDias] = useState("30");
  const [salvando, setSalvando] = useState(false);
  const [criado, setCriado] = useState<{ email: string; senha: string; dias: number } | null>(null);
  const [copiado, setCopiado] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      const r = await criar({
        data: {
          email,
          nome: nome || undefined,
          planoCodigo: plano,
          diasCortesia: Number(dias) || 30,
        },
      });
      setCriado({ email: r.email, senha: r.senha, dias: r.dias });
      setEmail("");
      setNome("");
      aoCriar();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o convidado.");
    } finally {
      setSalvando(false);
    }
  }

  const textoParaEnviar = criado
    ? `Acesso prevIA

Endereço: ${typeof window !== "undefined" ? window.location.origin : ""}/auth
E-mail: ${criado.email}
Senha provisória: ${criado.senha}

Troque a senha depois de entrar.`
    : "";

  async function copiar() {
    try {
      await navigator.clipboard.writeText(textoParaEnviar);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie à mão.");
    }
  }

  if (criado) {
    return (
      <Card className="p-5 sm:p-6 border-primary/40">
        <div className="font-display text-lg font-semibold">Convidado criado</div>
        <p className="text-sm text-muted-foreground mt-1">
          Esta senha aparece só agora — ela não fica guardada em lugar nenhum. Copie antes de
          fechar.
        </p>

        <pre className="mt-4 whitespace-pre-wrap rounded-md border border-border bg-surface-elevated p-4 text-sm font-mono">
          {textoParaEnviar}
        </pre>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button onClick={copiar} className="gap-2">
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar acesso"}
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setCriado(null);
              setAberto(false);
            }}
          >
            Fechar
          </Button>
        </div>

        <p className="num text-xs text-muted-foreground mt-4">
          Cortesia de {criado.dias} dias · o e-mail já nasce confirmado, então dá para entrar
          imediatamente.
        </p>
      </Card>
    );
  }

  if (!aberto) {
    return (
      <Button variant="outline" className="gap-2" onClick={() => setAberto(true)}>
        <UserPlus className="h-4 w-4" /> Criar conta de convidado
      </Button>
    );
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="font-display text-lg font-semibold">Conta de convidado</div>
      <p className="text-sm text-muted-foreground mt-1">
        Cria o acesso na hora, com senha provisória. Use para demonstração, parceiro ou teste — quem
        compra pela Kiwify não passa por aqui.
      </p>

      <form onSubmit={enviar} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="convidado-email">E-mail</Label>
          <Input
            id="convidado-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="pessoa@escritorio.com.br"
            autoComplete="off"
            className="mt-1"
          />
        </div>

        <div>
          <Label htmlFor="convidado-nome">Nome da conta</Label>
          <Input
            id="convidado-nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            placeholder="Opcional — usa o e-mail se vazio"
            autoComplete="off"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="convidado-plano">Plano</Label>
            <Select value={plano} onValueChange={setPlano}>
              <SelectTrigger id="convidado-plano" className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {planos.map((p) => (
                  <SelectItem key={p.codigo} value={p.codigo}>
                    {p.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="convidado-dias">Dias</Label>
            <Input
              id="convidado-dias"
              type="number"
              min={1}
              max={365}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="mt-1"
            />
          </div>
        </div>

        <div className="sm:col-span-2 flex flex-wrap gap-2">
          <Button type="submit" disabled={salvando}>
            {salvando ? "Criando…" : "Criar acesso"}
          </Button>
          <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
            Cancelar
          </Button>
        </div>
      </form>
    </Card>
  );
}

function PrecoEditor({
  preco,
  onSalvar,
}: {
  preco: Record<string, any>;
  onSalvar: (valores: {
    rotulo: string;
    tipo: string;
    custo_entrada_mi_centavos: number;
    custo_saida_mi_centavos: number;
    custo_execucao_centavos: number;
  }) => void;
}) {
  const [form, setForm] = useState({
    rotulo: preco.rotulo ?? "",
    tipo: preco.tipo ?? "modelo",
    custo_entrada_mi_centavos: Number(preco.custo_entrada_mi_centavos ?? 0),
    custo_saida_mi_centavos: Number(preco.custo_saida_mi_centavos ?? 0),
    custo_execucao_centavos: Number(preco.custo_execucao_centavos ?? 0),
  });
  return (
    <Card className="p-4 sm:p-5">
      <div className="font-display font-semibold">
        {preco.rotulo} <span className="num text-xs text-muted-foreground">{preco.chave}</span>
      </div>
      <div className="grid gap-3 mt-3 sm:grid-cols-3">
        <div>
          <Label className="text-xs">Centavos por milhão de tokens de entrada</Label>
          <Input
            className="mt-1 h-9"
            type="number"
            value={form.custo_entrada_mi_centavos}
            onChange={(e) =>
              setForm({ ...form, custo_entrada_mi_centavos: Number(e.target.value) })
            }
          />
        </div>
        <div>
          <Label className="text-xs">Centavos por milhão de tokens de saída</Label>
          <Input
            className="mt-1 h-9"
            type="number"
            value={form.custo_saida_mi_centavos}
            onChange={(e) => setForm({ ...form, custo_saida_mi_centavos: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">Centavos por execução de coleta</Label>
          <Input
            className="mt-1 h-9"
            type="number"
            value={form.custo_execucao_centavos}
            onChange={(e) => setForm({ ...form, custo_execucao_centavos: Number(e.target.value) })}
          />
        </div>
      </div>
      <Button size="sm" className="mt-3" onClick={() => onSalvar(form)}>
        Salvar custo
      </Button>
    </Card>
  );
}
