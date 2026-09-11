import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { ArrowRight, Download, Loader2, RotateCw } from "lucide-react";
import { toast } from "sonner";
import { getDna, regerarDna } from "@/lib/onboarding.functions";
import { ConvitePush } from "@/components/notificacoes/ConvitePush";
import { mensagemErro } from "@/lib/mensagem-erro";

export const Route = createFileRoute("/_authenticated/dna")({
  head: () => ({
    meta: [
      { title: "Manual de marca | prevIA" },
      {
        name: "description",
        content: "Posicionamento, voz, pilares e fórmulas de gancho do seu perfil.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { novo?: boolean } => ({
    novo: search.novo === true || search.novo === "true" ? true : undefined,
  }),
  component: DnaPage,
});

const texto = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const lista = (v: unknown) =>
  Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x.trim() : "")).filter(Boolean) : [];

type Pilar = { nome?: unknown; por_que?: unknown; exemplos_de_tema?: unknown };
type Formula = { nome?: unknown; estrutura?: unknown; exemplo?: unknown };
type Semana = { semana?: unknown; foco?: unknown; entregas?: unknown };

function DnaPage() {
  const { novo } = Route.useSearch();
  const queryClient = useQueryClient();
  const carregar = useServerFn(getDna);
  const regerar = useServerFn(regerarDna);
  const [regerando, setRegerando] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["dna"],
    queryFn: () => carregar(),
  });

  async function aoRegerar() {
    setRegerando(true);
    try {
      await regerar();
      await queryClient.invalidateQueries({ queryKey: ["dna"] });
      toast.success("Manual atualizado.");
    } catch (e) {
      toast.error(mensagemErro(e, "Não consegui gerar o manual. Tente de novo em instantes."));
    } finally {
      setRegerando(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Carregando…
      </div>
    );
  }

  if (!data?.relatorio) {
    return (
      <div className="mx-auto max-w-lg p-6 sm:p-10">
        <h1 className="font-display text-2xl font-semibold tracking-tight">Manual de marca</h1>
        <p className="mt-3 text-base leading-relaxed text-muted-foreground">
          Seu manual ainda não foi gerado. Ele é escrito a partir das respostas do seu onboarding
          e reúne posicionamento, voz, pilares e fórmulas de gancho.
        </p>
        <button
          type="button"
          onClick={aoRegerar}
          disabled={regerando}
          className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-base
            font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
            focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          {regerando ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCw className="h-4 w-4" />}
          Gerar meu manual
        </button>
      </div>
    );
  }

  const c = (data.relatorio.conteudo ?? {}) as Record<string, unknown>;
  const nome = texto(data.perfil?.nome) ?? "Seu perfil";
  const comoSoa = (c["como_voce_soa"] ?? {}) as Record<string, unknown>;
  const publico = (c["publico"] ?? {}) as Record<string, unknown>;
  const pilares = Array.isArray(c["pilares"]) ? (c["pilares"] as Pilar[]) : [];
  const formulas = Array.isArray(c["formulas_de_gancho"])
    ? (c["formulas_de_gancho"] as Formula[])
    : [];
  const semanas = Array.isArray(c["primeiras_quatro_semanas"])
    ? (c["primeiras_quatro_semanas"] as Semana[])
    : [];
  const bordoes = lista(c["bordoes"]);
  const proibida = lista(c["lista_proibida"]);

  let secao = 0;
  const proxima = () => String(++secao).padStart(2, "0");

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-10 sm:py-12" data-print-root>
      {novo && (
        <div
          data-print-hide
          className="mb-10 rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-primary" />
            <span className="text-sm text-muted-foreground">Seu manual está pronto</span>
          </div>
          <p className="mt-3 text-base leading-relaxed">
            Baixe e guarde este documento. Enquanto você lê, a prevIA está lendo os perfis que
            você indicou — a primeira curadoria aparece em alguns minutos.
          </p>
          <Link
            to="/curadoria"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-base
              font-medium text-primary-foreground transition hover:bg-primary/90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Ir para a curadoria <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <ConvitePush />

      <header className="border-b border-border pb-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Manual de marca</p>
            <h1 className="mt-1 font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
              {nome}
            </h1>
            <p className="num mt-2 text-sm text-muted-foreground">
              Versão {data.relatorio.versao} ·{" "}
              {new Date(data.relatorio.gerado_em).toLocaleDateString("pt-BR")}
            </p>
          </div>
          <div data-print-hide className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium
                text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                focus-visible:ring-offset-background"
            >
              <Download className="h-4 w-4" /> Baixar PDF
            </button>
            <button
              type="button"
              onClick={aoRegerar}
              disabled={regerando}
              className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm
                transition hover:border-foreground/30 disabled:opacity-60 focus-visible:outline-none
                focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                focus-visible:ring-offset-background"
            >
              {regerando ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RotateCw className="h-4 w-4" />
              )}
              Regerar
            </button>
          </div>
        </div>

        {texto(c["resumo_posicionamento"]) && (
          <p className="mt-6 font-display text-lg leading-relaxed sm:text-xl">
            {texto(c["resumo_posicionamento"])}
          </p>
        )}
      </header>

      {(texto(comoSoa["descricao"]) || lista(comoSoa["faca"]).length) && (
        <Secao numero={proxima()} titulo="Como você soa">
          {texto(comoSoa["descricao"]) && <Paragrafo>{texto(comoSoa["descricao"])!}</Paragrafo>}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Lista titulo="Faça" itens={lista(comoSoa["faca"])} />
            <Lista titulo="Evite" itens={lista(comoSoa["evite"])} />
          </div>
        </Secao>
      )}

      {(texto(publico["quem_e"]) || lista(publico["dores"]).length) && (
        <Secao numero={proxima()} titulo="Para quem você fala">
          {texto(publico["quem_e"]) && <Paragrafo>{texto(publico["quem_e"])!}</Paragrafo>}
          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <Lista titulo="Dores" itens={lista(publico["dores"])} />
            <Lista titulo="Objeções" itens={lista(publico["objecoes"])} />
          </div>
          {texto(publico["onde_esta_a_atencao"]) && (
            <p className="mt-6 border-l-2 border-primary pl-4 text-base leading-relaxed">
              {texto(publico["onde_esta_a_atencao"])}
            </p>
          )}
        </Secao>
      )}

      {pilares.length > 0 && (
        <Secao numero={proxima()} titulo="Seus pilares de conteúdo">
          <div className="space-y-6">
            {pilares.map((p, i) => (
              <div key={i} className="break-inside-avoid">
                <h3 className="font-display text-lg font-semibold tracking-tight">
                  {texto(p.nome) ?? `Pilar ${i + 1}`}
                </h3>
                {texto(p.por_que) && (
                  <p className="mt-1 text-base leading-relaxed text-muted-foreground">
                    {texto(p.por_que)}
                  </p>
                )}
                {lista(p.exemplos_de_tema).length > 0 && (
                  <ul className="mt-3 space-y-1.5">
                    {lista(p.exemplos_de_tema).map((t) => (
                      <li key={t} className="flex gap-2.5 text-base leading-relaxed">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {t}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {formulas.length > 0 && (
        <Secao numero={proxima()} titulo="Suas fórmulas de gancho">
          <div className="space-y-5">
            {formulas.map((f, i) => (
              <div
                key={i}
                className="break-inside-avoid rounded-lg border border-border bg-surface p-5"
              >
                <h3 className="font-display text-base font-semibold tracking-tight">
                  {texto(f.nome) ?? `Fórmula ${i + 1}`}
                </h3>
                {texto(f.estrutura) && (
                  <p className="mt-2 text-base leading-relaxed text-muted-foreground">
                    {texto(f.estrutura)}
                  </p>
                )}
                {texto(f.exemplo) && (
                  <p className="mt-3 font-display text-lg leading-snug">
                    <span aria-hidden className="text-muted-foreground">
                      “
                    </span>
                    {texto(f.exemplo)}
                    <span aria-hidden className="text-muted-foreground">
                      ”
                    </span>
                  </p>
                )}
              </div>
            ))}
          </div>
        </Secao>
      )}

      {(bordoes.length > 0 || proibida.length > 0) && (
        <Secao numero={proxima()} titulo="Suas regras">
          <div className="grid gap-6 sm:grid-cols-2">
            <Lista titulo="Bordões" itens={bordoes} />
            <Lista titulo="Nunca aparece no seu conteúdo" itens={proibida} />
          </div>
          <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
            Estas regras valem para todos os roteiros, carrosséis e pautas que a prevIA produzir
            para você. Você pode ajustá-las em Perfis.
          </p>
        </Secao>
      )}

      {semanas.length > 0 && (
        <Secao numero={proxima()} titulo="Suas primeiras quatro semanas">
          <ol className="space-y-5">
            {semanas.map((s, i) => (
              <li key={i} className="break-inside-avoid border-l-2 border-border pl-5">
                <div className="num text-sm text-muted-foreground">
                  Semana {typeof s.semana === "number" ? s.semana : i + 1}
                </div>
                {texto(s.foco) && (
                  <h3 className="mt-1 font-display text-lg font-semibold tracking-tight">
                    {texto(s.foco)}
                  </h3>
                )}
                {lista(s.entregas).length > 0 && (
                  <ul className="mt-2 space-y-1.5">
                    {lista(s.entregas).map((e) => (
                      <li key={e} className="flex gap-2.5 text-base leading-relaxed">
                        <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                        {e}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </Secao>
      )}

      {texto(c["proximo_passo"]) && (
        <footer className="mt-14 border-t border-border pt-8">
          <p className="font-display text-lg leading-relaxed sm:text-xl">
            {texto(c["proximo_passo"])}
          </p>
          <Link
            data-print-hide
            to="/curadoria"
            className="mt-6 inline-flex items-center gap-2 text-base transition hover:text-muted-foreground
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
              focus-visible:ring-offset-background rounded"
          >
            Ir para a curadoria <ArrowRight className="h-4 w-4" />
          </Link>
        </footer>
      )}
    </div>
  );
}

function Secao({
  numero,
  titulo,
  children,
}: {
  numero: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-14 break-before-auto">
      <div className="flex items-baseline gap-3 border-b border-border pb-3">
        <span className="num text-sm text-muted-foreground">{numero}</span>
        <h2 className="font-display text-xl font-semibold tracking-tight sm:text-2xl">{titulo}</h2>
      </div>
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Paragrafo({ children }: { children: React.ReactNode }) {
  return <p className="text-base leading-relaxed sm:text-lg">{children}</p>;
}

function Lista({ titulo, itens }: { titulo: string; itens: string[] }) {
  if (!itens.length) return null;
  return (
    <div className="break-inside-avoid">
      <h3 className="text-base font-semibold">{titulo}</h3>
      <ul className="mt-2 space-y-2">
        {itens.map((item) => (
          <li key={item} className="flex gap-2.5 text-base leading-relaxed">
            <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
