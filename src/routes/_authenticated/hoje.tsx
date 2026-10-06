import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EstadoCarregando, EstadoErro } from "@/components/estados";
import { PautaDaSemana } from "@/components/hoje/PautaDaSemana";
import { RITMO_PADRAO, pautaDaSemana, semanasSeguidas, type PublicacaoPostada } from "@/lib/ritmo";
import {
  Video,
  CheckCheck,
  Sparkles,
  ArrowRight,
  CalendarRange,
  Loader2,
  Copy,
} from "lucide-react";
import { BotaoPostado } from "@/components/roteiro/BotaoPostado";
import { copiarTexto } from "@/lib/copiar";
import { textoDoRoteiro } from "@/lib/roteiro";
import { usePlanoAtual, type PlanoAtual } from "@/hooks/use-plano";
import { PLANO_EM_ANDAMENTO } from "@/lib/plano";

export const Route = createFileRoute("/_authenticated/hoje")({
  head: () => ({
    meta: [
      { title: "Hoje | prevIA - CONTENT" },
      {
        name: "description",
        content: "O que você grava hoje, o ritmo da semana e o que espera sua decisão.",
      },
      { property: "og:title", content: "Hoje | prevIA - CONTENT" },
      { property: "og:description", content: "Sua próxima ação de conteúdo, em uma tela." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: HojePage,
});

type PublicacaoComPauta = {
  id: string;
  status: string | null;
  postado_em: string | null;
  pauta_id: string | null;
  pautas_geradas: {
    id: string;
    tema: string | null;
    angulo: string | null;
    roteiros: { conteudo: unknown; criado_em: string | null }[];
  } | null;
};

/**
 * A casa do app.
 *
 * O Kanban respondia "em que estado está a esteira?" — pergunta de quem opera a
 * fábrica. Esta tela responde a única pergunta do advogado: o que eu gravo hoje.
 * Ela nunca fica vazia: quando não há nada pronto, diz o que está acontecendo.
 */
function HojePage() {
  const { data: plano } = usePlanoAtual();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hoje"],
    queryFn: async () => {
      const [perfilRes, pubRes, aprovacaoRes] = await Promise.all([
        supabase
          .from("perfis")
          .select("id, nome, ritmo_dias")
          .order("criado_em")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("publicacoes")
          .select(
            "id, status, postado_em, pauta_id, pautas_geradas:pautas_geradas(id,tema,angulo,roteiros(conteudo,criado_em))",
          )
          .order("criado_em", { ascending: false })
          .limit(200),
        supabase
          .from("pautas_geradas")
          .select("id, tema, angulo")
          .eq("status", "aguardando_aprovacao")
          .order("criado_em", { ascending: false }),
      ]);

      if (perfilRes.error) throw perfilRes.error;
      if (pubRes.error) throw pubRes.error;
      if (aprovacaoRes.error) throw aprovacaoRes.error;

      const publicacoes = (pubRes.data ?? []) as unknown as PublicacaoComPauta[];

      return {
        perfil: perfilRes.data,
        paraGravar: publicacoes.filter((p) => p.status === "pendente"),
        postados: publicacoes
          .filter((p) => p.status === "postado" && p.postado_em)
          .map<PublicacaoPostada>((p) => ({
            postado_em: p.postado_em as string,
            tema: p.pautas_geradas?.tema ?? null,
          })),
        aprovacoesPendentes: aprovacaoRes.data ?? [],
      };
    },
  });

  if (isLoading) {
    return (
      <div className="p-4 sm:p-8 max-w-[900px]">
        <EstadoCarregando linhas={2} rotulo="Carregando seu dia" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="p-4 sm:p-8 max-w-[900px]">
        <EstadoErro
          titulo="Não consegui montar seu dia"
          descricao="A conexão falhou no meio do caminho. Nada do seu conteúdo foi perdido."
          onTentarDeNovo={() => refetch()}
        />
      </div>
    );
  }

  const ritmoDias = data.perfil?.ritmo_dias ?? RITMO_PADRAO;
  const dias = pautaDaSemana(ritmoDias, data.postados);
  const sequencia = semanasSeguidas(ritmoDias, data.postados);

  const gravar = data.paraGravar[0] ?? null;
  const aprovar = data.aprovacoesPendentes[0] ?? null;

  return (
    <div className="p-4 sm:p-8 max-w-[900px] space-y-6">
      <header>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Hoje</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {data.perfil?.nome ? `Olá, ${data.perfil.nome}.` : "Sua próxima ação está abaixo."}
        </p>
      </header>

      <AcaoDeHoje gravar={gravar} aprovar={aprovar} plano={plano ?? null} />

      <PautaDaSemana dias={dias} ritmoDias={ritmoDias} semanasSeguidas={sequencia} />

      <EsperandoVoce
        planoParaAprovar={plano?.status === "pronto"}
        aprovacoesPendentes={data.aprovacoesPendentes.length}
      />
    </div>
  );
}

/**
 * Um cartão, uma ação. A prioridade segue o que está mais perto de virar post:
 * gravar um roteiro pronto vale mais que aprovar, que vale mais que aprovar o
 * plano da semana. Sem nada pronto, a tela explica o que a prevIA está fazendo,
 * nunca mostra vazio.
 */
function AcaoDeHoje({
  gravar,
  aprovar,
  plano,
}: {
  gravar: PublicacaoComPauta | null;
  aprovar: { id: string; tema: string | null; angulo: string | null } | null;
  plano: PlanoAtual | null;
}) {
  if (gravar?.pautas_geradas) {
    const pauta = gravar.pautas_geradas;
    const roteiro = [...pauta.roteiros].sort((a, b) =>
      (b.criado_em ?? "").localeCompare(a.criado_em ?? ""),
    )[0];
    const texto = textoDoRoteiro(roteiro?.conteudo);
    return (
      <Cartao
        etiqueta="Grave hoje"
        icone={<Video className="w-4 h-4" />}
        titulo={pauta.tema ?? "Roteiro pronto"}
        apoio={pauta.angulo}
        destaque
      >
        <div className="flex flex-wrap gap-2">
          <Button asChild>
            <Link to="/aprovacao/$pautaId" params={{ pautaId: pauta.id }}>
              Ver o roteiro <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </Button>
          {texto?.fala && (
            <Button variant="outline" onClick={() => copiarTexto(texto.fala, "Fala copiada")}>
              <Copy className="w-4 h-4 mr-1.5" /> Copiar a fala
            </Button>
          )}
          <BotaoPostado pautaId={pauta.id} variant="ghost" />
        </div>
      </Cartao>
    );
  }

  if (aprovar) {
    return (
      <Cartao
        etiqueta="Esperando você"
        icone={<CheckCheck className="w-4 h-4" />}
        titulo={aprovar.tema ?? "Um roteiro está pronto"}
        apoio={aprovar.angulo}
        destaque
      >
        <Button asChild>
          <Link to="/aprovacao/$pautaId" params={{ pautaId: aprovar.id }}>
            Ler e decidir <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </Cartao>
    );
  }

  if (plano?.status === "pronto") {
    const videos = plano.relatorio?.pautas.filter((p) => !p.removida).length ?? 0;
    return (
      <Cartao
        etiqueta="Seu plano chegou"
        icone={<CalendarRange className="w-4 h-4" />}
        titulo={
          videos === 1
            ? "1 vídeo pronto para a sua semana"
            : `${videos} vídeos prontos para a sua semana`
        }
        apoio="Com o gancho já escrito e a estrutura de cada fala, modelados no que mais funcionou no seu nicho."
        destaque
      >
        <Button asChild>
          <Link to="/plano">
            Ver e aprovar o plano <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </Cartao>
    );
  }

  if (plano && PLANO_EM_ANDAMENTO.includes(plano.status)) {
    return (
      <Cartao
        etiqueta="Em andamento"
        icone={<Loader2 className="w-4 h-4 animate-spin motion-reduce:animate-none" />}
        titulo="A prevIA está montando o seu plano da semana"
        apoio="Ela está assistindo aos vídeos que mais performaram nos perfis que você acompanha. Você é avisado quando ficar pronto."
      >
        <Button variant="outline" asChild>
          <Link to="/plano">Ver o andamento</Link>
        </Button>
      </Cartao>
    );
  }

  return (
    <Cartao
      etiqueta="Em andamento"
      icone={<Sparkles className="w-4 h-4" />}
      titulo="Seu próximo plano chega no domingo"
      apoio="Todo domingo a prevIA assiste aos posts que mais performaram nos perfis que você acompanha e monta os vídeos da sua semana."
    >
      <Button variant="outline" asChild>
        <Link to="/plano">Ver o plano da semana</Link>
      </Button>
    </Cartao>
  );
}

function Cartao({
  etiqueta,
  icone,
  titulo,
  apoio,
  destaque = false,
  children,
}: {
  etiqueta: string;
  icone: React.ReactNode;
  titulo: string;
  apoio?: string | null;
  destaque?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Card className={`p-5 sm:p-6 bg-surface ${destaque ? "border-primary/50" : "border-border"}`}>
      <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
        {icone}
        {etiqueta}
      </div>
      <h2 className="font-display font-bold text-xl sm:text-2xl leading-tight">{titulo}</h2>
      {apoio && <p className="text-sm text-muted-foreground mt-2 leading-relaxed">{apoio}</p>}
      <div className="mt-5">{children}</div>
    </Card>
  );
}

/**
 * As duas decisões continuam sendo duas — telas separadas, registros separados.
 * O que muda é que o usuário não precisa mais caçar o que está esperando por ele.
 */
function EsperandoVoce({
  planoParaAprovar,
  aprovacoesPendentes,
}: {
  planoParaAprovar: boolean;
  aprovacoesPendentes: number;
}) {
  if (!planoParaAprovar && aprovacoesPendentes === 0) return null;

  return (
    <section>
      <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
        Esperando você
      </h2>
      <div className="space-y-2">
        {planoParaAprovar && (
          <LinhaPendencia
            para="/plano"
            contagem={1}
            singular="plano da semana para aprovar"
            plural="planos da semana para aprovar"
          />
        )}
        {aprovacoesPendentes > 0 && (
          <LinhaPendencia
            para="/roteiros"
            busca={{ aba: "para-ler" }}
            contagem={aprovacoesPendentes}
            singular="roteiro para aprovar"
            plural="roteiros para aprovar"
          />
        )}
      </div>
    </section>
  );
}

function LinhaPendencia({
  para,
  busca,
  contagem,
  singular,
  plural,
}: {
  para: string;
  busca?: Record<string, string>;
  contagem: number;
  singular: string;
  plural: string;
}) {
  return (
    <Link
      to={para}
      search={busca as never}
      className="flex items-center justify-between gap-3 min-h-14 px-4 rounded-lg border border-border bg-surface hover:border-primary/40 transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <span className="text-sm">
        <strong className="num font-semibold">{contagem}</strong>{" "}
        {contagem === 1 ? singular : plural}
      </span>
      <ArrowRight className="w-4 h-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}
