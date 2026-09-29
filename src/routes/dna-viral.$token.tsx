import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowRight, Download } from "lucide-react";
import { LOGO_FUNDO_CLARO, MARCA_ALT } from "@/lib/marca";
import { getDnaViral, getOfertaPublica } from "@/lib/quiz-oferta.functions";
import { capturarOrigem, obterLeadId } from "@/lib/oferta-variante";
import { statusDoScore, type DimensaoScore, type FaixaScore } from "@/lib/dna-viral-score";
import type { DnaViral } from "@/lib/dna-viral";

/**
 * O DNA Viral — o relatório público, no seu endereço permanente.
 *
 * O token é a única credencial: quem tem o link vê o documento. Por isso a
 * leitura devolve só o relatório e o primeiro nome, nunca o e-mail nem as
 * respostas cruas.
 *
 * Ordem (decisão da reunião): vídeo + CTA no topo, depois score, gargalos,
 * roteiros e oferta. O PDF (`data-print-hide`) continua como parecer — sem
 * vídeo nem checkout.
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
  const { relatorio, primeiroNome, geradoEm } = dna;

  const gargalos = relatorio.gargalos ?? [];
  const score = relatorio.score;

  return (
    <div className="mx-auto max-w-3xl px-5 py-10 sm:px-10 sm:py-14" data-print-root>
      {/* ---- Cabeçalho + vídeo + CTA (fora do PDF) ---- */}
      <header className="border-b border-border pb-8" data-print-hide>
        <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="mb-6 h-7 w-auto" />
        <h1 className="font-display text-2xl font-semibold leading-tight tracking-tight sm:text-3xl">
          Obrigado{primeiroNome ? `, ${primeiroNome}` : ""}, recebemos as suas respostas e o seu
          diagnóstico está pronto!
        </h1>
        <p className="mt-4 text-base leading-relaxed text-muted-foreground">
          Assista o vídeo abaixo e descubra como atrair mais clientes.
        </p>

        <VideoPlaceholder />

        <div className="mt-6 flex flex-wrap items-center gap-4">
          <BotaoCheckout oferta={oferta} rotulo="Resgatar bônus" />
          {oferta && (oferta.precoCentavos != null || oferta.precoDeCentavos != null) && (
            <span className="num text-sm text-muted-foreground">
              {oferta.precoDeCentavos != null && (
                <>
                  <span className="line-through opacity-60">
                    DE {formatarPreco(oferta.precoDeCentavos)}
                  </span>
                  {oferta.precoCentavos != null && " · "}
                </>
              )}
              {oferta.precoCentavos != null && (
                <>
                  <span className="font-medium text-foreground">
                    {formatarPreco(oferta.precoCentavos)}
                  </span>{" "}
                  por mês
                </>
              )}
            </span>
          )}
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
          titulo="Aqui estão os 03 roteiros prontos para gravar hoje"
          apoio="Para destravar as gravações, aqui estão 3 estruturas validadas adaptadas para a advocacia:"
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
                      <div className="text-sm font-medium text-muted-foreground">Desenvolvimento</div>
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
            Estes são 3 roteiros que já vão destravar as suas gravações desta semana.
          </p>
        </Secao>
      )}

      {relatorio.o_que_falta && (
        <Secao titulo="O que este documento não faz">
          <p className="text-base leading-relaxed text-muted-foreground">{relatorio.o_que_falta}</p>
        </Secao>
      )}

      <Oferta oferta={oferta} relatorio={relatorio} />

      <footer className="mt-16 border-t border-border pt-6" data-print-hide>
        <img src={LOGO_FUNDO_CLARO} alt={MARCA_ALT} className="h-6 w-auto opacity-60" />
      </footer>
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
          Seu potencial nas redes sociais — leitura das suas respostas, não auditoria do perfil:
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
 * Placeholder vertical até o asset do vídeo existir.
 * O roteiro está em docs/superpowers/specs/2026-09-16-video-cta-dna-viral-design.md
 */
function VideoPlaceholder() {
  return (
    <div
      className="mx-auto mt-6 flex aspect-[9/16] max-h-[min(70vh,520px)] w-full max-w-[280px]
        flex-col items-center justify-center rounded-xl border border-border bg-surface text-center"
      data-print-hide
      role="img"
      aria-label="Vídeo do diagnóstico — em breve"
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
      url.searchParams.set("s2", oferta.codigo);
      // `s3` e nunca `s1` — o webhook da Kiwify trata `s1` como conta_id sempre
      // que tem 36 caracteres, e um randomUUID tem exatamente 36.
      url.searchParams.set("s3", obterLeadId());
      for (const [chave, valor] of Object.entries(capturarOrigem())) {
        if (valor) url.searchParams.set(chave, valor);
      }
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
}: {
  oferta: OfertaPublica;
  rotulo: string;
}) {
  const href = useCheckoutHref(oferta);
  if (!oferta) return null;

  return (
    <a
      href={href ?? oferta.checkoutUrl}
      data-print-hide
      className="inline-flex min-h-12 items-center gap-2 rounded-md bg-primary px-8 py-3.5 text-base
        font-medium text-primary-foreground transition hover:bg-primary/90
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {rotulo} <ArrowRight className="h-4 w-4" />
    </a>
  );
}

function formatarPreco(centavos: number): string {
  return (centavos / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  });
}

/**
 * A oferta, depois do documento inteiro.
 *
 * Vem no fim de propósito (além do CTA do topo): a pessoa já recebeu o que foi
 * prometido. Fora da impressão — o PDF que ela guarda é o diagnóstico, não o
 * anúncio.
 */
function Oferta({
  oferta,
  relatorio,
}: {
  oferta: OfertaPublica;
  relatorio: DnaViral;
}) {
  if (!oferta) return null;

  const preco = oferta.precoCentavos != null ? formatarPreco(oferta.precoCentavos) : null;
  const precoDe =
    oferta.precoDeCentavos != null ? formatarPreco(oferta.precoDeCentavos) : null;

  return (
    <section
      className="mt-16 rounded-lg border border-border bg-surface p-6 sm:p-8"
      data-print-hide
    >
      <h2 className="font-display text-xl font-semibold leading-snug tracking-tight sm:text-2xl">
        Mas a questão é: como manter esse fluxo todas as semanas?
      </h2>
      <p className="mt-3 text-base leading-relaxed text-muted-foreground">
        {relatorio.o_que_falta
          ? "É esse trabalho que a prevIA Viral assume:"
          : "A prevIA assume o trabalho que se repete:"}{" "}
        ela acompanha o que está performando na sua área, transforma isso em pauta com a sua voz e
        deixa o roteiro pronto nos dias em que você se comprometeu a publicar.
      </p>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <BotaoCheckout oferta={oferta} rotulo="Resgatar bônus" />
        {(preco || precoDe) && (
          <span className="num text-sm text-muted-foreground">
            {precoDe && (
              <>
                <span className="line-through opacity-60">DE {precoDe}</span>
                {preco && " · "}
              </>
            )}
            {preco && (
              <>
                <span className="font-medium text-foreground">{preco}</span> por mês
              </>
            )}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm text-muted-foreground">
        {preco && precoDe
          ? `O bônus é este preço: de ${precoDe} por ${preco}/mês. `
          : ""}
        Suas respostas já vão com você — o cadastro começa do ponto onde este diagnóstico parou.
      </p>
    </section>
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
