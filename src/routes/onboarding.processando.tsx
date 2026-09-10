import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2, RotateCw } from "lucide-react";
import { concluirOnboarding, getOnboarding } from "@/lib/onboarding.functions";

/**
 * Fecha o onboarding enquanto conta o que está acontecendo.
 *
 * Não é uma tela de espera decorativa: os 40 segundos aqui são o tempo em que
 * a primeira coleta de referências roda em segundo plano. Quem termina de ler
 * o manual encontra a curadoria com conteúdo em vez de um app vazio.
 */
const FASES = [
  { ate: 4, texto: "Lendo suas respostas" },
  { ate: 12, texto: "Mapeando seu posicionamento" },
  { ate: 22, texto: "Selecionando as referências da sua área" },
  { ate: Infinity, texto: "Escrevendo o seu manual de marca" },
];

const DURACAO_MINIMA_MS = 6_000;

export const Route = createFileRoute("/onboarding/processando")({
  head: () => ({
    meta: [
      { title: "Montando seu manual | prevIA" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Processando,
});

function Processando() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const carregar = useServerFn(getOnboarding);
  const concluir = useServerFn(concluirOnboarding);

  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const jaRodou = useRef(false);

  useEffect(() => {
    const inicio = Date.now();
    const timer = setInterval(() => {
      setSegundos(Math.floor((Date.now() - inicio) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [tentativa]);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;

    let cancelado = false;
    const inicio = Date.now();

    (async () => {
      try {
        const estado = await carregar();
        const resultado = await concluir({ data: { respostas: estado.respostas ?? {} } });

        const decorrido = Date.now() - inicio;
        if (decorrido < DURACAO_MINIMA_MS) {
          await new Promise((r) => setTimeout(r, DURACAO_MINIMA_MS - decorrido));
        }
        if (cancelado) return;

        // O gate de _authenticated lê o onboarding: precisa vir fresco.
        queryClient.invalidateQueries();

        navigate({
          to: "/dna",
          search: resultado.relatorioId ? { novo: true } : undefined,
        });
      } catch (e) {
        if (cancelado) return;
        setErro(
          e instanceof Error
            ? e.message
            : "Não foi possível concluir. Tente novamente em instantes.",
        );
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [carregar, concluir, navigate, queryClient, tentativa]);

  if (erro) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 text-center">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Travou no último passo
        </h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">{erro}</p>
        <button
          type="button"
          onClick={() => {
            setErro(null);
            setSegundos(0);
            jaRodou.current = false;
            setTentativa((t) => t + 1);
          }}
          className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-6 py-3
            text-base font-medium text-primary-foreground transition hover:bg-primary/90
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <RotateCw className="h-4 w-4" /> Tentar de novo
        </button>
      </div>
    );
  }

  const faseAtual = FASES.findIndex((f) => segundos < f.ate);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="flex items-center gap-3">
        <span
          aria-hidden
          className="h-2.5 w-2.5 rounded-[2px] bg-primary animate-pulse motion-reduce:animate-none"
        />
        <span className="text-sm text-muted-foreground">Isso leva menos de um minuto</span>
      </div>

      <h1 className="mt-6 font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
        Montando o seu manual de marca
      </h1>

      <ul className="mt-10 space-y-4" aria-live="polite">
        {FASES.map((fase, i) => {
          const concluida = i < faseAtual;
          const ativa = i === faseAtual;
          return (
            <li key={fase.texto} className="flex items-center gap-3">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                {concluida ? (
                  <Check className="h-4 w-4 text-success" />
                ) : ativa ? (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" />
                ) : (
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-border" />
                )}
              </span>
              <span
                className={
                  concluida || ativa
                    ? "text-base text-foreground"
                    : "text-base text-muted-foreground/60"
                }
              >
                {fase.texto}
              </span>
            </li>
          );
        })}
      </ul>

      <p className="mt-10 border-t border-border pt-6 text-base leading-relaxed text-muted-foreground">
        Enquanto isso a prevIA já começou a ler os perfis que você indicou. Quando você terminar
        de ver o manual, a curadoria vai estar esperando na sua tela.
      </p>
    </div>
  );
}
