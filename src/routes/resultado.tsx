import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, RotateCcw } from "lucide-react";
import previaLogo from "@/assets/previa-logo.png.asset.json";
import { diagnosticar, type Diagnostico, type Respostas } from "@/lib/quiz-oferta";
import { lerRespostas } from "@/lib/quiz-oferta.estado";
import { capturarOrigem, obterLeadId } from "@/lib/oferta-variante";

/**
 * O resultado do quiz: o diagnóstico e a oferta.
 *
 * Rota própria, e não um passo final dentro de `/`, por dois motivos: é o
 * evento de conversão que a gente vai querer medir isolado, e é para onde a
 * pessoa volta se desistir do checkout e clicar em "voltar" no navegador.
 */
export const Route = createFileRoute("/resultado")({
  head: () => ({
    meta: [
      { title: "Seu resultado | prevIA" },
      {
        name: "description",
        content: "Descrição provisória do resultado. Entra junto com a copy.",
      },
      // A página de resultado não é porta de entrada: quem cai aqui sem ter
      // respondido não vê nada útil. Fora do índice.
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Resultado,
});

/**
 * TODO: trocar pelo checkout real.
 *
 * O link certo já existe no banco, em `planos.checkout_url`, configurado pelo
 * admin — é de lá que a `/assinatura` monta o dela. Só que aquela leitura passa
 * por server function autenticada, e aqui a pessoa é anônima. Ligar isso pede
 * uma leitura pública dos planos ativos; fica para a etapa de costura do funil.
 */
const CHECKOUT_URL = "";

function Resultado() {
  const [respostas, setRespostas] = useState<Respostas | null>(null);

  // Igual ao quiz: as respostas só existem no navegador, então a primeira
  // renderização sai vazia e o conteúdo chega na hidratação.
  useEffect(() => {
    setRespostas(lerRespostas());
  }, []);

  if (respostas === null) return <Carregando />;

  const vazio = !respostas.momento && !respostas.objetivo;
  if (vazio) return <SemRespostas />;

  const diagnostico = diagnosticar(respostas);

  return (
    <div className="flex min-h-screen flex-col items-center px-5 py-16 sm:px-8">
      <div className="w-full max-w-xl space-y-10">
        <img src={previaLogo.url} alt="prevIA" className="mx-auto h-8 w-auto" />

        <Bloco diagnostico={diagnostico} />

        <div className="space-y-4 border-t border-border pt-10">
          <h2 className="font-display text-2xl font-semibold leading-tight tracking-tight">
            Título provisório da oferta
          </h2>
          <p className="text-base leading-relaxed text-muted-foreground">
            Corpo provisório da oferta. Entra junto com a copy, usando o diagnóstico acima como
            ponte.
          </p>

          <CtaCheckout />
        </div>

        <div className="text-center">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground
              transition hover:text-foreground focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <RotateCcw className="h-4 w-4" /> Refazer o quiz
          </Link>
        </div>
      </div>
    </div>
  );
}

function Bloco({ diagnostico }: { diagnostico: Diagnostico }) {
  return (
    <section className="space-y-3 text-center">
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        Resultado
      </div>
      <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
        {diagnostico.titulo}
      </h1>
      <p className="text-base leading-relaxed text-muted-foreground sm:text-lg">
        {diagnostico.texto}
      </p>
    </section>
  );
}

/**
 * O botão que leva ao checkout, carregando quem a pessoa é e de onde veio.
 *
 * `s3` e não `s1`: o webhook em `routes/api/public/webhooks/kiwify` trata `s1`
 * como `conta_id` sempre que o valor tem 36 caracteres, e um `randomUUID()`
 * tem exatamente 36 — o lead entraria lá como se fosse uma conta existente.
 * `s2` também já é usado, para o código do plano.
 */
function CtaCheckout() {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!CHECKOUT_URL) return;

    const url = new URL(CHECKOUT_URL);
    url.searchParams.set("s3", obterLeadId());
    for (const [chave, valor] of Object.entries(capturarOrigem())) {
      if (valor) url.searchParams.set(chave, valor);
    }
    setHref(url.toString());
  }, []);

  if (!href) {
    return (
      <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
        O botão de checkout aparece aqui quando o link do plano estiver ligado.
      </div>
    );
  }

  return (
    <a
      href={href}
      className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-8 py-3 text-base
        font-medium text-primary-foreground transition hover:bg-primary/90
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      Texto provisório do botão <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function Carregando() {
  return <div className="min-h-screen" aria-hidden />;
}

function SemRespostas() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 text-center">
      <img src={previaLogo.url} alt="prevIA" className="h-8 w-auto" />
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Ainda não temos seu resultado
        </h1>
        <p className="text-base text-muted-foreground">
          São três perguntas rápidas. Leva menos de um minuto.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-6 py-3 text-base
          font-medium text-primary-foreground transition hover:bg-primary/90
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
          focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      >
        Responder o quiz <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
