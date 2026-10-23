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
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { getConversaChamado, getPainelEquipe, type EtapaLead } from "@/lib/equipe.functions";

/**
 * A área da equipe (social selling): leads do quiz, contas, onboarding e
 * suporte, só leitura. Fica fora de `_authenticated` porque quem trabalha aqui
 * não é cliente: não tem conta nem onboarding, e o gate do app mandaria para o
 * wizard. Quem não é `comercial` nem `admin` vê "acesso restrito".
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

const data = (iso: string | null) =>
  iso
    ? new Date(iso).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

/** wa.me exige DDI; o quiz guarda só os dígitos digitados (DDD + número). */
function linkWhatsapp(digitos: string) {
  const d = digitos.replace(/\D/g, "");
  return `https://wa.me/${d.length <= 11 ? `55${d}` : d}`;
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
  } = useQuery({
    queryKey: ["painel-equipe"],
    queryFn: () => carregar(),
    retry: false,
  });

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
            <span className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Equipe
            </span>
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
        {isLoading && <EstadoCarregando linhas={4} rotulo="Carregando leads e contas" />}
        {isError && (
          <EstadoErro
            titulo="Não consegui abrir a área da equipe"
            descricao={error instanceof Error ? error.message : "Tente de novo em instantes."}
            onTentarDeNovo={() => refetch()}
          />
        )}
        {painel && (
          <Tabs defaultValue="leads">
            <TabsList>
              <TabsTrigger value="leads">Leads do quiz ({painel.leads.length})</TabsTrigger>
              <TabsTrigger value="contas">Contas ({painel.contas.length})</TabsTrigger>
              <TabsTrigger value="suporte">
                Suporte ({painel.chamados.filter((c) => c.status === "aberto").length} abertos)
              </TabsTrigger>
            </TabsList>
            <TabsContent value="leads" className="mt-5">
              <Leads leads={painel.leads} />
            </TabsContent>
            <TabsContent value="contas" className="mt-5">
              <Contas contas={painel.contas} />
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

type Painel = Awaited<ReturnType<typeof getPainelEquipe>>;

function Leads({ leads }: { leads: Painel["leads"] }) {
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
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
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
          className="ml-auto h-9 w-full sm:w-72"
        />
      </div>

      {filtrados.length === 0 && (
        <EstadoVazio titulo="Nenhum lead aqui" descricao="Mude o filtro ou a busca." />
      )}

      <div className="space-y-2">
        {filtrados.map((l) => (
          <Card key={l.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{l.nome ?? "Sem nome"}</span>
                  <Badge variant={ETAPA[l.etapa].variante}>{ETAPA[l.etapa].rotulo}</Badge>
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  {[l.area, l.situacao, l.perfil].filter(Boolean).join(" · ") || "—"}
                </div>
                <div className="num mt-1 text-xs text-muted-foreground">
                  {data(l.criadoEm)}
                  {l.email ? ` · ${l.email}` : ""}
                  {l.origem ? ` · ${l.origem}` : ""}
                  {l.comprouEm ? ` · comprou em ${data(l.comprouEm)}` : ""}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {l.whatsapp && (
                  <Button asChild size="sm" variant="outline">
                    <a href={linkWhatsapp(l.whatsapp)} target="_blank" rel="noreferrer">
                      <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                )}
                {l.relatorio && (
                  <Button asChild size="sm" variant="outline">
                    <a href={l.relatorio} target="_blank" rel="noreferrer">
                      Relatório <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function Contas({ contas }: { contas: Painel["contas"] }) {
  const [busca, setBusca] = useState("");
  const filtradas = contas.filter((c) => {
    const q = busca.trim().toLowerCase();
    return !q || [c.nome, c.email].some((v) => v?.toLowerCase().includes(q));
  });

  return (
    <div className="space-y-4">
      <Input
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
        placeholder="Buscar por nome ou e-mail…"
        className="h-9 w-full sm:w-72"
      />
      <div className="space-y-2">
        {filtradas.map((c) => (
          <Card key={c.id} className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-display font-semibold">{c.nome}</span>
                  <Badge variant="outline">{c.plano}</Badge>
                  {c.situacao && (
                    <Badge variant={c.situacao === "ativa" ? "default" : "secondary"}>
                      {SITUACAO[c.situacao] ?? c.situacao}
                    </Badge>
                  )}
                  {c.status !== "ativa" && <Badge variant="destructive">Conta {c.status}</Badge>}
                </div>
                <div className="mt-1 text-sm text-muted-foreground">
                  Onboarding:{" "}
                  {c.onboarding === "concluido"
                    ? "concluído"
                    : c.onboarding === "nao_iniciado"
                      ? "não iniciado"
                      : c.onboarding}
                  {c.veioDoQuiz ? " · veio do quiz" : ""}
                  {c.origemAssinatura ? ` · origem: ${c.origemAssinatura}` : ""}
                </div>
                <div className="num mt-1 text-xs text-muted-foreground">
                  Entrou em {data(c.criadoEm)}
                  {c.email ? ` · ${c.email}` : ""}
                </div>
              </div>
              {c.whatsapp && (
                <Button asChild size="sm" variant="outline">
                  <a href={linkWhatsapp(c.whatsapp)} target="_blank" rel="noreferrer">
                    <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                  </a>
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

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
                {data(ch.criadoEm)}
                {ch.email ? ` · ${ch.email}` : ""}
                {ch.resolvidoEm ? ` · resolvido em ${data(ch.resolvidoEm)}` : ""}
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
            {m.papel === "usuario" ? "Cliente" : "Assistente"} · {data(m.criadoEm)}
          </div>
          <p className="whitespace-pre-wrap">{m.conteudo}</p>
        </div>
      ))}
    </div>
  );
}
