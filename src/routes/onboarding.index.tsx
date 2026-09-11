import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import previaLogo from "@/assets/previa-logo.png.asset.json";
import { getOnboarding, salvarPasso } from "@/lib/onboarding.functions";
import {
  AREAS,
  ATRIBUTOS,
  CANAIS,
  DIAS_DA_SEMANA,
  ESTILOS,
  MAX_ATRIBUTOS,
  MAX_OBJETIVOS,
  MAX_REFERENCIAS,
  OBJETIVOS,
  ORIGEM,
  PASSOS,
  RITMO_SUGERIDO,
  SITUACAO,
  TAMANHOS,
  TOTAL_PASSOS,
  TRAFEGO,
  linhasParaLista,
  validarPasso,
  type Respostas,
} from "@/lib/onboarding-perguntas";
import {
  EscolhaDias,
  EscolhaEstilo,
  EscolhaMultipla,
  EscolhaUnica,
  ListaHandles,
  Pergunta,
  TrilhoProgresso,
} from "@/components/onboarding/campos";

const SIM_NAO = [
  { valor: "sim", label: "Sim" },
  { valor: "nao", label: "Não" },
];

export const Route = createFileRoute("/onboarding/")({
  head: () => ({
    meta: [
      { title: "Vamos começar | prevIA" },
      {
        name: "description",
        content: "Algumas perguntas para a prevIA aprender a criar conteúdo como você.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  // `passo` sai da URL na tela de boas-vindas: /onboarding fica limpo e
  // continua sendo um destino válido para o gate de `_authenticated`.
  validateSearch: (search: Record<string, unknown>): { passo?: number } => {
    const bruto = Number(search.passo ?? 0);
    const passo = Number.isFinite(bruto) ? Math.trunc(bruto) : 0;
    const limitado = Math.min(TOTAL_PASSOS, Math.max(0, passo));
    return limitado === 0 ? {} : { passo: limitado };
  },
  component: OnboardingWizard,
});

function OnboardingWizard() {
  const { passo = 0 } = Route.useSearch();
  const navigate = useNavigate({ from: Route.fullPath });
  const carregar = useServerFn(getOnboarding);
  const salvar = useServerFn(salvarPasso);

  const [respostas, setRespostas] = useState<Respostas>({});
  const [salvando, setSalvando] = useState(false);
  const [hidratado, setHidratado] = useState(false);

  const { data: estado, isLoading } = useQuery({
    queryKey: ["onboarding"],
    queryFn: () => carregar(),
    refetchOnWindowFocus: false,
  });

  // Retoma de onde parou, uma vez só: depois disso o estado local manda.
  // Quem fecha a aba no meio volta na mesma pergunta, não na primeira.
  useEffect(() => {
    if (!estado || hidratado) return;
    setRespostas(estado.respostas ?? {});
    setHidratado(true);
    if (passo === 0 && estado.passoAtual > 1) {
      navigate({ search: { passo: estado.passoAtual }, replace: true });
    }
  }, [estado, hidratado, passo, navigate]);

  function definir<K extends keyof Respostas>(chave: K, valor: Respostas[K]) {
    setRespostas((r) => ({ ...r, [chave]: valor }));
  }

  function irPara(destino: number) {
    navigate({ search: { passo: destino } });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  async function avancar() {
    const erros = validarPasso(passo, respostas);
    if (erros.length) {
      toast.error(erros[0]);
      return;
    }

    setSalvando(true);
    try {
      await salvar({ data: { passo, respostas } });
      if (passo === TOTAL_PASSOS) {
        navigate({ to: "/onboarding/processando" });
        return;
      }
      irPara(passo + 1);
    } catch (e) {
      toast.error(
        e instanceof Error ? e.message : "Não foi possível salvar. Tente novamente.",
      );
    } finally {
      setSalvando(false);
    }
  }

  if (isLoading || !hidratado) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!estado?.contaId) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-6 text-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        <p className="text-base text-muted-foreground">Preparando sua conta…</p>
      </div>
    );
  }

  if (passo === 0) return <BoasVindas onComecar={() => irPara(1)} />;

  const meta = PASSOS[passo - 1]!;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur">
        <TrilhoProgresso atual={passo} total={TOTAL_PASSOS} />
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <div className="font-display text-base font-semibold tracking-tight">
              {meta.titulo}
            </div>
            <div className="text-sm text-muted-foreground">{meta.resumo}</div>
          </div>
          <div className="num text-sm text-muted-foreground">
            Passo {passo} de {TOTAL_PASSOS}
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          avancar();
        }}
        className="mx-auto max-w-2xl px-5 pb-32 pt-6 sm:px-8"
      >
        <div
          key={passo}
          className="space-y-12 animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
        >
          {passo === 1 && <PassoVoce respostas={respostas} definir={definir} />}
          {passo === 2 && <PassoPublico respostas={respostas} definir={definir} />}
          {passo === 3 && <PassoVoz respostas={respostas} definir={definir} />}
          {passo === 4 && <PassoReferencias respostas={respostas} definir={definir} />}
          {passo === 5 && <PassoContexto respostas={respostas} definir={definir} />}
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => irPara(passo - 1)}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-base text-muted-foreground
                transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>
            <button
              type="submit"
              disabled={salvando}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium
                text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              {salvando ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Salvando
                </>
              ) : passo === TOTAL_PASSOS ? (
                <>
                  Montar meu manual <ArrowRight className="h-4 w-4" />
                </>
              ) : (
                <>
                  Continuar <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function BoasVindas({ onComecar }: { onComecar: () => void }) {
  return (
    <div className="mx-auto flex min-h-screen max-w-xl flex-col justify-center px-6 py-16">
      <img src={previaLogo.url} alt="prevIA" className="h-10 w-auto self-start sm:h-12" />
      <h1 className="mt-10 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        Vamos ensinar a prevIA a criar como você.
      </h1>
      <p className="mt-5 text-lg leading-relaxed text-muted-foreground">
        Responda algumas perguntas rápidas. Com elas a prevIA encontra referências, adapta ideias
        e escreve roteiros alinhados ao seu posicionamento, ao seu público e à sua personalidade.
      </p>
      <p className="mt-3 text-base text-muted-foreground">Leva cerca de cinco minutos.</p>
      <button
        type="button"
        onClick={onComecar}
        className="mt-10 inline-flex w-full items-center justify-center gap-2 rounded-md bg-primary px-6 py-3.5
          text-base font-medium text-primary-foreground transition hover:bg-primary/90 sm:w-auto sm:self-start
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          focus-visible:ring-offset-background"
      >
        Começar <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

type PassoProps = {
  respostas: Respostas;
  definir: <K extends keyof Respostas>(chave: K, valor: Respostas[K]) => void;
};

function PassoVoce({ respostas, definir }: PassoProps) {
  return (
    <>
      <Pergunta titulo="Como você quer ser chamado(a)?">
        <Input
          value={respostas.nome ?? ""}
          onChange={(e) => definir("nome", e.target.value)}
          placeholder="Dra. Marina Alves"
          aria-label="Como você quer ser chamado"
          autoFocus
          className="h-12 text-base"
        />
      </Pergunta>

      <Pergunta titulo="Qual é a sua principal área de atuação?">
        <EscolhaUnica
          opcoes={AREAS}
          valor={respostas.area_atuacao}
          onChange={(v) => definir("area_atuacao", v)}
          colunas={3}
        />
        {respostas.area_atuacao === "outro" && (
          <Input
            value={respostas.area_outro ?? ""}
            onChange={(e) => definir("area_outro", e.target.value)}
            placeholder="Qual área?"
            aria-label="Qual área de atuação"
            className="mt-3 h-12 text-base"
          />
        )}
      </Pergunta>

      <Pergunta
        titulo="Você atua em algum nicho específico?"
        apoio="É o que separa um conteúdo que fala com todo mundo de um que fala com a pessoa certa."
      >
        <EscolhaUnica
          opcoes={SIM_NAO}
          valor={respostas.tem_nicho === undefined ? undefined : respostas.tem_nicho ? "sim" : "nao"}
          onChange={(v) => definir("tem_nicho", v === "sim")}
        />
        {respostas.tem_nicho && (
          <Input
            value={respostas.nicho ?? ""}
            onChange={(e) => definir("nicho", e.target.value)}
            placeholder="Salário-maternidade, BPC/LOAS para autistas, divórcio para empresários…"
            aria-label="Qual nicho"
            className="mt-3 h-12 text-base"
          />
        )}
      </Pergunta>
    </>
  );
}

function PassoPublico({ respostas, definir }: PassoProps) {
  const objetivos = respostas.objetivos ?? [];
  return (
    <>
      <Pergunta
        titulo="Quem é o seu cliente ideal?"
        apoio="Descreva quem você mais quer atrair com seus conteúdos."
      >
        <Textarea
          value={respostas.cliente_ideal ?? ""}
          onChange={(e) => definir("cliente_ideal", e.target.value)}
          placeholder="Gestantes entre 20 e 35 anos, sem carteira assinada ou desempregadas, que não sabem que podem ter direito ao salário-maternidade."
          aria-label="Quem é o seu cliente ideal"
          rows={4}
          autoFocus
          className="text-base leading-relaxed"
        />
      </Pergunta>

      <Pergunta
        titulo="Qual é hoje o principal objetivo dos seus conteúdos?"
        apoio={`Escolha até ${MAX_OBJETIVOS}.`}
      >
        <EscolhaMultipla
          opcoes={OBJETIVOS}
          valores={objetivos}
          onChange={(v) => definir("objetivos", v)}
          max={MAX_OBJETIVOS}
        />
        {objetivos.includes("outro") && (
          <Input
            value={respostas.objetivo_outro ?? ""}
            onChange={(e) => definir("objetivo_outro", e.target.value)}
            placeholder="Qual objetivo?"
            aria-label="Qual outro objetivo"
            className="mt-3 h-12 text-base"
          />
        )}
      </Pergunta>
    </>
  );
}

function PassoVoz({ respostas, definir }: PassoProps) {
  return (
    <>
      <Pergunta
        titulo="Como você quer ser percebido(a) nas redes?"
        apoio={`Escolha até ${MAX_ATRIBUTOS} características.`}
      >
        <EscolhaMultipla
          opcoes={ATRIBUTOS}
          valores={respostas.atributos ?? []}
          onChange={(v) => definir("atributos", v)}
          max={MAX_ATRIBUTOS}
          colunas={3}
        />
      </Pergunta>

      <Pergunta
        titulo="Qual dessas aberturas soa como você?"
        apoio="Leia em voz alta. A que você diria sem se sentir estranho é a certa."
      >
        <EscolhaEstilo
          estilos={ESTILOS}
          valor={respostas.estilo_narrativo}
          onChange={(v) => definir("estilo_narrativo", v)}
        />
      </Pergunta>

      <Pergunta
        titulo="Tem algo que você não quer ver nos seus conteúdos?"
        apoio="Uma por linha. Nenhum agente vai passar por cima desta lista."
      >
        <Textarea
          value={respostas.restricoes_texto ?? ""}
          onChange={(e) => {
            definir("restricoes_texto", e.target.value);
            definir("restricoes", linhasParaLista(e.target.value));
          }}
          placeholder={
            "Não gosto de palavrão\nNão quero parecer agressiva\nNunca usar a palavra garantia\nSem dancinha"
          }
          aria-label="O que você não quer nos conteúdos"
          rows={4}
          className="text-base leading-relaxed"
        />
      </Pergunta>

      <Pergunta titulo="Você tem frases de impacto ou bordões?">
        <EscolhaUnica
          opcoes={SIM_NAO}
          valor={
            respostas.tem_bordoes === undefined ? undefined : respostas.tem_bordoes ? "sim" : "nao"
          }
          onChange={(v) => definir("tem_bordoes", v === "sim")}
        />
        {respostas.tem_bordoes && (
          <Textarea
            value={respostas.bordoes_texto ?? ""}
            onChange={(e) => {
              definir("bordoes_texto", e.target.value);
              definir("bordoes", linhasParaLista(e.target.value));
            }}
            placeholder={"Tempo é ouro\nSer bom não basta, seja notável"}
            aria-label="Seus bordões"
            rows={3}
            className="mt-3 text-base leading-relaxed"
          />
        )}
      </Pergunta>
    </>
  );
}

function PassoReferencias({ respostas, definir }: PassoProps) {
  return (
    <>
      <Pergunta
        titulo="Quais criadores você gosta de acompanhar?"
        apoio="A prevIA lê o que esses perfis publicam e traz o que der para adaptar ao seu posicionamento. Não precisa ser do seu segmento."
      >
        <ListaHandles
          valores={respostas.referencias ?? []}
          onChange={(v) => definir("referencias", v)}
          max={MAX_REFERENCIAS}
        />
      </Pergunta>

      <Pergunta titulo="Onde você publica conteúdo hoje?">
        <EscolhaMultipla
          opcoes={CANAIS}
          valores={respostas.canais ?? []}
          onChange={(v) => definir("canais", v)}
          max={CANAIS.length}
        />
      </Pergunta>
    </>
  );
}

function PassoContexto({ respostas, definir }: PassoProps) {
  return (
    <>
      <Pergunta
        titulo="Em que dias você vai postar?"
        apoio="A prevIA garante que sempre exista conteúdo pronto para estes dias — e lembra você neles. Três vezes por semana é um bom começo."
      >
        <EscolhaDias
          dias={DIAS_DA_SEMANA}
          valores={respostas.ritmo_dias ?? RITMO_SUGERIDO}
          onChange={(v) => definir("ritmo_dias", v)}
        />
      </Pergunta>

      <Pergunta titulo="Qual dessas situações mais descreve você hoje?" apoio="Opcional.">
        <EscolhaUnica
          opcoes={SITUACAO}
          valor={respostas.situacao}
          onChange={(v) => definir("situacao", v)}
          colunas={1}
        />
      </Pergunta>

      <Pergunta titulo="Quantas pessoas trabalham no seu escritório?" apoio="Opcional.">
        <EscolhaUnica
          opcoes={TAMANHOS}
          valor={respostas.tamanho_escritorio}
          onChange={(v) => definir("tamanho_escritorio", v)}
          colunas={3}
        />
      </Pergunta>

      <Pergunta titulo="Você investe em tráfego pago?" apoio="Opcional.">
        <EscolhaUnica
          opcoes={TRAFEGO}
          valor={respostas.trafego_pago}
          onChange={(v) => definir("trafego_pago", v)}
          colunas={3}
        />
      </Pergunta>

      <Pergunta titulo="Como você conheceu a prevIA?" apoio="Opcional.">
        <EscolhaUnica
          opcoes={ORIGEM}
          valor={respostas.origem}
          onChange={(v) => definir("origem", v)}
          colunas={3}
        />
        {respostas.origem === "outro" && (
          <Input
            value={respostas.origem_outro ?? ""}
            onChange={(e) => definir("origem_outro", e.target.value)}
            placeholder="Conte como chegou até aqui"
            aria-label="Como conheceu a prevIA"
            className="mt-3 h-12 text-base"
          />
        )}
      </Pergunta>
    </>
  );
}
