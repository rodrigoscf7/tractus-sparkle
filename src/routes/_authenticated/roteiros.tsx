import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState, type ReactNode } from "react";
import { ArrowLeft, Check, Copy, Images, Loader2, PenLine, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/estados";
import { BotaoPostado } from "@/components/roteiro/BotaoPostado";
import { useConta } from "@/hooks/use-conta";
import { gerarCarrossel } from "@/lib/agentes.functions";
import { copiarTexto } from "@/lib/copiar";
import { dataCurta, dataLocalCurta, diaDaSemana } from "@/lib/datas";
import { mensagemErro } from "@/lib/mensagem-erro";
import { textoDoRoteiro } from "@/lib/roteiro";
import { cn } from "@/lib/utils";

const ABAS = ["para-ler", "para-gravar", "postados", "recusados"] as const;
type Aba = (typeof ABAS)[number];

export const Route = createFileRoute("/_authenticated/roteiros")({
  head: () => ({
    meta: [
      { title: "Roteiros | prevIA - CONTENT" },
      {
        name: "description",
        content: "Os roteiros para ler, os prontos para gravar e o que já foi postado.",
      },
      { property: "og:title", content: "Roteiros | prevIA - CONTENT" },
      { property: "og:description", content: "Do roteiro escrito ao post no ar." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { aba?: Aba } => ({
    aba: ABAS.includes(search.aba as Aba) ? (search.aba as Aba) : undefined,
  }),
  component: RoteirosPage,
});

type Pauta = {
  id: string;
  perfil_id: string | null;
  tema: string | null;
  angulo: string | null;
  status: string | null;
  criado_em: string | null;
  data_prevista: string | null;
  perfis: { nome: string } | null;
  publicacoes: { status: string | null; postado_em: string | null }[];
  carrosseis: { id: string; status: string | null }[];
  roteiros: { conteudo: unknown; criado_em: string | null }[];
};

type Etapa = "escrevendo" | "para-ler" | "para-gravar" | "postados" | "recusados";

function etapaDe(p: Pauta): Etapa | null {
  if (p.status === "gerada" || p.status === "em_producao") return "escrevendo";
  if (p.status === "aguardando_aprovacao") return "para-ler";
  if (p.status === "rejeitada") return "recusados";
  if (p.status === "aprovada") {
    return p.publicacoes.some((pub) => pub.status === "postado") ? "postados" : "para-gravar";
  }
  return null;
}

/** O mais recente: um roteiro regerado não apaga o anterior. */
function roteiroMaisRecente(p: Pauta) {
  return [...p.roteiros].sort((a, b) => (b.criado_em ?? "").localeCompare(a.criado_em ?? ""))[0];
}

const porData = (a: Pauta, b: Pauta) =>
  (a.data_prevista ?? a.criado_em ?? "").localeCompare(b.data_prevista ?? b.criado_em ?? "");

const COLUNAS: { aba: Exclude<Aba, "recusados">; titulo: string; vazio: string }[] = [
  { aba: "para-ler", titulo: "Para ler", vazio: "Nenhum roteiro esperando sua leitura." },
  {
    aba: "para-gravar",
    titulo: "Para gravar",
    vazio: "Os roteiros que você aprovar aparecem aqui.",
  },
  { aba: "postados", titulo: "Postados", vazio: "Marque como postado depois de publicar." },
];

function RoteirosPage() {
  const { aba } = Route.useSearch();
  const navigate = Route.useNavigate();
  const [perfilFiltro, setPerfilFiltro] = useState("todos");
  const { data: conta } = useConta();
  const contaId = conta?.conta?.id as string | undefined;

  const {
    data: pautas,
    refetch,
    isLoading,
    isError,
  } = useQuery({
    queryKey: ["roteiros", contaId],
    enabled: Boolean(contaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pautas_geradas")
        .select(
          "id, perfil_id, tema, angulo, status, criado_em, data_prevista, perfis:perfis(nome), publicacoes(status, postado_em), carrosseis(id, status), roteiros(conteudo, criado_em)",
        )
        .eq("conta_id", contaId as string)
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Pauta[];
    },
  });

  // Roteiro escrito, aprovado, postado ou carrossel pronto: a tela acompanha sozinha.
  useEffect(() => {
    if (!contaId) return;
    const canal = supabase
      .channel("roteiros-tela")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "pautas_geradas", filter: `conta_id=eq.${contaId}` },
        () => refetch(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "publicacoes" }, () =>
        refetch(),
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "carrosseis" }, () =>
        refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [contaId, refetch]);

  const perfis = [
    ...new Map(
      (pautas ?? []).filter((p) => p.perfil_id).map((p) => [p.perfil_id, p.perfis?.nome ?? ""]),
    ),
  ];
  const filtradas = (pautas ?? []).filter(
    (p) => perfilFiltro === "todos" || p.perfil_id === perfilFiltro,
  );
  const grupos: Record<Etapa, Pauta[]> = {
    escrevendo: [],
    "para-ler": [],
    "para-gravar": [],
    postados: [],
    recusados: [],
  };
  for (const p of filtradas) {
    const etapa = etapaDe(p);
    if (etapa) grupos[etapa].push(p);
  }
  grupos.escrevendo.sort(porData);
  grupos["para-ler"].sort(porData);
  grupos["para-gravar"].sort(porData);
  grupos.postados.sort((a, b) =>
    (b.publicacoes[0]?.postado_em ?? "").localeCompare(a.publicacoes[0]?.postado_em ?? ""),
  );

  const abaAtiva: Aba = aba ?? "para-ler";
  const irPara = (proxima: Aba) => navigate({ search: { aba: proxima }, replace: true });
  const vendoRecusados = abaAtiva === "recusados";

  return (
    <div className="p-4 sm:p-8 max-w-[1400px]">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Roteiros</h1>
          <p className="text-muted-foreground text-sm mt-1">
            O que ler, o que gravar e o que já foi ao ar.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {grupos.recusados.length > 0 && !vendoRecusados && (
            <Button variant="ghost" size="sm" onClick={() => irPara("recusados")}>
              Ver recusados ({grupos.recusados.length})
            </Button>
          )}
          {perfis.length > 1 && (
            <div className="w-full sm:w-56">
              <label
                htmlFor="filtro-perfil"
                className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
              >
                Perfil
              </label>
              <Select value={perfilFiltro} onValueChange={setPerfilFiltro}>
                <SelectTrigger id="filtro-perfil" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="todos">Todos os perfis</SelectItem>
                  {perfis.map(([id, nome]) => (
                    <SelectItem key={id} value={id as string}>
                      {nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
      </header>

      {(isLoading || !contaId) && !isError && (
        <EstadoCarregando linhas={4} rotulo="Carregando os roteiros" />
      )}

      {isError && (
        <EstadoErro
          titulo="Não consegui carregar os roteiros"
          descricao="A conexão falhou no meio do caminho. Nenhum roteiro foi perdido."
          onTentarDeNovo={() => refetch()}
        />
      )}

      {!isLoading && !isError && contaId && filtradas.length === 0 && (
        <EstadoVazio
          titulo="Nenhum roteiro por aqui ainda"
          descricao="Cada vídeo que você aprova no plano da semana vira um roteiro, e ele aparece aqui para você ler."
          acao={
            <Button asChild>
              <Link to="/plano">Ver o plano da semana</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && filtradas.length > 0 && vendoRecusados && (
        <section>
          <Button
            variant="ghost"
            size="sm"
            className="-ml-2 mb-3"
            onClick={() => irPara("para-ler")}
          >
            <ArrowLeft className="w-4 h-4 mr-1.5" /> Voltar aos roteiros
          </Button>
          <h2 className="font-display font-semibold text-lg mb-3">Recusados</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grupos.recusados.map((p) => (
              <CartaoRoteiro
                key={p.id}
                pauta={p}
                etapa="recusados"
                multiplosPerfis={perfis.length > 1}
              />
            ))}
          </div>
        </section>
      )}

      {!isLoading && !isError && filtradas.length > 0 && !vendoRecusados && (
        <>
          {/* Celular: uma etapa por vez, em abas. Computador: as três lado a lado. */}
          <div
            role="tablist"
            aria-label="Etapas dos roteiros"
            className="lg:hidden grid grid-cols-3 gap-1 rounded-lg bg-muted p-1 mb-4"
          >
            {COLUNAS.map((col) => {
              const n =
                grupos[col.aba].length + (col.aba === "para-ler" ? grupos.escrevendo.length : 0);
              const ativa = abaAtiva === col.aba;
              return (
                <button
                  key={col.aba}
                  type="button"
                  role="tab"
                  aria-selected={ativa}
                  onClick={() => irPara(col.aba)}
                  className={cn(
                    "min-h-11 rounded-md px-2 text-sm font-medium transition-colors",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    ativa
                      ? "bg-surface text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {col.titulo} <span className="num text-muted-foreground">{n}</span>
                </button>
              );
            })}
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {COLUNAS.map((col) => {
              const itens = grupos[col.aba];
              const escrevendo = col.aba === "para-ler" ? grupos.escrevendo : [];
              return (
                <section
                  key={col.aba}
                  aria-label={col.titulo}
                  className={cn("min-w-0", abaAtiva === col.aba ? "block" : "hidden lg:block")}
                >
                  <div className="hidden lg:flex items-center justify-between mb-3 px-1">
                    <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                      {col.titulo}
                    </h2>
                    <span className="num text-xs text-muted-foreground">
                      {itens.length + escrevendo.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {itens.map((p) => (
                      <CartaoRoteiro
                        key={p.id}
                        pauta={p}
                        etapa={col.aba}
                        multiplosPerfis={perfis.length > 1}
                      />
                    ))}
                    {escrevendo.map((p) => (
                      <CartaoRoteiro
                        key={p.id}
                        pauta={p}
                        etapa="escrevendo"
                        multiplosPerfis={perfis.length > 1}
                      />
                    ))}
                    {itens.length === 0 && escrevendo.length === 0 && (
                      <p className="rounded-lg border border-dashed border-border px-4 py-6 text-sm text-muted-foreground">
                        {col.vazio}
                      </p>
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** O dia do vídeo, no mesmo cartão escuro do plano da semana. */
function SeloDia({ iso }: { iso: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5 rounded-md bg-foreground px-2 py-1 text-background">
      <span className="font-display text-xs font-bold capitalize">{diaDaSemana(iso)}</span>
      <span className="font-mono text-[11px] opacity-75 num">{dataCurta(iso)}</span>
    </span>
  );
}

function CartaoRoteiro({
  pauta,
  etapa,
  multiplosPerfis,
}: {
  pauta: Pauta;
  etapa: Etapa;
  multiplosPerfis: boolean;
}) {
  const roteiro = roteiroMaisRecente(pauta);
  const texto = textoDoRoteiro(roteiro?.conteudo);
  const postadoEm = pauta.publicacoes.find((p) => p.status === "postado")?.postado_em;

  return (
    <Card
      className={cn(
        "p-4 bg-surface border-border",
        etapa === "escrevendo" && "border-dashed bg-transparent",
      )}
    >
      <div className="flex flex-wrap items-center gap-2 mb-2.5">
        {pauta.data_prevista && <SeloDia iso={pauta.data_prevista} />}
        {multiplosPerfis && pauta.perfis?.nome && (
          <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
            {pauta.perfis.nome}
          </span>
        )}
        {etapa === "postados" && postadoEm && (
          <span className="ml-auto inline-flex items-center gap-1 text-xs text-success">
            <Check className="w-3.5 h-3.5" /> Postado em {dataLocalCurta(postadoEm)}
          </span>
        )}
      </div>

      <h3 className="font-display font-semibold leading-snug">{pauta.tema ?? "(sem tema)"}</h3>
      {pauta.angulo && (
        <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{pauta.angulo}</p>
      )}

      {etapa === "escrevendo" ? (
        <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
          <PenLine className="w-4 h-4" /> A prevIA está escrevendo este roteiro…
        </p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button size="sm" variant={etapa === "para-ler" ? "default" : "outline"} asChild>
              <Link to="/aprovacao/$pautaId" params={{ pautaId: pauta.id }}>
                {etapa === "para-ler" ? "Ler e aprovar" : "Abrir roteiro"}
              </Link>
            </Button>
            {texto && (
              <Button
                size="sm"
                variant="ghost"
                onClick={() => copiarTexto(texto.completo, "Roteiro copiado")}
              >
                <Copy className="w-4 h-4 mr-1.5" /> Copiar
              </Button>
            )}
          </div>
          {/* O que sai do roteiro: o carrossel e, depois de gravar, o post. */}
          {etapa !== "recusados" && (
            <div className="mt-3 pt-2 border-t border-divider flex flex-wrap items-center justify-between gap-x-2 -mx-2">
              <BotaoCarrossel pauta={pauta} />
              {etapa === "para-gravar" && <BotaoPostado pautaId={pauta.id} />}
            </div>
          )}
        </>
      )}
    </Card>
  );
}

function BotaoCarrossel({ pauta }: { pauta: Pauta }) {
  const solicitar = useServerFn(gerarCarrossel);
  const navigate = useNavigate();
  const [gerando, setGerando] = useState(false);
  const status = pauta.carrosseis[0]?.status ?? null;

  async function gerar() {
    setGerando(true);
    try {
      await solicitar({ data: { pautaId: pauta.id } });
      toast.success("Carrossel pronto.", {
        action: {
          label: "Ver",
          onClick: () =>
            navigate({
              to: "/aprovacao/$pautaId",
              params: { pautaId: pauta.id },
              hash: "carrossel",
            }),
        },
      });
    } catch (e) {
      toast.error(mensagemErro(e, "Não consegui gerar o carrossel."));
    } finally {
      setGerando(false);
    }
  }

  let conteudo: ReactNode;
  if (gerando || status === "gerando") {
    return (
      <Button size="sm" variant="ghost" disabled>
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> Gerando carrossel…
      </Button>
    );
  }
  if (status === "pronto") {
    return (
      <Button size="sm" variant="ghost" asChild>
        <Link to="/aprovacao/$pautaId" params={{ pautaId: pauta.id }} hash="carrossel">
          <Images className="w-4 h-4 mr-1.5" /> Ver carrossel
        </Link>
      </Button>
    );
  }
  if (status === "erro") {
    conteudo = (
      <>
        <RotateCcw className="w-4 h-4 mr-1.5" /> Tentar o carrossel de novo
      </>
    );
  } else {
    conteudo = (
      <>
        <Images className="w-4 h-4 mr-1.5" /> Gerar carrossel
      </>
    );
  }
  return (
    <Button size="sm" variant="ghost" onClick={gerar}>
      {conteudo}
    </Button>
  );
}
