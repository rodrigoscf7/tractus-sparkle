import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Download, Mail } from "lucide-react";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { getDnaViral, getOfertaPublica } from "@/lib/quiz-oferta.functions";
import { capturarOrigem, obterLeadId } from "@/lib/oferta-variante";
import { rastrear } from "@/lib/pixel";
import { lerRespostas } from "@/lib/quiz-oferta.estado";
import { LinksLegais } from "@/components/legal/PaginaLegal";
import { statusDoScore, type DimensaoScore, type FaixaScore } from "@/lib/dna-viral-score";
import { ARQUETIPOS_DO_QUIZ, type DnaViral } from "@/lib/dna-viral";

/**
 * O DNA Viral — o relatório público, no seu endereço permanente.
 *
 * O token é a única credencial: quem tem o link vê o documento. Por isso a
 * leitura devolve só o relatório e o primeiro nome, nunca o e-mail nem as
 * respostas cruas.
 *
 * Ordem: vídeo + CTA no topo, score, gargalos, a ponte entre o gargalo e a
 * prevIA, pilares, roteiros, CTA do meio e a oferta completa (o que chega,
 * como funciona, preço, perguntas). No celular, uma barra fixa com o preço
 * aparece depois do topo. O PDF (`data-print-hide`) continua como parecer:
 * sem vídeo, sem preço e sem checkout.
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
      { title: "Seu diagnóstico | prevIA" },
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

type OfertaPublica = {
  nome: string;
  codigo: string;
  precoCentavos: number | null;
  precoDeCentavos: number | null;
  checkoutUrl: string;
} | null;

function Relatorio() {
  const { dna, oferta } = Route.useLoaderData();
  const { relatorio, primeiroNome, geradoEm, temEmail } = dna;

  const gargalos = relatorio.gargalos ?? [];
  const score = relatorio.score;

  useEffect(() => {
    rastrear("ViewContent", { content_name: "relatorio_dna_viral" });
  }, []);

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-10 sm:py-14" data-print-root>
      {/* ---- Cabeçalho + vídeo + CTA (fora do PDF) ---- */}
      <header className="border-b border-border pb-8" data-print-hide>
        <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="mb-6 h-7 w-auto" />
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          {primeiroNome ? `${primeiroNome}, o` : "O"} seu diagnóstico está pronto.
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Logo abaixo estão o seu perfil, a nota de cada ponto e 3 roteiros para gravar hoje. A
          prevIA entrega isso toda semana, no seu tom, a partir do que está performando nos perfis
          que você acompanha.
        </p>
        {temEmail && (
          <p className="mt-3 flex items-start gap-2 text-sm text-muted-foreground">
            <Mail className="mt-0.5 h-4 w-4 shrink-0" />O link deste diagnóstico também vai para o seu
            e-mail, para você voltar a ele quando quiser.
          </p>
        )}

        {VIDEO_URL && (
          <p className="mt-6 text-sm font-medium">
            Assista ao vídeo: em 2 minutos, como manter isso toda semana.
          </p>
        )}
        <VideoDiagnostico />

        <div id="cta-topo" className="mt-6">
          <BlocoCta oferta={oferta} rotulo="Resgatar meu bônus" />
        </div>
      </header>

      {/* ---- Cabeçalho do PDF / arquétipo (só com substância) ---- */}
      <div className="mt-10 border-b border-border pb-8">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              DNA Viral · diagnóstico de conteúdo
            </div>
            {relatorio.arquetipo ? (
              <>
                <h2 className="ai-mark mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.5rem]">
                  {relatorio.arquetipo.nome}
                </h2>
                <p className="num mt-3 text-sm text-muted-foreground">
                  {[primeiroNome, geradoEm && new Date(geradoEm).toLocaleDateString("pt-BR")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            ) : (
              <>
                <h2 className="mt-4 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-[2.5rem]">
                  Seu diagnóstico de conteúdo
                </h2>
                <p className="num mt-3 text-sm text-muted-foreground">
                  {[primeiroNome, geradoEm && new Date(geradoEm).toLocaleDateString("pt-BR")]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </>
            )}
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

        {relatorio.arquetipo && (
          <>
            <p className="mt-6 font-display text-lg leading-snug sm:text-xl">
              {relatorio.arquetipo.uma_linha}
            </p>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground">
              {relatorio.arquetipo.descricao}
            </p>
          </>
        )}
      </div>

      {score && score.length > 0 && <PainelScore score={score} />}

      {gargalos.length > 0 && (
        <Secao titulo="Gargalos que estão travando o seu perfil">
          <div className="space-y-8">
            {gargalos.map((g, i) => (
              <div key={`${g.titulo}-${i}`}>
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  Gargalo #{i + 1}: {g.titulo}
                </h3>
                <p className="mt-2 text-base leading-relaxed text-muted-foreground">{g.texto}</p>
              </div>
            ))}
          </div>
        </Secao>
      )}

      <PonteArquetipo
        arquetipo={relatorio.arquetipo?.nome ?? null}
        gargalo={gargalos[0]?.titulo ?? null}
      />

      {relatorio.pilares.length > 0 && (
        <Secao titulo="Seus pilares de autoridade">
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

      {(relatorio.roteiros?.length ?? 0) > 0 && (
        <Secao
          titulo="Seus 3 roteiros prontos para gravar hoje"
          apoio="Cada um tem de 30 a 50 segundos e está escrito palavra por palavra, na ordem em que você fala: abertura, miolo e fecho. É para abrir, ler e gravar."
        >
          <div className="space-y-6">
            {relatorio.roteiros.map((roteiro, i) => (
              <div
                key={i}
                className="break-inside-avoid rounded-lg border border-border bg-surface p-5 sm:p-6"
              >
                <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
                  Roteiro {i + 1}
                  {roteiro.formato ? ` · ${roteiro.formato}` : ""}
                </div>
                <div className="mt-4 space-y-4">
                  <div>
                    <div className="text-sm font-medium text-muted-foreground">Gancho</div>
                    <p className="mt-1.5 font-display text-lg leading-snug sm:text-xl">
                      <span aria-hidden>“</span>
                      {roteiro.gancho}
                      <span aria-hidden>”</span>
                    </p>
                  </div>
                  {roteiro.desenvolvimento && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">
                        Desenvolvimento
                      </div>
                      <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
                        {roteiro.desenvolvimento}
                      </p>
                    </div>
                  )}
                  {roteiro.fecho && (
                    <div>
                      <div className="text-sm font-medium text-muted-foreground">Fecho</div>
                      <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
                        {roteiro.fecho}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-6 text-base leading-relaxed text-muted-foreground">
            Ajuste as palavras ao seu jeito de falar. A estrutura é o que sustenta a retenção, e ela
            já está montada.
          </p>
          <CtaMeio oferta={oferta} />
        </Secao>
      )}

      {relatorio.o_que_falta && (
        <Secao titulo="O que este documento não faz">
          <p className="text-base leading-relaxed text-muted-foreground">{relatorio.o_que_falta}</p>
        </Secao>
      )}

      <Oferta oferta={oferta} />

      <footer className="mt-16 border-t border-border pt-6" data-print-hide>
        <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="h-6 w-auto opacity-60" />
        <LinksLegais className="mt-4" />
      </footer>

      <BarraFixa oferta={oferta} />
    </div>
  );
}

function Secao({
  titulo,
  apoio,
  children,
}: {
  titulo: string;
  apoio?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14">
      <div className="border-b border-border pb-3">
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h2>
      </div>
      {apoio && <p className="mt-4 text-base text-muted-foreground">{apoio}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

const COR_FAIXA: Record<FaixaScore, string> = {
  vermelha: "bg-destructive",
  amarela: "bg-warning",
  verde: "bg-success",
};

const COR_TEXTO_FAIXA: Record<FaixaScore, string> = {
  vermelha: "text-destructive",
  amarela: "text-warning",
  verde: "text-success",
};

function PainelScore({ score }: { score: DimensaoScore[] }) {
  return (
    <section className="mt-14">
      <div className="rounded-lg border border-border bg-surface p-6 sm:p-8">
        <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
          Status atual do seu perfil
        </div>
        <p className="mt-2 font-display text-lg font-semibold leading-snug tracking-tight sm:text-xl">
          {statusDoScore(score)}
        </p>
        <p className="mt-4 text-sm text-muted-foreground">
          Seu potencial nas redes sociais (leitura das suas respostas, não auditoria do perfil):
        </p>
        <ul className="mt-6 space-y-4">
          {score.map((dim) => (
            <li key={dim.chave}>
              <div className="mb-1.5 flex items-baseline justify-between gap-3">
                <span className="text-base">{dim.rotulo}</span>
                <span className={`num text-sm font-medium ${COR_TEXTO_FAIXA[dim.faixa]}`}>
                  {dim.valor}%
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-border">
                <div
                  className={`h-full rounded-full transition-[width] ${COR_FAIXA[dim.faixa]}`}
                  style={{ width: `${dim.valor}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * URL do vídeo do topo. Vazia, a página mostra o placeholder.
 *
 * Aceita arquivo direto (.mp4/.webm, por exemplo do Storage do Supabase ou do
 * Bunny) ou link de YouTube/Vimeo. O roteiro está em
 * docs/superpowers/specs/2026-09-16-video-cta-dna-viral-design.md
 */
const VIDEO_URL = (import.meta.env.VITE_VIDEO_DIAGNOSTICO_URL as string | undefined)?.trim() || "";
const VIDEO_POSTER =
  (import.meta.env.VITE_VIDEO_DIAGNOSTICO_POSTER as string | undefined)?.trim() || undefined;

/** Link de YouTube/Vimeo vira o endereço do player embutido; arquivo direto devolve null. */
function urlDeEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube.com/embed/${id}` : null;
    }
    if (host === "vimeo.com") return `https://player.vimeo.com/video${u.pathname}`;
    if (host === "player.vimeo.com" || host.includes("mediadelivery.net")) return url;
    return null;
  } catch {
    return null;
  }
}

const MOLDURA_VIDEO =
  "mx-auto mt-6 aspect-[9/16] max-h-[min(70vh,520px)] w-full max-w-[280px] overflow-hidden rounded-xl border border-border bg-surface";

function VideoDiagnostico() {
  if (!VIDEO_URL) return <VideoPlaceholder />;

  const embed = urlDeEmbed(VIDEO_URL);
  if (embed) {
    return (
      <div className={MOLDURA_VIDEO} data-print-hide>
        <iframe
          src={embed}
          title="Vídeo do diagnóstico"
          className="h-full w-full"
          allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <div className={MOLDURA_VIDEO} data-print-hide>
      <video
        src={VIDEO_URL}
        poster={VIDEO_POSTER}
        controls
        playsInline
        preload="metadata"
        className="h-full w-full object-cover"
      >
        Seu navegador não reproduz este vídeo.
      </video>
    </div>
  );
}

/** Enquanto o vídeo não existe. */
function VideoPlaceholder() {
  return (
    <div
      className="mx-auto mt-6 flex aspect-[9/16] max-h-[min(70vh,520px)] w-full max-w-[280px]
        flex-col items-center justify-center rounded-xl border border-border bg-surface text-center"
      data-print-hide
      role="img"
      aria-label="Vídeo do diagnóstico, em breve"
    >
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        Vídeo
      </div>
      <p className="mt-2 px-6 text-sm text-muted-foreground">
        Em breve: assista e descubra como atrair mais clientes.
      </p>
    </div>
  );
}

function useCheckoutHref(oferta: OfertaPublica): string | null {
  const [href, setHref] = useState<string | null>(null);

  useEffect(() => {
    if (!oferta) return;
    try {
      const url = new URL(oferta.checkoutUrl);
      // `sck` volta no webhook da Hubla e liga a compra a este lead.
      url.searchParams.set("sck", obterLeadId());
      for (const [chave, valor] of Object.entries(capturarOrigem())) {
        if (valor) url.searchParams.set(chave, valor);
      }
      // Checkout já preenchido com o que a pessoa digitou no quiz. Vem do
      // navegador dela, nunca do servidor: o relatório é público por link e
      // não expõe o e-mail. Manter o mesmo e-mail é também o que permite ao
      // webhook achar o lead se o `sck` se perder.
      const { nome, email } = lerRespostas();
      if (nome?.trim()) url.searchParams.set("name", nome.trim());
      if (email?.trim()) url.searchParams.set("email", email.trim());
      setHref(url.toString());
    } catch {
      setHref(oferta.checkoutUrl);
    }
  }, [oferta]);

  return href;
}

function BotaoCheckout({
  oferta,
  rotulo,
  compacto = false,
}: {
  oferta: OfertaPublica;
  rotulo: string;
  compacto?: boolean;
}) {
  const href = useCheckoutHref(oferta);
  if (!oferta) return null;

  return (
    <a
      href={href ?? oferta.checkoutUrl}
      onClick={() =>
        rastrear(
          "InitiateCheckout",
          {
            content_name: oferta.nome,
            currency: "BRL",
            ...(oferta.precoCentavos != null ? { value: oferta.precoCentavos / 100 } : {}),
          },
          obterLeadId(),
        )
      }
      data-print-hide
      className={`inline-flex items-center gap-2 rounded-md bg-primary font-medium text-primary-foreground
        transition hover:bg-primary/90 ${compacto ? "min-h-11 shrink-0 px-4 py-2.5 text-sm" : "min-h-12 w-full justify-center px-6 py-3.5 text-base sm:w-auto sm:px-8"}
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        focus-visible:ring-offset-2 focus-visible:ring-offset-background`}
    >
      {rotulo} <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function formatarPreco(centavos: number): string {
  // Centavos inteiros mostram "R$ 197"; quebrados, "R$ 47,90". Arredondar
  // mostrava "R$ 48" para quem vai pagar R$ 47,90.
  const inteiro = centavos % 100 === 0;
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: inteiro ? 0 : 2,
    maximumFractionDigits: inteiro ? 0 : 2,
  });
}

/** Desconto do lançamento, arredondado para baixo: nunca anuncia mais do que dá. */
function descontoPct(oferta: NonNullable<OfertaPublica>): number | null {
  const { precoCentavos: por, precoDeCentavos: de } = oferta;
  if (por == null || de == null || de <= por) return null;
  return Math.floor((1 - por / de) * 100);
}

const GARANTIAS = "Cartão ou Pix · Cancele quando quiser · 7 dias de garantia";

/**
 * O bônus de lançamento (de R$ 197 por R$ 47,90 por mês), o botão e as
 * garantias. Usado no topo e no fim da oferta.
 */
function BlocoCta({ oferta, rotulo }: { oferta: OfertaPublica; rotulo: string }) {
  if (!oferta) return null;
  const pct = descontoPct(oferta);
  return (
    <div data-print-hide>
      {pct != null && oferta.precoDeCentavos != null && oferta.precoCentavos != null && (
        <div className="mb-4">
          <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
            Bônus de lançamento · {pct}% de desconto
          </div>
          <div className="num mt-1.5 text-base">
            <span className="text-muted-foreground line-through">
              de {formatarPreco(oferta.precoDeCentavos)}
            </span>{" "}
            por <span className="text-xl font-semibold">{formatarPreco(oferta.precoCentavos)}</span>{" "}
            por mês
          </div>
        </div>
      )}
      <BotaoCheckout oferta={oferta} rotulo={rotulo} />
      <p className="mt-3 text-sm text-muted-foreground">{GARANTIAS}</p>
    </div>
  );
}

/**
 * Como a prevIA resolve o gargalo de cada perfil. A chave é a situação do
 * arquétipo (sempre um dos 6 de ARQUETIPOS_DO_QUIZ); relatório antigo, com
 * nome fora da lista, simplesmente não mostra a ponte.
 */
const SOLUCAO_POR_SITUACAO: Record<string, string> = {
  nao_sei_postar:
    "Todo domingo, o tema de cada vídeo chega decidido, a partir do que performou nos seus perfis de referência.",
  ideias_sem_conteudo:
    "Cada ideia vira roteiro completo, com gancho, desenvolvimento e fecho, no seu tom.",
  sem_tempo:
    "Você escolhe em quantos dias posta, e o plano cabe nesse ritmo. O roteiro chega pronto para ler e gravar.",
  sem_constancia:
    "O plano chega sozinho todo domingo. A constância deixa de depender de como foi a sua semana.",
  poucas_views:
    "Cada roteiro abre com um gancho modelado nos vídeos que mais seguraram a audiência nas suas referências.",
  views_sem_cliente:
    "Os temas partem das dúvidas que o seu cliente tem antes de contratar, e cada fecho convida quem assiste a comentar o caso.",
};

function PonteArquetipo({
  arquetipo,
  gargalo,
}: {
  arquetipo: string | null;
  gargalo: string | null;
}) {
  const situacao = ARQUETIPOS_DO_QUIZ.find((a) => a.nome === arquetipo)?.situacao;
  const solucao = situacao ? SOLUCAO_POR_SITUACAO[situacao] : null;
  if (!arquetipo || !solucao) return null;

  return (
    <section
      className="mt-14 rounded-lg border border-border bg-surface p-6 sm:p-8"
      data-print-hide
    >
      <div className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
        O que trava você, e como isso sai da sua semana
      </div>
      <p className="mt-3 text-base leading-relaxed">
        Seu perfil é <strong className="font-semibold">{arquetipo}</strong>
        {gargalo ? (
          <>
            , e o gargalo principal é{" "}
            <strong className="font-semibold">
              {gargalo.charAt(0).toLowerCase() + gargalo.slice(1)}
            </strong>
            .
          </>
        ) : (
          "."
        )}
      </p>
      <p className="ai-mark mt-3 font-display text-lg leading-snug sm:text-xl">{solucao}</p>
    </section>
  );
}

/** O momento de maior desejo: acabou de ler os três roteiros. */
function CtaMeio({ oferta }: { oferta: OfertaPublica }) {
  if (!oferta) return null;
  return (
    <div className="mt-8 border-t border-border pt-8" data-print-hide>
      <p className="font-display text-lg font-semibold leading-snug sm:text-xl">
        Esses três são para hoje. Na semana que vem, chegam os próximos, sem você pedir.
      </p>
      <div className="mt-5">
        <BotaoCheckout oferta={oferta} rotulo="Quero os próximos roteiros" />
      </div>
    </div>
  );
}

const ENTREGAS = [
  "O plano da semana, todo domingo: um vídeo para cada dia que você escolheu postar, com o gancho já escrito.",
  "O roteiro completo de cada vídeo, no seu tom de voz.",
  "O modo gravação: o roteiro rola na tela enquanto você grava.",
  "O carrossel pronto, gerado a partir do roteiro.",
  "Até 30 roteiros e 30 carrosséis por mês, a partir de até 5 perfis de referência.",
];

const PASSOS = [
  "Você assina e cria a sua senha. O cadastro já vem preenchido com as respostas deste diagnóstico.",
  "Indica de 2 a 5 perfis do Instagram que você usa de referência.",
  "Em poucos minutos chega o primeiro plano. Depois, todo domingo.",
];

const PERGUNTAS = [
  {
    p: "E as regras da OAB?",
    r: "Os roteiros são escritos sem promessa de resultado, sem preço e sem captação direta. Você revisa antes de publicar.",
  },
  {
    p: "Não tenho tempo.",
    r: "O tempo vai antes da câmera, em decidir o tema e escrever. Isso chega pronto. Com o roteiro na tela, um vídeo curto sai em poucos minutos.",
  },
  {
    p: "Já uso o ChatGPT.",
    r: "Ele não sabe o que está performando agora nos perfis que você acompanha, nem escreve no seu tom. A prevIA parte disso, toda semana, sem você pedir.",
  },
  {
    p: "Tenho vergonha de gravar.",
    r: "Você lê o roteiro no modo gravação. E dá para começar pelos carrosséis, sem aparecer em vídeo.",
  },
  {
    p: "E se eu não gostar?",
    r: "Reembolso integral em até 7 dias após a assinatura, e cancelamento quando quiser, sem multa.",
  },
  {
    p: "O preço vai subir?",
    r: "R$ 47,90 é o preço de lançamento. Depois do lançamento, a assinatura passa a custar R$ 197 por mês.",
  },
];

/**
 * A oferta, depois do documento inteiro. Fora da impressão: o PDF que a
 * pessoa guarda é o diagnóstico, não o anúncio.
 */
function Oferta({ oferta }: { oferta: OfertaPublica }) {
  if (!oferta) return null;

  return (
    <section
      className="mt-16 rounded-lg border border-border bg-surface p-6 sm:p-8"
      data-print-hide
    >
      <h2 className="font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
        Você tem três roteiros. O problema começa na quarta semana.
      </h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        Gravar os três primeiros é fácil, porque alguém já escreveu por você. O que trava todo mundo
        é a segunda-feira seguinte: a tela em branco, a dúvida sobre o tema e a hora que você não
        tem. É por isso que quase todo perfil jurídico começa bem e para no primeiro mês.
      </p>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        A prevIA existe para essa parte. Ela acompanha o que está performando na sua área,
        transforma isso em pauta na sua voz e deixa o roteiro pronto nos dias em que você se
        comprometeu a publicar. Você abre, lê e grava.
      </p>

      <h3 className="mt-10 font-display text-lg font-semibold tracking-tight">
        O que chega toda semana
      </h3>
      <ul className="mt-4 space-y-3">
        {ENTREGAS.map((item) => (
          <li key={item} className="flex gap-3 text-base leading-relaxed">
            <Check className="mt-1 h-4 w-4 shrink-0 text-success" />
            {item}
          </li>
        ))}
      </ul>

      <h3 className="mt-10 font-display text-lg font-semibold tracking-tight">Como funciona</h3>
      <ol className="mt-4 space-y-3">
        {PASSOS.map((passo, i) => (
          <li key={passo} className="flex gap-3 text-base leading-relaxed">
            <span className="num flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-foreground text-xs text-background">
              {i + 1}
            </span>
            {passo}
          </li>
        ))}
      </ol>

      <div className="mt-10 rounded-lg border border-border bg-background p-5 sm:p-6">
        <BlocoCta oferta={oferta} rotulo="Assinar com o bônus" />
      </div>

      <h3 className="mt-10 font-display text-lg font-semibold tracking-tight">
        Perguntas frequentes
      </h3>
      <div className="mt-4 divide-y divide-border">
        {PERGUNTAS.map(({ p, r }) => (
          <details key={p} className="group py-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-base font-medium">
              {p}
              <span aria-hidden className="text-muted-foreground transition group-open:rotate-45">
                +
              </span>
            </summary>
            <p className="mt-2 text-base leading-relaxed text-muted-foreground">{r}</p>
          </details>
        ))}
      </div>

      <div className="mt-8">
        <BotaoCheckout oferta={oferta} rotulo="Assinar a prevIA VIRAL" />
      </div>
    </section>
  );
}

/**
 * Barra fixa no celular com preço e botão. Aparece depois que o CTA do topo
 * sai da tela por cima, para não duplicar o botão que a pessoa já está vendo.
 */
function BarraFixa({ oferta }: { oferta: OfertaPublica }) {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const alvo = document.getElementById("cta-topo");
    if (!alvo || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(([e]) => {
      if (e) setVisivel(!e.isIntersecting && e.boundingClientRect.top < 0);
    });
    obs.observe(alvo);
    return () => obs.disconnect();
  }, []);

  if (!oferta || oferta.precoCentavos == null) return null;

  return (
    <div
      data-print-hide
      aria-hidden={!visivel}
      className={`fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur transition-transform duration-300 motion-reduce:transition-none md:hidden ${
        visivel ? "translate-y-0" : "translate-y-full"
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]">
        <div className="num text-sm leading-tight">
          <div className="font-semibold">{formatarPreco(oferta.precoCentavos)}/mês</div>
          <div className="text-xs text-muted-foreground">7 dias de garantia</div>
        </div>
        <BotaoCheckout oferta={oferta} rotulo="Resgatar bônus" compacto />
      </div>
    </div>
  );
}

function NaoEncontrado() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 px-5 text-center">
      <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="h-8 w-auto" />
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
