import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useMemo, useState } from "react";
import { ArrowLeft, Check, Copy, Download } from "lucide-react";
import { toast } from "sonner";
import { getMaterial } from "@/lib/materiais.functions";
import type { ConteudoMaterial } from "@/lib/materiais.server";
import { EstadoCarregando, EstadoErro } from "@/components/estados";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/materiais/$codigo")({
  head: () => ({
    meta: [{ title: "Materiais | prevIA" }, { name: "robots", content: "noindex" }],
  }),
  component: MaterialPage,
});

const FOCO =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background";

function MaterialPage() {
  const { codigo } = Route.useParams();
  const carregar = useServerFn(getMaterial);
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["material", codigo],
    queryFn: () => carregar({ data: { codigo } }),
    retry: false,
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-10 sm:py-12" data-print-root>
      <Link
        to="/materiais"
        data-print-hide
        className={cn(
          "inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground",
          FOCO,
        )}
      >
        <ArrowLeft className="h-4 w-4" /> Materiais
      </Link>

      {isLoading && (
        <div className="mt-8">
          <EstadoCarregando linhas={4} rotulo="Abrindo o material" />
        </div>
      )}
      {isError && (
        <div className="mt-8">
          <EstadoErro
            titulo="Não consegui abrir este material"
            descricao={error instanceof Error ? error.message : undefined}
            onTentarDeNovo={() => refetch()}
          />
        </div>
      )}

      {data?.codigo === "ganchos_previdenciario" && <Ganchos material={data} />}
      {data?.codigo === "gravando_celular" && <Guia material={data} />}
    </div>
  );
}

