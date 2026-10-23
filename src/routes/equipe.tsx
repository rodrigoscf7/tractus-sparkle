import { createFileRoute, Link, redirect, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ExternalLink, LogOut, MessageCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/estados";
import { Distribuicao, Kpi, Metrica } from "@/components/painel/metricas";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { getConversaChamado, getPainelEquipe, type EtapaLead } from "@/lib/equipe.functions";

/**
 * A área da equipe (social selling): contas, onboarding (o funil do quiz com a
 * lista de leads, e o onboarding do app) e suporte. Só leitura. Fica fora de
 * `_authenticated` porque quem trabalha aqui não é cliente: não tem conta nem
 * onboarding, e o gate do app mandaria para o wizard.
 */
export const Route = createFileRoute("/equipe")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (!data.user) throw redirect({ to: "/auth" });
    return { email: data.user.email ?? "" };
  },
  head: () => ({
    meta: [{ title: "Equipe | prevIA" }, { name: "robots", content: "noindex, nofollow" }],
  }),
  component: Equipe,
});

type Painel = Awaited<ReturnType<typeof getPainelEquipe>>;

const ETAPA: Record<EtapaLead, { rotulo: string; variante: "outline" | "secondary" | "default" }> =
  {
    quiz_incompleto: { rotulo: "Quiz incompleto", variante: "outline" },
    diagnostico: { rotulo: "Recebeu o diagnóstico", variante: "secondary" },
    comprou: { rotulo: "Comprou", variante: "default" },
  };

const SITUACAO: Record<string, string> = {
  ativa: "Ativa",
  trial: "Em teste",
  atrasada: "Pagamento pendente",
  cancelada: "Cancelada",
};

const ORIGEM: Record<string, string> = {
  hubla: "compra",
  kiwify: "compra",
  cortesia: "cortesia",
  manual: "manual",
};

const quando = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** wa.me exige DDI; o app guarda só os dígitos digitados (DDD + número). */
function linkWhatsapp(digitos: string) {
  const d = digitos.replace(/\D/g, "");
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
}

const ROTULO = "text-[11px] font-mono uppercase tracking-widest text-muted-foreground";

function BotaoWhatsapp({ numero }: { numero: string | null }) {
  if (!numero) return null;
  return (
    <Button asChild size="sm" variant="outline">
      <a href={linkWhatsapp(numero)} target="_blank" rel="noreferrer">
        <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
      </a>
    </Button>
  );
}

