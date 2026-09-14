/**
 * O quiz da oferta. Componente, não rota, porque `/` precisa poder trocar
 * entre este e a LP no teste A/B sem mudar de URL — mesma URL nos dois braços
 * é o que mantém a atribuição do anúncio limpa e a comparação honesta.
 *
 * Reusa as primitivas do onboarding (`components/onboarding/campos`): mesma
 * densidade, mesmo marcador amarelo, mesmo alvo de toque. A pessoa que compra
 * atravessa os dois quizzes em sequência e eles precisam parecer o mesmo
 * produto.
 *
 * Uma pergunta por tela, e o conteúdo vem todo de `PERGUNTAS`: este arquivo
 * não sabe o que está perguntando, só como renderizar cada tipo. Mudar a copy
 * é mexer em `lib/quiz-oferta.ts`, nunca aqui.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import previaLogo from "@/assets/previa-logo.png.asset.json";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EscolhaDias,
  EscolhaEstilo,
  EscolhaMultipla,
  EscolhaUnica,
  Pergunta as MolduraPergunta,
  TrilhoProgresso,
} from "@/components/onboarding/campos";
import {
  DIAS_DA_SEMANA,
  ESTILOS,
  PERGUNTAS,
  TOTAL_PERGUNTAS,
  ehOpcional,
  reconhecimento,
  validarPergunta,
  type Pergunta,
  type Respostas,
} from "@/lib/quiz-oferta";
import { gravarRespostas, lerRespostas } from "@/lib/quiz-oferta.estado";
import { salvarQuiz } from "@/lib/quiz-oferta.functions";
import { capturarOrigem, obterLeadId } from "@/lib/oferta-variante";

export function QuizOferta({ passo }: { passo: number }) {
  const navigate = useNavigate();
  const salvar = useServerFn(salvarQuiz);
  const [respostas, setRespostas] = useState<Respostas>({});
  const [enviando, setEnviando] = useState(false);

  /*
   * As respostas só existem no cliente, então a primeira renderização (a do
   * servidor e a da hidratação) sai sempre vazia e só depois recebe o que
   * estava guardado. Sem esse cuidado, o HTML do servidor e o do cliente
   * divergiriam.
   */
  useEffect(() => {
    setRespostas(lerRespostas());
  }, []);

  // A origem precisa ser lida na chegada, antes de qualquer navegação entre
  // passos reescrever a query string.
  useEffect(() => {
    capturarOrigem();
    obterLeadId();
  }, []);

  function definir<K extends keyof Respostas>(chave: K, valor: Respostas[K]) {
    setRespostas((r) => {
      const proximo = { ...r, [chave]: valor };
      gravarRespostas(proximo);
      return proximo;
    });
  }

  function irPara(destino: number) {
    navigate({ to: "/", search: destino === 0 ? {} : { passo: destino } });
    window.scrollTo({ top: 0, behavior: "auto" });
  }

  /**
   * Salva no servidor sem segurar a tela.
   *
   * O progresso parcial serve para saber em que pergunta o quiz perde gente;
   * não vale cobrar um round-trip por clique para isso. A gravação que importa
   * é a última, que leva o objeto inteiro e é aguardada.
   */
  function salvarEmSegundoPlano(atual: Respostas) {
    salvar({ data: { leadId: obterLeadId(), respostas: atual, origem: capturarOrigem() } }).catch(
      () => {
        // Silêncio proposital: perder uma gravação parcial não muda nada para
        // quem está respondendo, e um toast aqui só atrapalharia.
      },
    );
  }

  async function avancar() {
    const erro = validarPergunta(passo, respostas);
    if (erro) {
      toast.error(erro);
      return;
    }

    if (passo < TOTAL_PERGUNTAS) {
      salvarEmSegundoPlano(respostas);
      irPara(passo + 1);
      return;
    }

    // Última pergunta: aqui a gravação precisa ter chegado antes de gerar.
    setEnviando(true);
    try {
      await salvar({
        data: { leadId: obterLeadId(), respostas, origem: capturarOrigem() },
      });
      navigate({ to: "/oferta/processando" });
    } catch {
      setEnviando(false);
      toast.error("Não foi possível enviar suas respostas. Tente de novo.");
    }
  }

  function pular() {
    salvarEmSegundoPlano(respostas);
    irPara(passo + 1);
  }

  if (passo === 0) return <Abertura onComecar={() => irPara(1)} />;

  const pergunta = PERGUNTAS[passo - 1];
  if (!pergunta) return <Abertura onComecar={() => irPara(1)} />;

  const faltam = TOTAL_PERGUNTAS - passo;
  const opcional = ehOpcional(passo);
  const nota = reconhecimento(passo, respostas);

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur">
        <TrilhoProgresso atual={passo} total={TOTAL_PERGUNTAS} />
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
          <img src={previaLogo.url} alt="prevIA" className="h-6 w-auto" />
          {/*
           * Antecipação em vez de contabilidade: "faltam 3" diz o que a pessoa
           * ganha ao continuar, "passo 9 de 12" só diz onde ela está.
           */}
          <div className="num text-sm text-muted-foreground">
            {faltam === 0 ? "Última pergunta" : `Faltam ${faltam} para o seu DNA Viral`}
          </div>
        </div>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          avancar();
        }}
        className="mx-auto max-w-2xl px-5 pb-32 pt-8 sm:px-8"
      >
        <div
          key={passo}
          className="animate-in fade-in slide-in-from-bottom-2 duration-300 motion-reduce:animate-none"
        >
          <MolduraPergunta titulo={pergunta.titulo} apoio={pergunta.apoio}>
            <Campo pergunta={pergunta} respostas={respostas} definir={definir} />
          </MolduraPergunta>

          {nota && (
            <p
              aria-live="polite"
              className="mt-6 border-l-2 border-primary pl-4 text-base leading-relaxed text-muted-foreground
                animate-in fade-in duration-300 motion-reduce:animate-none"
            >
              {nota}
            </p>
          )}
        </div>

        <div className="fixed inset-x-0 bottom-0 border-t border-border bg-background/95 backdrop-blur">
          <div className="mx-auto flex max-w-2xl items-center justify-between gap-4 px-5 py-4 sm:px-8">
            <button
              type="button"
              onClick={() => irPara(passo - 1)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md px-3 py-2 text-base text-muted-foreground
                transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2
                focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <ArrowLeft className="h-4 w-4" /> Voltar
            </button>

            <div className="flex items-center gap-1">
              {opcional && (
                <button
                  type="button"
                  onClick={pular}
                  className="inline-flex min-h-11 items-center rounded-md px-3 py-2 text-base text-muted-foreground
                    transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2
                    focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  Pular
                </button>
              )}
              <button
                type="submit"
                disabled={enviando}
                className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-6 py-3 text-base
                  font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60
                  focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                  focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {enviando && <Loader2 className="h-4 w-4 animate-spin" />}
                {passo === TOTAL_PERGUNTAS ? "Ver meu DNA Viral" : "Continuar"}
                {!enviando && <ArrowRight className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}

/** Renderiza o widget do tipo da pergunta e, quando pedido, o campo extra. */
function Campo({
  pergunta,
  respostas,
  definir,
}: {
  pergunta: Pergunta;
  respostas: Respostas;
  definir: <K extends keyof Respostas>(chave: K, valor: Respostas[K]) => void;
}) {
  const extra = pergunta.extra?.quando(respostas) ? pergunta.extra : null;

  return (
    <>
      {pergunta.tipo === "unica" && (
        <EscolhaUnica
          opcoes={pergunta.opcoes ?? []}
          valor={respostas[pergunta.campo] as string | undefined}
          onChange={(v) => definir(pergunta.campo, v as never)}
          colunas={pergunta.colunas}
        />
      )}

      {/*
       * O widget fala em texto e o campo guarda booleano. A tradução fica aqui
       * para o valor gravado continuar idêntico ao que o onboarding espera.
       */}
      {pergunta.tipo === "sim_nao" && (
        <EscolhaUnica
          opcoes={pergunta.opcoes ?? []}
          valor={
            respostas[pergunta.campo] === true
              ? "sim"
              : respostas[pergunta.campo] === false
                ? "nao"
                : undefined
          }
          onChange={(v) => definir(pergunta.campo, (v === "sim") as never)}
          colunas={pergunta.colunas}
        />
      )}

      {pergunta.tipo === "multipla" && (
        <EscolhaMultipla
          opcoes={pergunta.opcoes ?? []}
          valores={(respostas[pergunta.campo] as string[] | undefined) ?? []}
          onChange={(v) => definir(pergunta.campo, v as never)}
          max={pergunta.max ?? 1}
          colunas={pergunta.colunas}
        />
      )}

      {pergunta.tipo === "estilo" && (
        <EscolhaEstilo
          estilos={ESTILOS}
          valor={respostas.estilo_narrativo}
          onChange={(v) => definir("estilo_narrativo", v)}
        />
      )}

      {pergunta.tipo === "dias" && (
        <EscolhaDias
          dias={DIAS_DA_SEMANA}
          valores={respostas.ritmo_dias ?? []}
          onChange={(v) => definir("ritmo_dias", v)}
        />
      )}

      {pergunta.tipo === "texto" && (
        <Input
          value={(respostas[pergunta.campo] as string | undefined) ?? ""}
          onChange={(e) => definir(pergunta.campo, e.target.value as never)}
          placeholder={pergunta.placeholder}
          aria-label={pergunta.titulo}
          autoComplete="off"
          className="h-12 text-base"
        />
      )}

      {pergunta.tipo === "texto_longo" && (
        <Textarea
          value={(respostas[pergunta.campo] as string | undefined) ?? ""}
          onChange={(e) => definir(pergunta.campo, e.target.value as never)}
          placeholder={pergunta.placeholder}
          aria-label={pergunta.titulo}
          rows={4}
          className="text-base"
        />
      )}

      {extra && (
        <div className="mt-4 animate-in fade-in duration-200 motion-reduce:animate-none">
          <label
            htmlFor={`extra-${String(extra.campo)}`}
            className="mb-1.5 block text-sm text-muted-foreground"
          >
            {extra.rotulo}
          </label>
          <Input
            id={`extra-${String(extra.campo)}`}
            value={(respostas[extra.campo] as string | undefined) ?? ""}
            onChange={(e) => definir(extra.campo, e.target.value as never)}
            placeholder={extra.placeholder}
            autoComplete="off"
            className="h-12 text-base"
          />
        </div>
      )}
    </>
  );
}

/**
 * A primeira tela de quem vem do anúncio.
 *
 * Promete o artefato, não o quiz: ninguém quer responder perguntas, todo mundo
 * quer o resultado. O que segura a pessoa aqui é saber o que recebe e que isso
 * custa pouco tempo.
 */
function Abertura({ onComecar }: { onComecar: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-xl space-y-8">
        <img src={previaLogo.url} alt="prevIA" className="h-8 w-auto" />

        <div className="space-y-5">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Diagnóstico de conteúdo · advocacia
          </div>
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.75rem]">
            Descubra o DNA Viral do seu conteúdo.
          </h1>
          <p className="text-lg leading-relaxed text-muted-foreground">
            Doze perguntas sobre como você trabalha hoje. No fim, um diagnóstico escrito para o seu
            caso: o que está travando a sua constância, os três pilares que sustentam a sua
            autoridade e três ganchos prontos para gravar.
          </p>
        </div>

        <div className="space-y-4">
          <button
            onClick={onComecar}
            className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-8 py-3.5 text-base
              font-medium text-primary-foreground transition hover:bg-primary/90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Começar o diagnóstico <ArrowRight className="h-4 w-4" />
          </button>
          <p className="num text-sm text-muted-foreground">
            Leva cerca de 2 minutos · Não pedimos e-mail para ver o resultado
          </p>
        </div>
      </div>
    </div>
  );
}
