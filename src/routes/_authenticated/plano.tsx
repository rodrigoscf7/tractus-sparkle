import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Circle,
  Copy,
  ExternalLink,
  FileText,
  Loader2,
  Minus,
  PenLine,
  RefreshCw,
  RotateCcw,
  Sparkles,
  Trash2,
  Video,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { EstadoCarregando, EstadoErro } from "@/components/estados";
import { BotaoCarrossel } from "@/components/roteiro/BotaoCarrossel";
import { BotaoPostado } from "@/components/roteiro/BotaoPostado";
import { copiarTexto } from "@/lib/copiar";
import { dataCurta, diaDaSemana } from "@/lib/datas";
import { mensagemErro } from "@/lib/mensagem-erro";
import { etapaDoRoteiro, roteiroMaisRecente, textoDoRoteiro, type Etapa } from "@/lib/roteiro";
import { cn } from "@/lib/utils";
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

const vezes = (n: number) => `${n.toFixed(1).replace(".", ",")}x`;
const FORMATO = { reel: "Reel", carrossel: "Carrossel", imagem: "Imagem" } as const;

function PlanoPage() {
  const { data: plano, isLoading, isError, refetch } = usePlanoAtual();

  return (
    <div className="p-4 sm:p-8 max-w-[860px] space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Plano da semana</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-[62ch]">
          Um vídeo para cada dia do seu ritmo, modelado nos posts que mais performaram no seu nicho.
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

/** O roteiro que nasceu de cada vídeo do plano, depois da aprovação. */
type PautaGerada = {
  id: string;
  tema: string | null;
  status: string | null;
  data_prevista: string | null;
  publicacoes: { status: string | null }[];
  carrosseis: { id: string; status: string | null }[];
  roteiros: { conteudo: unknown; criado_em: string | null }[];
};

function usePautasDoPlano(planoId: string, aprovado: boolean) {
  return useQuery({
    queryKey: ["plano-pautas", planoId],
    enabled: aprovado,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pautas_geradas")
        .select(
          "id, tema, status, data_prevista, publicacoes(status), carrosseis(id, status), roteiros(conteudo, criado_em)",
        )
        .eq("plano_semanal_id", planoId);
      if (error) throw error;
      return (data ?? []) as unknown as PautaGerada[];
    },
    // Os roteiros são escritos um de cada vez: a tela acompanha sem recarregar.
    refetchInterval: 30_000,
  });
}

/** A aprovação cria uma pauta por vídeo, com a mesma data e o mesmo tema. */
function pautaGeradaDe(video: PautaPlano, geradas: PautaGerada[]) {
  const doDia = geradas.filter((g) => g.data_prevista === video.data);
  return doDia.find((g) => g.tema === video.tema) ?? (doDia.length === 1 ? doDia[0] : undefined);
}

type Estado = { rotulo: string; curto: string; icone: ReactNode; acao?: boolean };

/** Ícone e texto, nunca só cor: cada estado se lê sem depender do amarelo. */
const ESTADO_DA_ETAPA: Record<Etapa, Estado> = {
  escrevendo: {
    rotulo: "A prevIA está escrevendo o roteiro",
    curto: "Escrevendo",
    icone: <PenLine className="w-3.5 h-3.5" />,
  },
  "para-ler": {
    rotulo: "Roteiro pronto para você ler",
    curto: "Para ler",
    icone: <FileText className="w-3.5 h-3.5" />,
    acao: true,
  },
  "para-gravar": {
    rotulo: "Pronto para gravar",
    curto: "Gravar",
    icone: <Video className="w-3.5 h-3.5" />,
    acao: true,
  },
  postados: { rotulo: "Postado", curto: "Postado", icone: <Check className="w-3.5 h-3.5" /> },
  recusados: {
    rotulo: "Roteiro recusado",
    curto: "Recusado",
    icone: <X className="w-3.5 h-3.5" />,
  },
};

const FORA_DA_SEMANA: Estado = {
  rotulo: "Fora da semana",
  curto: "Fora",
  icone: <Minus className="w-3.5 h-3.5" />,
};

function estadoDoVideo(video: PautaPlano, aprovado: boolean, gerada?: PautaGerada): Estado {
  if (video.removida) return FORA_DA_SEMANA;
  if (!aprovado) {
    return { rotulo: "No plano", curto: "No plano", icone: <Circle className="w-3.5 h-3.5" /> };
  }
  const etapa = gerada ? etapaDoRoteiro(gerada.status, gerada.publicacoes) : "escrevendo";
  return ESTADO_DA_ETAPA[etapa ?? "escrevendo"];
}

const plural = (n: number, um: string, varios: string) => (n === 1 ? `1 ${um}` : `${n} ${varios}`);

function PlanoPronto({ plano, relatorio }: { plano: PlanoAtual; relatorio: RelatorioPlano }) {
  const queryClient = useQueryClient();
  const aprovar = useServerFn(aprovarPlano);
  const editavel = plano.status === "pronto";
  const aprovado = plano.status === "aprovado";
  const mantidas = relatorio.pautas.filter((p) => !p.removida).length;
  const { data: geradas = [] } = usePautasDoPlano(plano.id, aprovado);

  const videos = relatorio.pautas.map((pauta, indice) => ({
    pauta,
    indice,
    gerada: aprovado ? pautaGeradaDe(pauta, geradas) : undefined,
  }));

  const aprovacao = useMutation({
    mutationFn: () => aprovar({ data: { planoId: plano.id } }),
    onSuccess: (r) => {
      toast.success(
        r.jaAprovado
          ? "Este plano já estava aprovado."
          : `Aprovado. A prevIA já está escrevendo ${plural(r.pautas, "roteiro", "roteiros")}.`,
      );
      queryClient.invalidateQueries({ queryKey: ["plano-atual"] });
      queryClient.invalidateQueries({ queryKey: ["plano-pautas", plano.id] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não consegui aprovar o plano.")),
  });

  /** Um texto só com os roteiros da semana, dia a dia, para colar onde a pessoa grava. */
  function copiarSemana() {
    let prontos = 0;
    let escrevendo = 0;
    const partes: string[] = [];
    for (const { pauta, gerada } of videos) {
      if (pauta.removida) continue;
      const titulo = `${diaDaSemana(pauta.data).toUpperCase()} ${dataCurta(pauta.data)} — ${pauta.tema}`;
      const texto = gerada ? textoDoRoteiro(roteiroMaisRecente(gerada.roteiros)?.conteudo) : null;
      if (texto) {
        prontos++;
        partes.push(`${titulo}\n\n${texto.completo}`);
      } else {
        escrevendo++;
        partes.push(`${titulo}\n\n(ainda sendo escrito)`);
      }
    }
    if (prontos === 0) {
      toast.info("Nenhum roteiro escrito ainda. Você é avisado quando o primeiro ficar pronto.");
      return;
    }
    copiarTexto(
      partes.join("\n\n————————\n\n"),
      escrevendo
        ? `${plural(prontos, "roteiro copiado", "roteiros copiados")}. ${plural(escrevendo, "ainda está sendo escrito", "ainda estão sendo escritos")}.`
        : `${plural(prontos, "roteiro copiado", "roteiros da semana copiados")}.`,
    );
  }

  const primeiro = relatorio.dias[0]?.data;
  const ultimo = relatorio.dias[relatorio.dias.length - 1]?.data;

  return (
    <div className="space-y-6">
      <section className="rounded-xl bg-primary/20 p-5">
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
          {primeiro && ultimo
            ? `Semana de ${dataCurta(primeiro)} a ${dataCurta(ultimo)}`
            : "Sua semana"}
        </div>
        <ResumoDaSemana texto={relatorio.resumo_da_semana} />
      </section>

      {aprovado && <AvisoAprovado />}

      <FaixaDaSemana videos={videos} aprovado={aprovado} />

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display font-bold text-lg">Seus vídeos da semana</h2>
          {aprovado && (
            <Button variant="outline" size="sm" onClick={copiarSemana}>
              <Copy className="w-4 h-4 mr-1.5" /> Copiar a semana
            </Button>
          )}
        </div>
        {videos.map(({ pauta, indice, gerada }) => (
          <CartaoVideo
            key={`${pauta.data}-${indice}`}
            planoId={plano.id}
            indice={indice}
            pauta={pauta}
            editavel={editavel}
            aprovado={aprovado}
            gerada={gerada}
          />
        ))}
      </section>

      {/* No celular, fica logo acima da barra de navegação (56px + borda + área segura). */}
      {editavel && (
        <div className="sticky bottom-[calc(57px+env(safe-area-inset-bottom,0px))] md:bottom-0 z-10 -mx-4 sm:mx-0 px-4 sm:px-0 py-3 bg-background/95 backdrop-blur border-t border-border sm:border-0 sm:bg-transparent">
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
            Cada vídeo aprovado vira um roteiro completo. Você lê cada roteiro antes de gravar.
          </p>
        </div>
      )}

      <PorQueEssesVideos relatorio={relatorio} />
    </div>
  );
}

/** O resumo é contexto, não tarefa: três linhas e o resto sob demanda. */
function ResumoDaSemana({ texto }: { texto: string }) {
  const [inteiro, setInteiro] = useState(false);
  const longo = texto.length > 260;
  return (
    <div>
      <p className={cn("leading-relaxed", longo && !inteiro && "line-clamp-3")}>{texto}</p>
      {longo && (
        <button
          type="button"
          onClick={() => setInteiro((v) => !v)}
          aria-expanded={inteiro}
          className="mt-1.5 text-sm font-medium underline underline-offset-2 decoration-foreground/30 hover:decoration-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {inteiro ? "Ler menos" : "Ler o resumo inteiro"}
        </button>
      )}
    </div>
  );
}

/**
 * A semana num relance: um cartão por dia, no mesmo bloco escuro dos cartões
 * de vídeo, com o estado embaixo. Tocar leva ao vídeo daquele dia.
 */
function FaixaDaSemana({
  videos,
  aprovado,
}: {
  videos: { pauta: PautaPlano; indice: number; gerada?: PautaGerada }[];
  aprovado: boolean;
}) {
  return (
    <nav
      aria-label="Dias da semana"
      className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(5.25rem,1fr))]"
    >
      {videos.map(({ pauta, indice, gerada }) => {
        const estado = estadoDoVideo(pauta, aprovado, gerada);
        return (
          <a
            key={`${pauta.data}-${indice}`}
            href={`#video-${indice}`}
            aria-label={`${pauta.dia}, ${dataCurta(pauta.data)}: ${estado.rotulo}`}
            className={cn(
              "overflow-hidden rounded-lg border bg-surface transition-colors motion-reduce:transition-none",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
              estado.acao ? "border-primary" : "border-border hover:border-foreground/30",
              pauta.removida && "opacity-55",
            )}
          >
            <span className="flex items-baseline justify-center gap-1.5 bg-foreground px-2 py-1.5 text-background">
              <span className="font-display text-sm font-bold capitalize">
                {diaDaSemana(pauta.data)}
              </span>
              <span className="font-mono text-[11px] opacity-75 num">{dataCurta(pauta.data)}</span>
            </span>
            <span
              className={cn(
                "flex items-center justify-center gap-1 px-2 py-2 text-xs",
                estado.acao ? "bg-primary/20 font-semibold" : "text-muted-foreground",
              )}
            >
              {estado.icone}
              {estado.curto}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

function EtiquetaEstado({ estado }: { estado: Estado }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs",
        estado.acao
          ? "bg-primary/25 text-foreground font-medium"
          : "bg-muted text-muted-foreground",
      )}
    >
      {estado.icone}
      {estado.rotulo}
    </span>
  );
}

function AvisoAprovado() {
  return (
    <Card className="p-4 bg-surface border-border flex flex-wrap items-center justify-between gap-3">
      <p className="text-sm">
        <strong>Plano aprovado.</strong> A prevIA escreve os roteiros um de cada vez e avisa quando
        cada um fica pronto. O estado de cada dia aparece abaixo.
      </p>
      <Button variant="outline" size="sm" asChild>
        <Link to="/roteiros">
          Ver em Roteiros <ArrowRight className="w-4 h-4 ml-1" />
        </Link>
      </Button>
    </Card>
  );
}

function CartaoVideo({
  planoId,
  indice,
  pauta,
  editavel,
  aprovado,
  gerada,
}: {
  planoId: string;
  indice: number;
  pauta: PautaPlano;
  editavel: boolean;
  aprovado: boolean;
  gerada?: PautaGerada;
}) {
  const queryClient = useQueryClient();
  const remover = useServerFn(removerPauta);
  const trocar = useServerFn(trocarPauta);
  const [trocando, setTrocando] = useState(false);
  const [pedido, setPedido] = useState("");
  const [detalhes, setDetalhes] = useState(false);

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

  const estado = estadoDoVideo(pauta, aprovado, gerada);
  const etapa = gerada ? etapaDoRoteiro(gerada.status, gerada.publicacoes) : null;
  const texto = gerada ? textoDoRoteiro(roteiroMaisRecente(gerada.roteiros)?.conteudo) : null;
  const idDetalhes = `detalhes-video-${indice}`;
  const temDetalhes = pauta.estrutura?.length > 0 || pauta.por_que_vai_funcionar;

  return (
    <Card
      id={`video-${indice}`}
      className={cn(
        "scroll-mt-20 overflow-hidden bg-surface border-border grid sm:grid-cols-[92px_minmax(0,1fr)]",
        pauta.removida && "opacity-60",
      )}
    >
      <div className="bg-foreground text-background px-4 py-2 sm:py-4 flex sm:flex-col items-center sm:justify-center gap-2 sm:gap-0.5">
        <span className="font-display font-bold capitalize">{pauta.dia}</span>
        <span className="text-xs font-mono opacity-75 num">{dataCurta(pauta.data)}</span>
      </div>

      <div className="p-4 sm:p-5 min-w-0">
        {(aprovado || pauta.removida) && (
          <div className="mb-2.5">
            <EtiquetaEstado estado={estado} />
          </div>
        )}
        <h3 className="font-display font-semibold text-lg leading-snug">{pauta.tema}</h3>
        <p className="text-sm text-muted-foreground mt-1">{pauta.angulo}</p>

        <blockquote className="mt-3 rounded-lg bg-muted px-4 py-3">
          <span className="block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Primeiros 3 segundos
          </span>
          <span className="font-display font-semibold leading-snug">“{pauta.gancho}”</span>
        </blockquote>

        {temDetalhes && (
          <button
            type="button"
            onClick={() => setDetalhes((v) => !v)}
            aria-expanded={detalhes}
            aria-controls={idDetalhes}
            className="mt-2 -ml-2 inline-flex min-h-11 sm:min-h-9 items-center gap-1.5 rounded-md px-2 text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ChevronDown
              className={cn(
                "w-4 h-4 transition-transform motion-reduce:transition-none",
                detalhes && "rotate-180",
              )}
            />
            {detalhes ? "Esconder a estrutura" : "Ver a estrutura e de onde veio"}
          </button>
        )}

        {detalhes && (
          <div id={idDetalhes} className="mt-1 space-y-3">
            {pauta.estrutura?.length > 0 && (
              <ol className="space-y-1.5 list-decimal pl-5 text-sm marker:text-muted-foreground marker:font-mono">
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
            <p className="text-xs text-muted-foreground">
              Modelado no post {pauta.inspirado_em} · {pauta.por_que_vai_funcionar}
            </p>
          </div>
        )}

        {editavel && !trocando && (
          <div className="flex flex-wrap gap-2 mt-3">
            {!pauta.removida && (
              <>
                <Button variant="outline" size="sm" onClick={() => setTrocando(true)}>
                  <RefreshCw className="w-4 h-4 mr-1.5" /> Trocar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copiarTexto(pauta.gancho, "Gancho copiado")}
                >
                  <Copy className="w-4 h-4 mr-1.5" /> Copiar gancho
                </Button>
              </>
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

        {/* Depois de aprovado: o vídeo vira roteiro, e as ações seguem o roteiro. */}
        {gerada && etapa && etapa !== "escrevendo" && (
          <div className="mt-4 pt-3 border-t border-divider flex flex-wrap items-center gap-2">
            <Button size="sm" variant={etapa === "para-ler" ? "default" : "outline"} asChild>
              <Link to="/aprovacao/$pautaId" params={{ pautaId: gerada.id }}>
                {etapa === "para-ler" ? "Ler e aprovar" : "Abrir roteiro"}
              </Link>
            </Button>
            {texto && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copiarTexto(texto.completo, "Roteiro copiado")}
              >
                <Copy className="w-4 h-4 mr-1.5" /> Copiar roteiro
              </Button>
            )}
            {etapa !== "recusados" && (
              <BotaoCarrossel pautaId={gerada.id} status={gerada.carrosseis[0]?.status ?? null} />
            )}
            {etapa === "para-gravar" && <BotaoPostado pautaId={gerada.id} />}
          </div>
        )}
      </div>
    </Card>
  );
}

/**
 * A prova de trabalho: os padrões e os posts que originaram a semana. Fica
 * recolhida no fim para a tela ser um plano, não um relatório.
 */
function PorQueEssesVideos({ relatorio }: { relatorio: RelatorioPlano }) {
  const posts = relatorio.posts ?? [];
  if (relatorio.padroes.length === 0 && posts.length === 0) return null;

  return (
    <details className="group rounded-xl border border-border bg-surface">
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 sm:px-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-details-marker]:hidden">
        <span>
          <span className="block font-display font-bold">Por que esses vídeos</span>
          <span className="block text-sm text-muted-foreground">
            {[
              relatorio.padroes.length > 0 &&
                plural(relatorio.padroes.length, "padrão encontrado", "padrões encontrados"),
              posts.length > 0 && plural(posts.length, "post analisado", "posts analisados"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </span>
        <ChevronDown className="w-5 h-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180 motion-reduce:transition-none" />
      </summary>

      <div className="space-y-6 px-4 pb-5 sm:px-5">
        {relatorio.padroes.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-display font-semibold">Os padrões por trás dos virais</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {relatorio.padroes.map((p) => (
                <Card
                  key={p.nome}
                  className="p-4 bg-background border-border border-t-2 border-t-primary"
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

        {posts.length > 0 && <PostsAnalisados posts={posts} />}
      </div>
    </details>
  );
}

function PostsAnalisados({ posts }: { posts: RelatorioPlano["posts"] }) {
  return (
    <section className="space-y-3">
      <h2 className="font-display font-semibold">Os posts que analisamos</h2>
      <p className="text-sm text-muted-foreground max-w-[64ch]">
        Escolhidos entre os últimos posts de cada perfil que você acompanha, pelo quanto foram acima
        do normal do próprio perfil. Cada reel foi assistido inteiro e cada carrossel foi lido slide
        por slide.
      </p>
      <ol className="space-y-2">
        {posts.map((post) => (
          <li key={post.numero}>
            <Card className="p-4 bg-background border-border min-w-0">
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