function Equipe() {
  const { email } = Route.useRouteContext();
  const router = useRouter();
  const carregar = useServerFn(getPainelEquipe);
  const {
    data: painel,
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery({ queryKey: ["painel-equipe"], queryFn: () => carregar(), retry: false });

  const abertos = painel?.chamados.filter((c) => c.status === "aberto").length ?? 0;

  async function sair() {
    await supabase.auth.signOut();
    router.navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-surface">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="h-6 w-auto" />
            <span className={ROTULO}>Equipe</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted-foreground sm:inline">{email}</span>
            {painel?.papel.admin && (
              <Button asChild variant="outline" size="sm">
                <Link to="/admin">Administração</Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={sair}>
              <LogOut className="mr-1.5 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {isLoading && <EstadoCarregando linhas={4} rotulo="Carregando a área da equipe" />}
        {isError && (
          <EstadoErro
            titulo="Não consegui abrir a área da equipe"
            descricao={error instanceof Error ? error.message : "Tente de novo em instantes."}
            onTentarDeNovo={() => refetch()}
          />
        )}
        {painel && (
          <Tabs defaultValue="onboarding">
            <TabsList>
              <TabsTrigger value="contas">Contas ({painel.contas.length})</TabsTrigger>
              <TabsTrigger value="onboarding">Onboarding</TabsTrigger>
              <TabsTrigger value="suporte">
                Suporte ({abertos} {abertos === 1 ? "aberto" : "abertos"})
              </TabsTrigger>
            </TabsList>
            <TabsContent value="contas" className="mt-5">
              <Contas contas={painel.contas} />
            </TabsContent>
            <TabsContent value="onboarding" className="mt-5">
              <Onboarding painel={painel} />
            </TabsContent>
            <TabsContent value="suporte" className="mt-5">
              <Suporte chamados={painel.chamados} />
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- CONTAS

function Contas({ contas }: { contas: Painel["contas"] }) {
  const [busca, setBusca] = useState("");
  const q = busca.trim().toLowerCase();
  const filtradas = contas.filter(
    (c) => !q || [c.nome, c.email].some((v) => v?.toLowerCase().includes(q)),
  );

  return (
    <div className="space-y-3">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou e-mail…"
        className="h-9 w-full sm:w-72"
      />
      {filtradas.map((c) => (
        <Card key={c.id} className="p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="font-display text-lg font-semibold truncate">{c.nome}</div>
              <div className="num mt-1 text-xs text-muted-foreground">
                {c.membros} membro(s) · desde {new Date(c.criadoEm).toLocaleDateString("pt-BR")}
                {c.email ? ` · ${c.email}` : ""}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {c.origem && <Badge variant="outline">{ORIGEM[c.origem] ?? c.origem}</Badge>}
              <Badge variant="secondary">
                {c.situacao ? (SITUACAO[c.situacao] ?? c.situacao) : "sem assinatura"}
              </Badge>
              {c.status !== "ativa" && <Badge variant="destructive">{c.status}</Badge>}
              <BotaoWhatsapp numero={c.whatsapp} />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className={ROTULO}>Plano</div>
              <div className="mt-1 text-sm">{c.plano}</div>
              <div className="mt-1 text-xs text-muted-foreground">
                Onboarding:{" "}
                {c.onboarding === "concluido"
                  ? "concluído"
                  : c.onboarding === "nao_iniciado"
                    ? "não iniciado"
                    : c.onboarding}
                {c.veioDoQuiz ? " · veio do quiz" : ""}
              </div>
            </div>
            <Metrica label="Roteiros" usado={c.uso["roteiro"] ?? 0} limite={c.limites.roteiro} />
            <Metrica
              label="Carrosséis"
              usado={c.uso["carrossel"] ?? 0}
              limite={c.limites.carrossel}
            />
            <Metrica
              label="Imagens de capa"
              usado={c.uso["imagem"] ?? 0}
              limite={c.limites.imagem}
            />
          </div>
        </Card>
      ))}
      {filtradas.length === 0 && (
        <EstadoVazio titulo="Nenhuma conta aqui" descricao="Mude a busca." />
      )}
    </div>
  );
}

// ---------------------------------------------------------------- ONBOARDING

function Onboarding({ painel }: { painel: Painel }) {
  const [parte, setParte] = useState<"quiz" | "app">("quiz");
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button
          size="sm"
          variant={parte === "quiz" ? "default" : "outline"}
          onClick={() => setParte("quiz")}
        >
          Quiz (leads)
        </Button>
        <Button
          size="sm"
          variant={parte === "app" ? "default" : "outline"}
          onClick={() => setParte("app")}
        >
          Onboarding do app (clientes)
        </Button>
      </div>
      {parte === "quiz" ? (
        <FunilQuiz quiz={painel.quiz} />
      ) : (
        <OnboardingApp onboarding={painel.onboarding} />
      )}
    </div>
  );
}

function FunilQuiz({ quiz }: { quiz: Painel["quiz"] }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi label="Começaram o quiz" valor={String(quiz.total)} />
        <Kpi
          label="Receberam o diagnóstico"
          valor={String(quiz.comDiagnostico)}
          detalhe={`${quiz.pctDiagnostico}% de quem começou`}
        />
        <Kpi
          label="Compraram"
          valor={String(quiz.compraram)}
          detalhe={`${quiz.pctCompraSobreDiagnostico}% de quem recebeu o diagnóstico`}
        />
      </div>

      <Card className="p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Onde as pessoas param
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Quantos chegaram a cada pergunta e quantos pararam nela sem terminar o quiz.
        </p>
        <div className="mt-4 space-y-3">
          {quiz.porPergunta.map((p) => (
            <div key={p.numero}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="min-w-0">
                  <span className="num text-muted-foreground">{p.numero}.</span> {p.titulo}
                </span>
                <span className="num shrink-0 text-muted-foreground">
                  {p.chegaram} · {p.pctChegaram}%
                  {p.pararam > 0 && (
                    <span className="text-destructive"> · {p.pararam} pararam</span>
                  )}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-md bg-secondary">
                <div className="h-full bg-primary" style={{ width: `${p.pctChegaram}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {quiz.distribuicoes.map((d) => (
          <Distribuicao key={d.titulo} titulo={d.titulo} itens={d.itens} total={d.total} />
        ))}
      </div>

      <Leads leads={quiz.leads} />
    </div>
  );
}

function Leads({ leads }: { leads: Painel["quiz"]["leads"] }) {
  const [etapa, setEtapa] = useState<EtapaLead | "todas">("todas");
  const [busca, setBusca] = useState("");

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return leads.filter(
      (l) =>
        (etapa === "todas" || l.etapa === etapa) &&
        (!q ||
          [l.nome, l.email, l.whatsapp, l.area, l.perfil].some((v) =>
            v?.toLowerCase().includes(q),
          )),
    );
  }, [leads, etapa, busca]);

  const contagem = (e: EtapaLead) => leads.filter((l) => l.etapa === e).length;

  return (
    <Card className="p-5">
      <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
        Leads do quiz
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["todas", "quiz_incompleto", "diagnostico", "comprou"] as const).map((e) => (
          <Button
            key={e}
            size="sm"
            variant={etapa === e ? "default" : "outline"}
            onClick={() => setEtapa(e)}
          >
            {e === "todas" ? `Todos (${leads.length})` : `${ETAPA[e].rotulo} (${contagem(e)})`}
          </Button>
        ))}
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por nome, e-mail, WhatsApp, área…"
          className="h-9 w-full sm:ml-auto sm:w-72"
        />
      </div>

      <div className="mt-4 space-y-2">
        {filtrados.map((l) => (
          <div key={l.id} className="rounded-md border border-border p-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{l.nome ?? "Sem nome"}</span>
                  <Badge variant={ETAPA[l.etapa].variante}>{ETAPA[l.etapa].rotulo}</Badge>
                  {l.parouNaPergunta && (
                    <Badge variant="outline" className="num">
                      parou na pergunta {l.parouNaPergunta}
                    </Badge>
                  )}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[l.area, l.situacao, l.perfil].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="num mt-1 text-xs text-muted-foreground">
                  {quando(l.criadoEm)}
                  {l.email ? ` · ${l.email}` : ""}
                  {l.origem ? ` · ${l.origem}` : ""}
                  {l.comprouEm ? ` · comprou em ${quando(l.comprouEm)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <BotaoWhatsapp numero={l.whatsapp} />
                {l.relatorio && (
                  <Button asChild size="sm" variant="outline">
                    <a href={l.relatorio} target="_blank" rel="noreferrer">
                      Relatório <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        ))}
        {filtrados.length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum lead com esse filtro.</p>
        )}
      </div>
    </Card>
  );
}

function OnboardingApp({ onboarding }: { onboarding: Painel["onboarding"] }) {
  const total = onboarding.concluidos;
  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Kpi
          label="Onboardings iniciados"
          valor={String(onboarding.iniciados)}
          detalhe={`${onboarding.concluidos} concluídos`}
        />
        <Kpi
          label="Conclusão do wizard"
          valor={`${onboarding.conversao_pct}%`}
          alerta={onboarding.iniciados > 0 && onboarding.conversao_pct < 70}
        />
        <Kpi label="Em aberto" valor={String(onboarding.iniciados - onboarding.concluidos)} />
      </div>

      <Card className="p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Onde as pessoas param
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Contas que abriram o wizard e não terminaram, pelo passo em que estavam.
        </p>
        <div className="mt-4 space-y-2">
          {onboarding.abandono_por_passo.map((p) => (
            <div key={p.passo} className="num flex justify-between gap-3 text-sm">
              <span>Passo {p.passo}</span>
              <span className={p.quantidade > 0 ? "" : "text-muted-foreground"}>
                {p.quantidade}
              </span>
            </div>
          ))}
        </div>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Distribuicao titulo="Como conheceram a prevIA" itens={onboarding.origem} total={total} />
        <Distribuicao titulo="Área de atuação" itens={onboarding.area} total={total} />
        <Distribuicao titulo="Situação declarada" itens={onboarding.situacao} total={total} />
        <Distribuicao titulo="Tamanho do escritório" itens={onboarding.tamanho} total={total} />
        <Distribuicao titulo="Tráfego pago" itens={onboarding.trafego} total={total} />
        <Distribuicao titulo="Onde já publicam" itens={onboarding.canais} total={total} />
      </div>

      <Card className="p-5">
        <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Respostas por conta
        </div>
        <div className="mt-4 space-y-2">
          {onboarding.contas.map((c) => (
            <div
              key={c.conta_id}
              className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border p-3"
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
                <span className="basis-full text-sm text-muted-foreground">“{c.situacao}”</span>
              )}
            </div>
          ))}
          {onboarding.contas.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Nenhuma conta passou pelo onboarding ainda.
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------- SUPORTE

function Suporte({ chamados }: { chamados: Painel["chamados"] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  if (chamados.length === 0) {
    return (
      <EstadoVazio
        titulo="Nenhum chamado ainda"
        descricao="Os pedidos de atendimento humano aparecem aqui."
      />
    );
  }
  return (
    <div className="space-y-2">
      {chamados.map((ch) => (
        <Card key={ch.id} className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-display font-semibold">{ch.conta}</span>
                <Badge variant={ch.status === "aberto" ? "destructive" : "outline"}>
                  {ch.status === "aberto" ? "Aberto" : "Resolvido"}
                </Badge>
              </div>
              <p className="mt-1 text-sm">{ch.resumo}</p>
              <div className="num mt-1 text-xs text-muted-foreground">
                {quando(ch.criadoEm)}
                {ch.email ? ` · ${ch.email}` : ""}
                {ch.resolvidoEm ? ` · resolvido em ${quando(ch.resolvidoEm)}` : ""}
              </div>
            </div>
            {ch.conversaId && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setAberta(aberta === ch.id ? null : ch.id)}
              >
                {aberta === ch.id ? "Fechar conversa" : "Ver conversa"}
              </Button>
            )}
          </div>
          {aberta === ch.id && ch.conversaId && <Conversa conversaId={ch.conversaId} />}
        </Card>
      ))}
    </div>
  );
}

function Conversa({ conversaId }: { conversaId: string }) {
  const carregar = useServerFn(getConversaChamado);
  const { data: mensagens, isLoading } = useQuery({
    queryKey: ["conversa-chamado", conversaId],
    queryFn: () => carregar({ data: { conversaId } }),
  });
  if (isLoading)
    return <p className="mt-3 text-sm text-muted-foreground">Carregando a conversa…</p>;
  return (
    <div className="mt-4 space-y-2 border-t border-border pt-4">
      {(mensagens ?? []).map((m) => (
        <div
          key={m.id}
          className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
            m.papel === "usuario"
              ? "ml-auto bg-secondary"
              : "bg-surface-elevated text-muted-foreground"
          }`}
        >
          <div className="mb-0.5 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
            {m.papel === "usuario" ? "Cliente" : "Assistente"} · {quando(m.criadoEm)}
          </div>
          <p className="whitespace-pre-wrap">{m.conteudo}</p>
        </div>
      ))}
    </div>
  );
}
