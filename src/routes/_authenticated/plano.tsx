import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import {
  ArrowRight,
  Check,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EstadoCarregando, EstadoErro } from "@/components/estados";
import { mensagemErro } from "@/lib/mensagem-erro";
import { usePlanoAtual, type PlanoAtual } from "@/hooks/use-plano";
import {
  ETAPA_DO_PLANO,
  PLANO_EM_ANDAMENTO,
  type PautaPlano,
  type RelatorioPlano,
  type StatusPlano,
} from "@/lib/plano";
import { aprovarPlano, removerPauta, solicitarPlano, trocarPauta } from "@/lib/plano.functions";

export const Route = createFileRoute("/_authenticated/plano")({
  head: () => ({
    meta: [
      { title: "Plano da semana | prevIA" },
      {
        name: "description",
        content: "Os vídeos da sua semana, modelados nos posts que mais performaram no seu nicho.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PlanoPage,
});

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dataCurta = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]}`;
};
const vezes = (n: number) => `${n.toFixed(1).replace(".", ",")}x`;
const FORMATO = { reel: "Reel", carrossel: "Carrossel", imagem: "Imagem" } as const;

function PlanoPage() {
  const { data: plano, isLoading, isError, refetch } = usePlanoAtual();

  return (
    <div className="p-4 sm:p-8 max-w-[860px] space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Plano da semana</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-[62ch]">
          A prevIA assiste aos posts que mais performaram nos perfis que você acompanha, entende por
          que funcionaram e transforma isso em um vídeo para cada dia do seu ritmo.
        </p>
      </header>

      {isLoading && <EstadoCarregando linhas={3} rotulo="Carregando seu plano" />}
      {isError && (
        <EstadoErro titulo="Não consegui carregar seu plano" onTentarDeNovo={() => refetch()} />
      )}
      {!isLoading && !isError && <ConteudoDoPlano plano={plano ?? null} />}
    </div>
  );
}

function ConteudoDoPlano({ plano }: { plano: PlanoAtual | null }) {
  if (!plano) return <SemPlano />;
  if (PLANO_EM_ANDAMENTO.includes(plano.status)) return <PlanoEmAndamento status={plano.status} />;
  if (plano.status === "erro" || !plano.relatorio) return <PlanoComErro />;
  return <PlanoPronto plano={plano} relatorio={plano.relatorio} />;
}

function usePedirPlano() {
  const queryClient = useQueryClient();
  const pedir = useServerFn(solicitarPlano);
  return useMutation({
    mutationFn: () => pedir(),
    onSuccess: () => {
      toast.success("Pedido feito. Seu plano fica pronto em alguns minutos.");
      queryClient.invalidateQueries({ queryKey: ["plano-atual"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não consegui pedir seu plano.")),
  });
}

function SemPlano() {
  const pedir = usePedirPlano();
  return (
    <Card className="p-5 sm:p-6 bg-surface border-border">
      <h2 className="font-display font-bold text-xl">Você ainda não tem um plano</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-[60ch]">
        Todo domingo a prevIA monta o plano da semana seguinte. Se não quiser esperar, peça agora:
        leva uns 5 minutos e você é avisado quando ficar pronto.
      </p>
      <Button className="mt-5" onClick={() => pedir.mutate()} disabled={pedir.isPending}>
        {pedir.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Sparkles className="w-4 h-4 mr-2" />
        )}
        Montar meu plano agora
      </Button>
    </Card>
  );
}

function PlanoComErro() {
  const pedir = usePedirPlano();
  return (
    <Card className="p-5 sm:p-6 bg-surface border-border">
      <h2 className="font-display font-bold text-xl">Não consegui montar seu plano</h2>
      <p className="text-sm text-muted-foreground mt-2 max-w-[60ch]">
        Os perfis que você acompanha não puderam ser lidos agora (perfil privado, nome digitado
        errado ou instabilidade do Instagram). Confira suas referências e tente de novo.
      </p>
      <div className="flex flex-wrap gap-2 mt-5">
        <Button onClick={() => pedir.mutate()} disabled={pedir.isPending}>
          {pedir.isPending ? (
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4 mr-2" />
          )}
          Tentar de novo
        </Button>
        <Button variant="outline" asChild>
          <Link to="/perfis">Conferir minhas referências</Link>
        </Button>
      </div>
    </Card>
  );
}

const PASSOS: StatusPlano[] = ["coletando", "analisando", "planejando"];

function PlanoEmAndamento({ status }: { status: StatusPlano }) {
  const atual = PASSOS.indexOf(status);
  return (
    <Card className="p-5 sm:p-6 bg-surface border-primary/50">
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
        <Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />
        Montando seu plano
      </div>
      <ol className="space-y-3">
        {PASSOS.map((passo, i) => (
          <li key={passo} className="flex items-start gap-3">
            <span
              className={`mt-0.5 grid place-items-center w-6 h-6 rounded-full text-xs font-mono shrink-0 ${
                i < atual
                  ? "bg-primary text-primary-foreground"
                  : i === atual
                    ? "border-2 border-primary text-foreground"
                    : "border border-border text-muted-foreground"
              }`}
            >
              {i < atual ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={i === atual ? "font-medium" : "text-muted-foreground"}>
              {ETAPA_DO_PLANO[passo]}
            </span>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground mt-5">
        Leva uns 5 minutos. Pode sair desta tela: você é avisado quando ficar pronto.
      </p>
    </Card>
  );
}

function PlanoPronto({ plano, relatorio }: { plano: PlanoAtual; relatorio: RelatorioPlano }) {
  const queryClient = useQueryClient();
  const aprovar = useServerFn(aprovarPlano);
  const editavel = plano.status === "pronto";
  const mantidas = relatorio.pautas.filter((p) => !p.removida).length;

  const aprovacao = useMutation({
    mutationFn: () => aprovar({ data: { planoId: plano.id } }),
    onSuccess: (r) => {
      toast.success(
        r.jaAprovado
          ? "Este plano já estava aprovado."
          : `Aprovado. A prevIA já está escrevendo ${r.pautas} roteiro(s).`,
      );
      queryClient.invalidateQueries({ queryKey: ["plano-atual"] });
      queryClient.invalidateQueries({ queryKey: ["plano-pautas", plano.id] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não consegui aprovar o plano.")),
  });

  const primeiro = relatorio.dias[0]?.data;
  const ultimo = relatorio.dias[relatorio.dias.length - 1]?.data;

  return (
    <div className="space-y-8">
      <section className="rounded-xl bg-primary/20 p-5">
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          {primeiro && ultimo
            ? `Semana de ${dataCurta(primeiro)} a ${dataCurta(ultimo)}`
            : "Sua semana"}
        </div>
        <p className="leading-relaxed">{relatorio.resumo_da_semana}</p>
      </section>

      {plano.status === "aprovado" && <AvisoAprovado />}

      <section className="space-y-3">
        <h2 className="font-display font-bold text-lg">Seus vídeos da semana</h2>
        {relatorio.pautas.map((pauta, i) => (
          <PautaCard
            key={`${pauta.data}-${i}`}
            planoId={plano.id}
            indice={i}
            pauta={pauta}
            editavel={editavel}
          />
        ))}
      </section>

      {editavel && (
        <div className="sticky bottom-0 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-background/95 backdrop-blur border-t border-border sm:border-0 sm:bg-transparent">
          <Button
            size="lg"
            className="w-full sm:w-auto"
            onClick={() => aprovacao.mutate()}
            disabled={aprovacao.isPending || mantidas === 0}
          >
            {aprovacao.isPending ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Check className="w-4 h-4 mr-2" />
            )}
            {mantidas === 1 ? "Aprovar 1 vídeo" : `Aprovar ${mantidas} vídeos`}
          </Button>
          <p className="text-xs text-muted-foreground mt-2">
            Cada vídeo aprovado vira um roteiro completo. Você lê e aprova cada roteiro antes de
            gravar.
          </p>
        </div>
      )}

      {plano.status === "aprovado" && <PautasEmProducao planoId={plano.id} />}

      {relatorio.padroes.length > 0 && (
        <section className="space-y-3">
          <h2 className="font-display font-bold text-lg">Os padrões por trás dos virais</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {relatorio.padroes.map((p) => (
              <Card
                key={p.nome}
                className="p-4 bg-surface border-border border-t-2 border-t-primary"
              >
                <h3 className="font-display font-semibold">{p.nome}</h3>
                <p className="text-sm mt-1.5">{p.o_que_e}</p>
                <p className="text-sm text-muted-foreground mt-1.5">{p.como_usar}</p>
                {p.evidencias?.length > 0 && (
                  <p className="text-xs font-mono text-muted-foreground mt-2">
                    Visto nos posts {p.evidencias.join(", ")}
                  </p>
                )}
              </Card>
            ))}
          </div>
        </section>
      )}

      <PostsAnalisados relatorio={relatorio} />
    </div>
  );
}

function AvisoAprovado() {
  return (
    <Card className="p-4 bg-surface border-primary/50 flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm">
        <strong>Plano aprovado.</strong> A prevIA está escrevendo os roteiros, um de cada vez. Você
        é avisado quando cada um ficar pronto para ler.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link to="/hoje">
          Ir para Hoje <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </Button>
    </Card>
  );
}

function PautaCard({
  planoId,
  indice,
  pauta,
  editavel,
}: {
  planoId: string;
  indice: number;
  pauta: PautaPlano;
  editavel: boolean;
}) {
  const queryClient = useQueryClient();
  const remover = useServerFn(removerPauta);
  const trocar = useServerFn(trocarPauta);
  const [trocando, setTrocando] = useState(false);
  const [pedido, setPedido] = useState("");

  const alternarRemocao = useMutation({
    mutationFn: () => remover({ data: { planoId, indice, removida: !pauta.removida } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["plano-atual"] }),
    onError: (e: Error) => toast.error(mensagemErro(e, "Não consegui salvar.")),
  });

  const troca = useMutation({
    mutationFn: () => trocar({ data: { planoId, indice, pedido } }),
    onSuccess: () => {
      toast.success("Pronto, trocado.");
      setTrocando(false);
      setPedido("");
      queryClient.invalidateQueries({ queryKey: ["plano-atual"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não consegui trocar agora.")),
  });

  return (
    <Card
      className={`overflow-hidden bg-surface border-border grid sm:grid-cols-[92px_minmax(0,1fr)] ${
        pauta.removida ? "opacity-60" : ""
      }`}
    >
      <div className="bg-foreground text-background px-4 py-2 sm:py-4 flex sm:flex-col items-center sm:justify-center gap-2 sm:gap-0.5">
        <span className="font-display font-bold capitalize">{pauta.dia}</span>
        <span className="text-xs font-mono opacity-75 num">{dataCurta(pauta.data)}</span>
      </div>

      <div className="p-4 sm:p-5 min-w-0">
        {pauta.removida && (
          <p className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
            Fora da semana
          </p>
        )}
        <h3 className="font-display font-semibold text-lg leading-snug">{pauta.tema}</h3>
        <p className="text-sm text-muted-foreground mt-1">{pauta.angulo}</p>

        <blockquote className="mt-3 rounded-lg bg-muted px-4 py-3">
          <span className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Primeiros 3 segundos
          </span>
          <span className="font-display font-semibold leading-snug">“{pauta.gancho}”</span>
        </blockquote>

        {pauta.estrutura?.length > 0 && (
          <ol className="mt-3 space-y-1.5 list-decimal pl-5 text-sm marker:text-muted-foreground marker:font-mono">
            {pauta.estrutura.map((bloco, i) => {
              const [rotulo, ...resto] = bloco.split(":");
              return (
                <li key={i}>
                  {resto.length ? (
                    <>
                      <span className="font-semibold">{rotulo}:</span> {resto.join(":").trim()}
                    </>
                  ) : (
                    bloco
                  )}
                </li>
              );
            })}
          </ol>
        )}

        <p className="text-xs text-muted-foreground mt-3">
          Modelado no post {pauta.inspirado_em} · {pauta.por_que_vai_funcionar}
        </p>

        {editavel && !trocando && (
          <div className="flex flex-wrap gap-2 mt-4">
            {!pauta.removida && (
              <Button variant="outline" size="sm" onClick={() => setTrocando(true)}>
                <RefreshCw className="w-4 h-4 mr-1.5" /> Trocar
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => alternarRemocao.mutate()}
              disabled={alternarRemocao.isPending}
            >
              {pauta.removida ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-1.5" /> Manter na semana
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-1.5" /> Tirar da semana
                </>
              )}
            </Button>
          </div>
        )}

        {editavel && trocando && (
          <div className="mt-4 space-y-2">
            <label htmlFor={`pedido-${indice}`} className="text-sm font-medium">
              Quer algo específico? (opcional)
            </label>
            <Textarea
              id={`pedido-${indice}`}
              value={pedido}
              onChange={(e) => setPedido(e.target.value)}
              maxLength={300}
              rows={2}
              placeholder="Ex.: falar de revisão da vida toda, ou algo mais leve para sexta"
            />
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => troca.mutate()} disabled={troca.isPending}>
                {troca.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Gerando outra opção…
                  </>
                ) : (
                  "Gerar outra opção"
                )}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setTrocando(false)}
                disabled={troca.isPending}
              >
                Cancelar
              </Button>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

const STATUS_PAUTA: Record<string, string> = {
  gerada: "Na fila",
  em_producao: "Escrevendo o roteiro",
  aguardando_aprovacao: "Roteiro pronto para você ler",
  aprovada: "Roteiro aprovado",
  rejeitada: "Roteiro recusado",
};

/** Depois de aprovado: onde está cada vídeo no caminho até virar roteiro. */
function PautasEmProducao({ planoId }: { planoId: string }) {
  const { data: pautas } = useQuery({
    queryKey: ["plano-pautas", planoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pautas_geradas")
        .select("id, tema, status, data_prevista")
        .eq("plano_semanal_id", planoId)
        .order("data_prevista");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  if (!pautas?.length) return null;

  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold text-lg">Roteiros</h2>
      <div className="space-y-2">
        {pautas.map((p) => {
          const pronto = p.status === "aguardando_aprovacao" || p.status === "aprovada";
          const conteudo = (
            <>
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">{p.tema}</span>
                <span className="block text-xs text-muted-foreground">
                  {p.data_prevista ? `${dataCurta(p.data_prevista)} · ` : ""}
                  {STATUS_PAUTA[p.status ?? ""] ?? p.status}
                </span>
              </span>
              {pronto && <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground" />}
            </>
          );
          return pronto ? (
            <Link
              key={p.id}
              to="/aprovacao/$pautaId"
              params={{ pautaId: p.id }}
              className="flex items-center justify-between gap-3 min-h-14 px-4 rounded-lg border border-border bg-surface hover:border-primary/40"
            >
              {conteudo}
            </Link>
          ) : (
            <div
              key={p.id}
              className="flex items-center justify-between gap-3 min-h-14 px-4 rounded-lg border border-border bg-surface"
            >
              {conteudo}
            </div>
          );
        })}
      </div>
    </section>
  );
}

function PostsAnalisados({ relatorio }: { relatorio: RelatorioPlano }) {
  if (!relatorio.posts?.length) return null;
  return (
    <section className="space-y-3">
      <h2 className="font-display font-bold text-lg">Os posts que analisamos</h2>
      <p className="text-sm text-muted-foreground max-w-[64ch]">
        Escolhidos entre os últimos posts de cada perfil que você acompanha, pelo quanto foram acima
        do normal do próprio perfil. Cada reel foi assistido inteiro e cada carrossel foi lido slide
        por slide.
      </p>
      <ol className="space-y-2">
        {relatorio.posts.map((post) => (
          <li key={post.numero}>
            <Card className="p-4 bg-surface border-border min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="grid place-items-center w-6 h-6 rounded-md bg-foreground text-background text-xs font-mono">
                  {post.numero}
                </span>
                <a
                  href={post.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:underline inline-flex items-center gap-1 break-all"
                >
                  @{post.handle} <ExternalLink className="w-3.5 h-3.5" />
                </a>
                <span className="text-[11px] font-mono uppercase tracking-wider border border-border rounded-full px-2 py-0.5 text-muted-foreground">
                  {FORMATO[post.formato] ?? post.formato}
                </span>
                <span className="ml-auto text-sm">
                  <strong className="bg-primary text-primary-foreground px-1.5 py-0.5 rounded font-mono num">
                    {vezes(post.indice)}
                  </strong>{" "}
                  acima do normal
                </span>
              </div>
              {post.gancho && <p className="font-display font-semibold mt-3">“{post.gancho}”</p>}
              {post.porque_funcionou && <p className="text-sm mt-1.5">{post.porque_funcionou}</p>}
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}
