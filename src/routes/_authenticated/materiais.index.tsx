import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ArrowRight, Lock } from "lucide-react";
import { listarMateriais } from "@/lib/materiais.functions";
import { EstadoCarregando, EstadoErro } from "@/components/estados";

export const Route = createFileRoute("/_authenticated/materiais/")({
  head: () => ({
    meta: [
      { title: "Materiais | prevIA" },
      { name: "description", content: "Materiais de apoio para gravar e escrever o seu conteúdo." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MateriaisPage,
});

const DESCRICAO: Record<string, string> = {
  ganchos_previdenciario:
    "Frases de abertura para vídeos e carrosséis, por tema do previdenciário: aposentadoria, BPC, incapacidade, pensão e mais.",
  gravando_celular:
    "Luz, enquadramento, áudio e como ler o roteiro sem parecer que está lendo. Com checklist para antes de gravar.",
};

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function MateriaisPage() {
  const carregar = useServerFn(listarMateriais);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["materiais"],
    queryFn: () => carregar(),
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-10 sm:py-12">
      <h1 className="font-display text-3xl font-semibold tracking-tight">Materiais</h1>
      <p className="mt-2 text-base text-muted-foreground">
        Apoio para gravar e escrever. Os que você levou ficam aqui para sempre, mesmo se mudar de
        plano.
      </p>

      {isLoading && (
        <div className="mt-8">
          <EstadoCarregando linhas={2} rotulo="Carregando os materiais" />
        </div>
      )}
      {isError && (
        <div className="mt-8">
          <EstadoErro
            titulo="Não consegui carregar os materiais"
            onTentarDeNovo={() => refetch()}
          />
        </div>
      )}

      <div className="mt-8 grid gap-4">
        {(data ?? []).map((m) =>
          m.liberado ? (
            <Link
              key={m.codigo}
              to="/materiais/$codigo"
              params={{ codigo: m.codigo }}
              className="group rounded-lg border border-border bg-surface p-5 transition hover:border-foreground/30
                focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="font-display text-lg font-semibold">{m.nome}</h2>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {DESCRICAO[m.codigo]}
                  </p>
                </div>
                <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-muted-foreground transition group-hover:text-foreground" />
              </div>
            </Link>
          ) : (
            <div
              key={m.codigo}
              className="rounded-lg border border-dashed border-border p-5 sm:p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                    <h2 className="font-display text-lg font-semibold text-foreground">{m.nome}</h2>
                  </div>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {DESCRICAO[m.codigo]}
                  </p>
                </div>
                {m.checkoutUrl && (
                  <a
                    href={m.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium
                      text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none
                      focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
                      focus-visible:ring-offset-background"
                  >
                    Liberar{m.precoCentavos ? ` por ${brl(m.precoCentavos)}` : ""}
                  </a>
                )}
              </div>
            </div>
          ),
        )}
      </div>
    </div>
  );
}
