/**
 * O quiz da oferta. Componente, não rota, porque `/` precisa poder trocar
 * entre este e a LP no teste A/B sem mudar de URL — mesma URL nos dois braços
 * é o que mantém a atribuição do anúncio limpa e a comparação honesta.
 *
 * Reusa as primitivas do onboarding (`components/onboarding/campos`): mesma
 * densidade, mesmo marcador amarelo, mesmo alvo de toque. A pessoa que compra
 * atravessa os dois quizzes em sequência e eles precisam parecer o mesmo produto.
 */
import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import previaLogo from "@/assets/previa-logo.png.asset.json";
import {
  EscolhaMultipla,
  EscolhaUnica,
  Pergunta,
  TrilhoProgresso,
} from "@/components/onboarding/campos";
import {
  MAX_OBSTACULOS,
  MOMENTO,
  OBJETIVO,
  OBSTACULO,
  PASSOS,
  TOTAL_PASSOS,
  validarPasso,
  type Respostas,
} from "@/lib/quiz-oferta";
import { gravarRespostas, lerRespostas } from "@/lib/quiz-oferta.estado";
import { capturarOrigem, obterLeadId } from "@/lib/oferta-variante";

export function QuizOferta({ passo }: { passo: number }) {
  const navigate = useNavigate();
  const [respostas, setRespostas] = useState<Respostas>({});

  /*
   * As respostas só existem no cliente, então a primeira renderização (a do
   * servidor e a hidratação) sai sempre vazia e só depois recebe o que estava
   * guardado. Sem esse cuidado, o HTML do servidor e o do cliente divergiriam.
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

  function avancar() {
    const erros = validarPasso(passo, respostas);
    if (erros.length) {
      toast.error(erros[0]);
      return;
    }

    if (passo === TOTAL_PASSOS) {
      navigate({ to: "/resultado" });
      return;
    }
    irPara(passo + 1);
  }

  if (passo === 0) return <Abertura onComecar={() => irPara(1)} />;

  const meta = PASSOS[passo - 1]!;

  return (
    <div className="min-h-screen">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur">
        <TrilhoProgresso atual={passo} total={TOTAL_PASSOS} />
        <div className="mx-auto flex max-w-2xl items-center justify-between px-5 py-4 sm:px-8">
          <div>
            <div className="font-display text-base font-semibold tracking-tight">{meta.titulo}</div>
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
          {passo === 1 && (
            <Pergunta titulo="Como está o seu conteúdo hoje?">
              <EscolhaUnica
                opcoes={MOMENTO}
                valor={respostas.momento}
                onChange={(v) => definir("momento", v)}
                colunas={1}
              />
            </Pergunta>
          )}

          {passo === 2 && (
            <Pergunta
              titulo="O que mais trava você na hora de publicar?"
              apoio={`Escolha até ${MAX_OBSTACULOS}.`}
            >
              <EscolhaMultipla
                opcoes={OBSTACULO}
                valores={respostas.obstaculos ?? []}
                onChange={(v) => definir("obstaculos", v)}
                max={MAX_OBSTACULOS}
              />
            </Pergunta>
          )}

          {passo === 3 && (
            <Pergunta titulo="O que você quer que o conteúdo traga?">
              <EscolhaUnica
                opcoes={OBJETIVO}
                valor={respostas.objetivo}
                onChange={(v) => definir("objetivo", v)}
                colunas={1}
              />
            </Pergunta>
          )}
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
              className="inline-flex items-center gap-2 rounded-md bg-primary px-6 py-3 text-base font-medium
                text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                focus-visible:ring-offset-background"
            >
              {passo === TOTAL_PASSOS ? "Ver meu resultado" : "Continuar"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

/**
 * Tela de abertura — o primeiro contato de quem vem do anúncio.
 * Copy provisória: é aqui que a promessa da oferta vai morar.
 */
function Abertura({ onComecar }: { onComecar: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-xl space-y-8 text-center">
        <img src={previaLogo.url} alt="prevIA" className="mx-auto h-8 w-auto" />

        <div className="space-y-4">
          <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            Título provisório da oferta
          </h1>
          <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
            Subtítulo provisório. Três perguntas rápidas e você vê o diagnóstico.
          </p>
        </div>

        <button
          onClick={onComecar}
          className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-8 py-3 text-base
            font-medium text-primary-foreground transition hover:bg-primary/90
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Começar <ArrowRight className="h-4 w-4" />
        </button>

        <p className="text-sm text-muted-foreground">Leva menos de um minuto.</p>
      </div>
    </div>
  );
}
