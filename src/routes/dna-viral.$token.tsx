import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import previaLogo from "@/assets/previa-logo.png.asset.json";
import { Input } from "@/components/ui/input";
import { getDnaViral, getOfertaPublica, salvarEmailLead } from "@/lib/quiz-oferta.functions";
import { capturarOrigem, obterLeadId } from "@/lib/oferta-variante";
import type { DnaViral } from "@/lib/dna-viral";

/**
 * O DNA Viral — o relatório público, no seu endereço permanente.
 *
 * O token é a única credencial: quem tem o link vê o documento. Por isso a
 * leitura devolve só o relatório e o primeiro nome, nunca o e-mail nem as
 * respostas cruas.
 *
 * DIREÇÃO: o documento se lê como um parecer, não como uma página de vendas.
 * Seções numeradas, metadados em mono, fios finos, o amarelo só como marcador.
 * O público é advogado: documento é a forma que esse leitor respeita, e é o que
 * faz um diagnóstico gratuito parecer trabalho em vez de isca.
 *
 * Essa escolha também resolve o download: `data-print-root` / `data-print-hide`
 * com o CSS de impressão que o manual de marca já usa. Sem biblioteca nova, e
 * o PDF sai com a mesma cara da tela.
 */
export const Route = createFileRoute("/dna-viral/$token")({
  // Sem `ssr: false`: o token está na URL, então o documento pode ser montado
  // no servidor e chegar pronto. É um relatório para ler, não um app.
  loader: async ({ params }) => {
    const [dna, oferta] = await Promise.all([
      getDnaViral({ data: { token: params.token } }),
      getOfertaPublica(),
    ]);
    if (!dna) throw notFound();
    return { dna, oferta };
  },
  head: () => ({
    meta: [
      { title: "Seu DNA Viral | prevIA" },
      {
        name: "description",
        content: "O diagnóstico de conteúdo do seu perfil, feito a partir das suas respostas.",
      },
      // Documento de uma pessoa só. Não é porta de entrada e não deve ser
      // encontrado por busca.
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: Relatorio,
  notFoundComponent: NaoEncontrado,
});

function Relatorio() {
  const { dna, oferta } = Route.useLoaderData();
  const { relatorio, primeiroNome, geradoEm, temEmail } = dna;

  // Numeração automática, igual ao manual de marca: a seção que não vier no
  // JSON não deixa buraco na sequência.
  let secao = 0;
  const proxima = () => String(++secao).padStart(2, "0");

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-10 sm:py-14" data-print-root>
      <header className="border-b border-border pb-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              DNA Viral · diagnóstico de conteúdo
            </div>
            <h1 className="ai-mark mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.5rem]">
              {relatorio.arquetipo.nome}
            </h1>
            <p className="num mt-3 text-sm text-muted-foreground">
              {[primeiroNome, geradoEm && new Date(geradoEm).toLocaleDateString("pt-BR")]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>

          <button
            onClick={() => window.print()}
            data-print-hide
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-md border border-border px-4 py-2
              text-sm transition hover:bg-surface-elevated focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Download className="h-4 w-4" />
            Baixar PDF
          </button>
        </div>

        <p className="mt-6 font-display text-lg leading-snug sm:text-xl">
          {relatorio.arquetipo.uma_linha}
        </p>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          {relatorio.arquetipo.descricao}
        </p>
      </header>

      {relatorio.diagnostico.o_que_trava && (
        <Secao numero={proxima()} titulo="O que trava você">
          <p className="border-l-2 border-primary pl-4 font-display text-lg leading-snug sm:text-xl">
            {relatorio.diagnostico.o_que_trava}
          </p>
          {relatorio.diagnostico.por_que && (
            <p className="mt-5 text-base leading-relaxed text-muted-foreground">
              {relatorio.diagnostico.por_que}
            </p>
          )}
        </Secao>
      )}

      {relatorio.pilares.length > 0 && (
        <Secao numero={proxima()} titulo="Seus pilares de conteúdo">
          <div className="space-y-8">
            {relatorio.pilares.map((pilar) => (
              <div key={pilar.nome}>
                <h3 className="font-display text-lg font-semibold tracking-tight">{pilar.nome}</h3>
                <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
                  {pilar.por_que}
                </p>
                {pilar.exemplos_de_tema.length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {pilar.exemplos_de_tema.map((tema) => (
                      <li key={tema} className="flex gap-2.5 text-base leading-relaxed">
                        <span
                          aria-hidden
                          className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                        />
                        {tema}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {relatorio.ganchos.length > 0 && (
        <Secao
          numero={proxima()}
          titulo="Três ganchos prontos"
          apoio="Escritos na sua área e no estilo que você reconheceu. Dá para gravar hoje."
        >
          <div className="space-y-4">
            {relatorio.ganchos.map((gancho, i) => (
              <div
                key={i}
                className="break-inside-avoid rounded-lg border border-border bg-surface p-5 sm:p-6"
              >
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  {gancho.formato}
                </div>
                <p className="mt-3 font-display text-lg leading-snug sm:text-xl">
                  <span aria-hidden>“</span>
                  {gancho.texto}
                  <span aria-hidden>”</span>
                </p>
              </div>
            ))}
          </div>
        </Secao>
      )}

      {relatorio.o_que_falta && (
        <Secao numero={proxima()} titulo="O que este documento não faz">
          <p className="text-base leading-relaxed text-muted-foreground">{relatorio.o_que_falta}</p>
        </Secao>
      )}

      <Oferta oferta={oferta} relatorio={relatorio} />
      <GuardarPorEmail token={Route.useParams().token} jaTemEmail={temEmail} />

      <footer className="mt-16 border-t border-border pt-6" data-print-hide>
        <img src={previaLogo.url} alt="prevIA" className="h-6 w-auto opacity-60" />
      </footer>
    </div>
  );
}

function Secao({
  numero,
  titulo,
  apoio,
  children,
}: {
  numero: string;
  titulo: string;
  apoio?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="flex items-baseline gap-3 border-b border-border pb-3">
        <span className="num text-sm text-muted-foreground">{numero}</span>
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h2>
      </div>
      {apoio && <p className="mt-4 text-base text-muted-foreground">{apoio}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

/**
 * A oferta, depois do documento inteiro.
 *
 * Vem no fim de propósito: a pessoa já recebeu o que foi prometido antes de
 * ver qualquer preço. Fora da impressão — o PDF que ela guarda é o
 * diagnóstico, não o anúncio.
 */
function Oferta({
  oferta,
  relatorio,
}: {
  oferta: {
    nome: string;
    codigo: string;
    precoCentavos: number | null;
    checkoutUrl: string;
  } | null;
  relatorio: DnaViral;
}) {
  const [href, setHref] = useState<string | null>(null);

  /*
   * O link só é montado no cliente: o lead id e a origem moram no navegador.
   * `s3` e nunca `s1` — o webhook da Kiwify trata `s1` como conta_id sempre que
   * tem 36 caracteres, e um randomUUID tem exatamente 36.
   */
  useEffect(() => {
    if (!oferta) return;
    try {
      const url = new URL(oferta.checkoutUrl);
      url.searchParams.set("s2", oferta.codigo);
      url.searchParams.set("s3", obterLeadId());
      for (const [chave, valor] of Object.entries(capturarOrigem())) {
        if (valor) url.searchParams.set(chave, valor);
      }
      setHref(url.toString());
    } catch {
      setHref(oferta.checkoutUrl);
    }
  }, [oferta]);

  if (!oferta) return null;

  const preco =
    oferta.precoCentavos != null
      ? (oferta.precoCentavos / 100).toLocaleString("pt-BR", {
          style: "currency",
          currency: "BRL",
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        })
      : null;

  return (
    <section
      className="mt-16 rounded-lg border border-border bg-surface p-6 sm:p-8"
      data-print-hide
    >
      <h2 className="font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
        A parte que continua toda semana
      </h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {relatorio.o_que_falta
          ? "É esse trabalho que a prevIA assume:"
          : "A prevIA assume o trabalho que se repete:"}{" "}
        ela acompanha o que está performando na sua área, transforma isso em pauta com a sua voz e
        deixa o roteiro pronto nos dias em que você se comprometeu a publicar.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <a
          href={href ?? oferta.checkoutUrl}
          className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-8 py-3.5 text-base
            font-medium text-primary-foreground transition hover:bg-primary/90
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Começar com a prevIA <ArrowRight className="h-4 w-4" />
        </a>
        {preco && <span className="num text-sm text-muted-foreground">{preco} por mês</span>}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        Suas respostas já vão com você: o cadastro começa do ponto onde este diagnóstico parou.
      </p>
    </section>
  );
}

/**
 * Captura de e-mail — depois do relatório inteiro, nunca antes.
 *
 * O documento não é refém do e-mail. Pedir aqui é oferecer uma entrega (guardar
 * o link), não cobrar um pedágio por algo que a pessoa já ganhou.
 */
function GuardarPorEmail({ token, jaTemEmail }: { token: string; jaTemEmail: boolean }) {
  const salvar = useServerFn(salvarEmailLead);
  const [email, setEmail] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [pronto, setPronto] = useState(jaTemEmail);

  if (pronto) {
    return (
      <p
        className="mt-8 flex items-center gap-2 text-base text-muted-foreground"
        data-print-hide
        aria-live="polite"
      >
        <Check className="h-4 w-4 text-success" />O link deste relatório está guardado no seu
        e-mail.
      </p>
    );
  }

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await salvar({ data: { token, email } });
      setPronto(true);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <form onSubmit={enviar} className="mt-8" data-print-hide>
      <label htmlFor="email-dna" className="block text-base text-muted-foreground">
        Quer guardar o link deste relatório? Deixe seu e-mail.
      </label>
      <div className="mt-3 flex flex-wrap gap-2">
        <Input
          id="email-dna"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="seu@email.com"
          autoComplete="email"
          className="h-12 min-w-0 flex-1 text-base"
        />
        <button
          type="submit"
          disabled={salvando}
          className="inline-flex min-h-12 items-center gap-2 rounded-md border border-border px-5 py-3
            text-base transition hover:bg-surface-elevated disabled:opacity-60
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {salvando && <Loader2 className="h-4 w-4 animate-spin" />}
          Guardar
        </button>
      </div>
    </form>
  );
}

function NaoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 text-center">
      <img src={previaLogo.url} alt="prevIA" className="h-8 w-auto" />
      <div className="space-y-2">
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          Este relatório não está aqui
        </h1>
        <p className="max-w-md text-base text-muted-foreground">
          O link pode ter sido digitado errado. Responder o diagnóstico de novo leva dois minutos.
        </p>
      </div>
      <Link
        to="/"
        className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-6 py-3 text-base
          font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
          focus-visible:ring-offset-background"
      >
        Fazer o diagnóstico <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