function Cabecalho({ titulo, intro }: { titulo: string; intro: string }) {
  return (
    <header className="mt-6 border-b border-border pb-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <h1 className="font-display text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
          {titulo}
        </h1>
        <button
          type="button"
          data-print-hide
          onClick={() => window.print()}
          className={cn(
            "inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm transition hover:border-foreground/30",
            FOCO,
          )}
        >
          <Download className="h-4 w-4" /> Baixar PDF
        </button>
      </div>
      <p className="mt-4 text-base leading-relaxed text-muted-foreground">{intro}</p>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Banco de ganchos
// ---------------------------------------------------------------------------

type MaterialGanchos = Extract<ConteudoMaterial, { codigo: "ganchos_previdenciario" }>;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function Ganchos({ material }: { material: MaterialGanchos }) {
  const [tema, setTema] = useState<string | null>(null);
  const [busca, setBusca] = useState("");
  const [copiado, setCopiado] = useState<string | null>(null);

  const temas = useMemo(() => {
    const termo = semAcento(busca.trim());
    return material.temas
      .filter((t) => !tema || t.id === tema)
      .map((t) => ({
        ...t,
        ganchos: termo ? t.ganchos.filter((g) => semAcento(g.texto).includes(termo)) : t.ganchos,
      }))
      .filter((t) => t.ganchos.length > 0);
  }, [material.temas, tema, busca]);

  const total = material.temas.reduce((n, t) => n + t.ganchos.length, 0);

  async function copiar(texto: string) {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado(texto);
      setTimeout(() => setCopiado((atual) => (atual === texto ? null : atual)), 1500);
    } catch {
      toast.error("Não consegui copiar. Selecione o texto e copie manualmente.");
    }
  }

  const chip = (ativo: boolean) =>
    cn(
      "rounded-full border px-3 py-1.5 text-sm transition",
      ativo
        ? "border-foreground bg-foreground text-background"
        : "border-border text-muted-foreground hover:text-foreground",
      FOCO,
    );

  return (
    <>
      <Cabecalho titulo={material.titulo} intro={material.intro} />

      <section className="mt-8 rounded-lg border border-border bg-surface p-5 sm:p-6">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Como usar
        </h2>
        <ol className="mt-3 space-y-2 text-sm leading-relaxed">
          {material.comoUsar.map((passo, i) => (
            <li key={i} className="flex gap-3">
              <span className="num text-muted-foreground">{i + 1}.</span>
              <span>{passo}</span>
            </li>
          ))}
        </ol>
      </section>

      <div data-print-hide className="mt-8 space-y-4">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={`Buscar entre ${total} ganchos (ex.: perícia, CNIS, MEI)`}
          className="h-11 w-full rounded-md border border-border bg-background px-3 text-base
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTema(null)} className={chip(tema === null)}>
            Todos
          </button>
          {material.temas.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTema(t.id)}
              className={chip(tema === t.id)}
            >
              {t.nome}
            </button>
          ))}
        </div>
      </div>

      {temas.length === 0 && (
        <p className="mt-10 text-sm text-muted-foreground">Nenhum gancho com esse termo.</p>
      )}

      {temas.map((t) => (
        <section key={t.id} className="mt-10">
          <h2 className="font-display text-xl font-semibold">{t.nome}</h2>
          <ul className="mt-4 divide-y divide-border rounded-lg border border-border">
            {t.ganchos.map((g) => (
              <li key={g.texto} className="flex items-start gap-4 p-4">
                <div className="min-w-0 flex-1">
                  <p className="text-base leading-relaxed">{g.texto}</p>
                  <span className="mt-2 inline-block text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                    {g.tipo}
                  </span>
                </div>
                <button
                  type="button"
                  data-print-hide
                  onClick={() => copiar(g.texto)}
                  aria-label="Copiar gancho"
                  className={cn(
                    "shrink-0 rounded-md border border-border p-2 text-muted-foreground transition hover:text-foreground",
                    FOCO,
                  )}
                >
                  {copiado === g.texto ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Gravando com o celular
// ---------------------------------------------------------------------------

type MaterialGuia = Extract<ConteudoMaterial, { codigo: "gravando_celular" }>;

function Guia({ material }: { material: MaterialGuia }) {
  const [marcados, setMarcados] = useState<Set<number>>(new Set());

  function alternar(i: number) {
    setMarcados((atual) => {
      const novo = new Set(atual);
      if (novo.has(i)) novo.delete(i);
      else novo.add(i);
      return novo;
    });
  }

  return (
    <>
      <Cabecalho titulo={material.titulo} intro={material.intro} />

      {material.secoes.map((s, i) => (
        <section key={s.titulo} className="mt-10 break-inside-avoid">
          <div className="flex items-baseline gap-3">
            <span className="num text-sm text-muted-foreground">
              {String(i + 1).padStart(2, "0")}
            </span>
            <h2 className="font-display text-xl font-semibold">{s.titulo}</h2>
          </div>
          <p className="mt-2 text-base leading-relaxed text-muted-foreground">{s.resumo}</p>
          <ul className="mt-4 space-y-2.5">
            {s.itens.map((item) => (
              <li key={item} className="flex gap-3 text-base leading-relaxed">
                <span
                  aria-hidden
                  className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-[1px] bg-foreground/50"
                />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          {s.dica && (
            <p className="mt-4 rounded-md border-l-2 border-primary bg-surface px-4 py-3 text-sm leading-relaxed">
              {s.dica}
            </p>
          )}
        </section>
      ))}

      <section className="mt-12 rounded-lg border border-border bg-surface p-5 sm:p-6 break-inside-avoid">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">Antes de apertar o REC</h2>
          <span className="num text-sm text-muted-foreground" data-print-hide>
            {marcados.size}/{material.checklist.length}
          </span>
        </div>
        <ul className="mt-4 space-y-1">
          {material.checklist.map((item, i) => (
            <li key={item}>
              <label className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-background">
                <input
                  type="checkbox"
                  checked={marcados.has(i)}
                  onChange={() => alternar(i)}
                  className="h-4 w-4 accent-foreground"
                />
                <span
                  className={cn(
                    "text-base",
                    marcados.has(i) && "text-muted-foreground line-through",
                  )}
                >
                  {item}
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
