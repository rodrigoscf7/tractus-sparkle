import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { EstadoCarregando, EstadoErro } from "@/components/estados";
import { PautaDaSemana } from "@/components/hoje/PautaDaSemana";
import { RITMO_PADRAO, pautaDaSemana, semanasSeguidas, type PublicacaoPostada } from "@/lib/ritmo";
import { Video, CheckCheck, Sparkles, ArrowRight } from "lucide-react";

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
  pautas_geradas: { id: string; tema: string | null; angulo: string | null } | null;
};

/**
 * A casa do app.
 *
 * O Kanban respondia "em que estado está a esteira?" — pergunta de quem opera a
 * fábrica. Esta tela responde a única pergunta do advogado: o que eu gravo hoje.
 * Ela nunca fica vazia: quando não há nada pronto, diz o que está acontecendo.
 */
function HojePage() {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hoje"],
    queryFn: async () => {
      const [perfilRes, pubRes, curadoriaRes, aprovacaoRes] = await Promise.all([
        supabase
          .from("perfis")
          .select("id, nome, ritmo_dias")
          .order("criado_em")
          .limit(1)
          .maybeSingle(),
        supabase
          .from("publicacoes")
          .select("id, status, postado_em, pauta_id, pautas_geradas:pautas_geradas(id,tema,angulo)")
          .order("criado_em", { ascending: false })
          .limit(200),
        supabase
          .from("conteudos_curados")
          .select("id", { count: "exact", head: true })
          .eq("aprovacao_humana", "pendente"),
        supabase
          .from("pautas_geradas")
          .select("id, tema, angulo")
          .eq("status", "aguardando_aprovacao")
          .order("criado_em", { ascending: false }),
      ]);

      if (perfilRes.error) throw perfilRes.error;
      if (pubRes.error) throw pubRes.error;
      if (aprovacaoRes.error) throw aprovacaoRes.error;
      if (curadoriaRes.error) throw curadoriaRes.error;

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
        curadoriasPendentes: curadoriaRes.count ?? 0,
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

      <AcaoDeHoje
        gravar={gravar}
        aprovar={aprovar}
        curadoriasPendentes={data.curadoriasPendentes}
      />

      <PautaDaSemana dias={dias} ritmoDias={ritmoDias} semanasSeguidas={sequencia} />

      <EsperandoVoce
        curadoriasPendentes={data.curadoriasPendentes}
        aprovacoesPendentes={data.aprovacoesPendentes.length}
      />
    </div>
  );
}

/**
 * Um cartão, uma ação. A prioridade segue o que está mais perto de virar post:
 * gravar um roteiro pronto vale mais que aprovar, que vale mais que escolher
 * assunto. Sem nada pronto, a tela explica o que a prevIA está fazendo — nunca
 * mostra vazio.
 */
function AcaoDeHoje({
  gravar,
  aprovar,
  curadoriasPendentes,
}: {
  gravar: PublicacaoComPauta | null;
  aprovar: { id: string; tema: string | null; angulo: string | null } | null;
  curadoriasPendentes: number;
}) {
  if (gravar?.pautas_geradas) {
    const pauta = gravar.pautas_geradas;
    return (
      <Cartao
        etiqueta="Grave hoje"
        icone={<Video className="w-4 h-4" />}
        titulo={pauta.tema ?? "Roteiro pronto"}
        apoio={pauta.angulo}
        destaque
      >
        <Button asChild>
          <Link to="/aprovacao/$pautaId" params={{ pautaId: pauta.id }}>
            Ver o roteiro <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
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

  if (curadoriasPendentes > 0) {
    return (
      <Cartao
        etiqueta="Esperando você"
        icone={<CheckCheck className="w-4 h-4" />}
        titulo={
          curadoriasPendentes === 1
            ? "1 assunto para você escolher"
            : `${curadoriasPendentes} assuntos para você escolher`
        }
        apoio="Os que você aprovar viram roteiro seu automaticamente."
        destaque
      >
        <Button asChild>
          <Link to="/curadoria">
            Escolher assuntos <ArrowRight className="w-4 h-4 ml-1" />
          </Link>
        </Button>
      </Cartao>
    );
  }

  return (
    <Cartao
      etiqueta="Em andamento"
      icone={<Sparkles className="w-4 h-4" />}
      titulo="A prevIA está buscando o seu próximo assunto"
      apoio="Toda manhã ela lê os perfis que você indicou. Você é avisado assim que tiver algo para decidir."
    >
      <Button variant="outline" asChild>
        <Link to="/perfis">Ajustar minhas referências</Link>
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
  curadoriasPendentes,
  aprovacoesPendentes,
}: {
  curadoriasPendentes: number;
  aprovacoesPendentes: number;
}) {
  if (curadoriasPendentes === 0 && aprovacoesPendentes === 0) return null;

  return (
    <section>
      <h2 className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
        Esperando você
      </h2>
      <div className="space-y-2">
        {aprovacoesPendentes > 0 && (
          <LinhaPendencia
            para="/pipeline"
            contagem={aprovacoesPendentes}
            singular="roteiro para aprovar"
            plural="roteiros para aprovar"
          />
        )}
        {curadoriasPendentes > 0 && (
          <LinhaPendencia
            para="/curadoria"
            contagem={curadoriasPendentes}
            singular="assunto para escolher"
            plural="assuntos para escolher"
          />
        )}
      </div>
    </section>
  );
}

function LinhaPendencia({
  para,
  contagem,
  singular,
  plural,
}: {
  para: string;
  contagem: number;
  singular: string;
  plural: string;
}) {
  return (
    <Link
      to={para}
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
