import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { gerarDnaViral } from "@/lib/quiz-oferta.functions";
import { obterLeadId } from "@/lib/oferta-variante";

/**
 * A ponte entre a última resposta e o relatório.
 *
 * A geração é uma chamada de modelo de verdade e leva alguns segundos, então
 * esta tela existe para dar conta do tempo — não para inventar suspense. As
 * fases descrevem trabalho que está de fato acontecendo do outro lado.
 *
 * `ssr: false` porque não há nada para renderizar no servidor: a tela só
 * funciona com o lead id que mora no navegador.
 */
export const Route = createFileRoute("/oferta/processando")({
  ssr: false,
  head: () => ({
    meta: [{ title: "Montando o seu DNA Viral | prevIA" }, { name: "robots", content: "noindex" }],
  }),
  component: Processando,
});

/**
 * Piso de tempo. Se a geração voltar quase instantânea — o caso do relatório
 * curado — a tela pisca e a pessoa não entende o que aconteceu. Não é espera
 * fabricada: é o mínimo para a transição ser legível.
 */
const DURACAO_MINIMA_MS = 2_500;

/*
 * Os tempos vêm de medição, não de chute: a geração real levou ~44s com as
 * respostas de um quiz completo. Fases que terminassem antes disso deixariam
 * a tela parada na última por meio minuto, que é exatamente a sensação de
 * travado que faz a pessoa fechar a aba.
 */
const FASES = [
  { ate: 6, texto: "Lendo suas respostas" },
  { ate: 16, texto: "Mapeando o seu posicionamento" },
  { ate: 30, texto: "Identificando o que trava a sua constância" },
  { ate: Infinity, texto: "Escrevendo os seus ganchos" },
];

function Processando() {
  const navigate = useNavigate();
  const gerar = useServerFn(gerarDnaViral);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);
  const jaRodou = useRef(false);

  useEffect(() => {
    const timer = setInterval(() => setSegundos((s) => s + 0.25), 250);
    return () => clearInterval(timer);
  }, [tentativa]);

  useEffect(() => {
    if (jaRodou.current) return;
    jaRodou.current = true;
    let cancelado = false;

    (async () => {
      const comecou = Date.now();
      try {
        const { token } = await gerar({ data: { leadId: obterLeadId() } });
        if (cancelado) return;

        const restante = DURACAO_MINIMA_MS - (Date.now() - comecou);
        if (restante > 0) await new Promise((r) => setTimeout(r, restante));
        if (cancelado) return;

        navigate({ to: "/dna-viral/$token", params: { token }, replace: true });
      } catch (e) {
        if (cancelado) return;
        setErro(e instanceof Error ? e.message : "Não foi possível montar o seu relatório.");
      }
    })();

    return () => {
      cancelado = true;
    };
  }, [gerar, navigate, tentativa]);

  if (erro) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 text-center">
        <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="h-8 w-auto" />
        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Travou no último passo
          </h1>
          <p className="max-w-md text-base text-muted-foreground">{erro}</p>
        </div>
        <button
          onClick={() => {
            setErro(null);
            setSegundos(0);
            jaRodou.current = false;
            setTentativa((t) => t + 1);
          }}
          className="inline-flex min-h-12 items-center rounded-md bg-primary px-6 py-3 text-base font-medium
            text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none
            focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
            focus-visible:ring-offset-background"
        >
          Tentar de novo
        </button>
      </div>
    );
  }

  const faseAtual = FASES.findIndex((f) => segundos < f.ate);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-md space-y-8">
        <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="h-8 w-auto" />

        <div className="space-y-2">
          <h1 className="font-display text-2xl font-semibold leading-snug tracking-tight sm:text-3xl">
            Montando o seu DNA Viral
          </h1>
          <p className="num text-sm text-muted-foreground">Leva menos de um minuto.</p>
        </div>

        <ul className="space-y-3" aria-live="polite">
          {FASES.map((fase, i) => {
            const concluida = i < faseAtual;
            const ativa = i === faseAtual;
            return (
              <li
                key={fase.texto}
                className={`flex items-center gap-3 text-base ${
                  ativa
                    ? "text-foreground"
                    : concluida
                      ? "text-muted-foreground"
                      : "text-subtle-foreground"
                }`}
              >
                <span className="grid w-4 place-items-center">
                  {concluida ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : ativa ? (
                    <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" />
                  ) : (
                    <span className="h-1.5 w-1.5 rounded-full bg-border" />
                  )}
                </span>
                {fase.texto}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
