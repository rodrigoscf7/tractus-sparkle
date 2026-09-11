import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/estados";


export const Route = createFileRoute("/_authenticated/pipeline")({
  head: () => ({
    meta: [
      { title: "Pipeline de produção | prevIA - CONTENT" },
      {
        name: "description",
        content: "Acompanhe cada pauta da ideação à publicação, por perfil de cliente.",
      },
      { property: "og:title", content: "Pipeline de produção | prevIA - CONTENT" },
      { property: "og:description", content: "Estado de cada pauta no fluxo de produção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PipelinePage,
});

type Pauta = {
  id: string;
  perfil_id: string | null;
  tema: string | null;
  angulo: string | null;
  formato_sugerido: string | null;
  status: string | null;
  criado_em: string | null;
  perfis: { nome: string; tipo: string } | null;
};

const COLUMNS: { id: string; label: string; tone: string }[] = [
  { id: "gerada", label: "Geradas", tone: "bg-muted text-foreground" },
  { id: "em_producao", label: "Em produção", tone: "bg-warning/15 text-warning" },
  // Grafite sobre o amarelo, não amarelo como texto — ver regra em styles.css:10.
  { id: "aguardando_aprovacao", label: "Aguardando aprovação", tone: "bg-primary/25 text-foreground" },
  { id: "aprovada", label: "Aprovadas", tone: "bg-success/15 text-success" },
  { id: "rejeitada", label: "Rejeitadas", tone: "bg-destructive/15 text-destructive" },
];

function PipelinePage() {
  const [perfilFiltro, setPerfilFiltro] = useState<string>("todos");

  const { data: pautas, refetch, isLoading, isError } = useQuery({
    queryKey: ["pautas-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pautas_geradas")
        .select("id, perfil_id, tema, angulo, formato_sugerido, status, criado_em, perfis:perfis(nome,tipo)")
        .order("criado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Pauta[];
    },
  });

  const { data: perfis } = useQuery({
    queryKey: ["perfis-filtro-pipeline"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("perfis")
        .select("id, nome")
        .order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("pipeline-pautas")
      .on("postgres_changes", { event: "*", schema: "public", table: "pautas_geradas" }, () => refetch())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [refetch]);

  const filtradas = (pautas ?? []).filter(
    (p) => perfilFiltro === "todos" || p.perfil_id === perfilFiltro,
  );

  return (
    <div className="p-4 sm:p-8 max-w-[1600px]">
      <header className="mb-6 sm:mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold">Pipeline</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Fluxo completo de produção. Único passo manual: aprovar ou rejeitar.
          </p>
        </div>
        <div className="w-full sm:w-64">
          <label
            htmlFor="filtro-perfil"
            className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
          >
            Perfil
          </label>
          <Select value={perfilFiltro} onValueChange={setPerfilFiltro}>
            <SelectTrigger id="filtro-perfil" aria-label="Filtrar por perfil" className="mt-1">
              <SelectValue placeholder="Todos os perfis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os perfis</SelectItem>
              {(perfis ?? []).map((perfil) => (
                <SelectItem key={perfil.id} value={perfil.id}>
                  {perfil.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {isLoading && <EstadoCarregando linhas={4} rotulo="Carregando as pautas" />}

      {isError && (
        <EstadoErro
          titulo="Não consegui carregar as pautas"
          descricao="A conexão falhou no meio do caminho. Nenhuma pauta foi perdida."
          onTentarDeNovo={() => refetch()}
        />
      )}

      {/*
       * Quadro inteiro vazio é conta nova: uma orientação só, com a ação que
       * destrava o fluxo. Repetir "Nada aqui ainda." nas cinco colunas dizia ao
       * usuário que o produto está quebrado.
       */}
      {!isLoading && !isError && filtradas.length === 0 && (
        <EstadoVazio
          titulo="Nenhuma pauta por aqui ainda"
          descricao="As pautas aparecem assim que você escolher, na curadoria, quais assuntos valem virar post seu."
          acao={
            <Button asChild>
              <Link to="/curadoria">Escolher assuntos</Link>
            </Button>
          }
        />
      )}

      {!isLoading && !isError && filtradas.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          {COLUMNS.map((col) => {
            const items = filtradas.filter((p) => p.status === col.id);
            return (
              <div key={col.id} className="flex flex-col min-w-0">
                <div className="flex items-center justify-between mb-3 px-1">
                  <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                    {col.label}
                  </h2>
                  <Badge className={`${col.tone} border-0 num`}>{items.length}</Badge>
                </div>
                <div className="space-y-3 min-h-[200px]">
                  {items.map((p) => (
                    <PautaCard
                      key={p.id}
                      pauta={p}
                      clickable={col.id === "aguardando_aprovacao" || col.id === "aprovada"}
                    />
                  ))}
                  {items.length === 0 && (
                    <div
                      aria-hidden="true"
                      className="rounded-lg border border-dashed border-border h-20"
                    />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PautaCard({ pauta, clickable }: { pauta: Pauta; clickable: boolean }) {
  const body = (
    <Card
      className={`p-4 bg-surface border-border h-full ${
        clickable ? "transition hover:border-primary/40 motion-reduce:transition-none" : ""
      }`}
    >
      <div className="flex items-center gap-2 mb-2">
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-primary" />
        <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
          {pauta.perfis?.nome ?? "—"}
        </span>
      </div>
      <h3 className="font-medium text-sm leading-snug mb-2">{pauta.tema ?? "(sem tema)"}</h3>
      <p className="text-xs text-muted-foreground line-clamp-2 mb-3">{pauta.angulo}</p>
      {pauta.formato_sugerido && (
        <Badge variant="outline" className="text-[11px] font-mono uppercase">
          {pauta.formato_sugerido}
        </Badge>
      )}
    </Card>
  );

  // Cartão sem destino não finge ser clicável: sem cursor-pointer, sem hover.
  if (!clickable) return body;
  return (
    <Link
      to="/aprovacao/$pautaId"
      params={{ pautaId: pauta.id }}
      className="block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      {body}
    </Link>
  );
}
