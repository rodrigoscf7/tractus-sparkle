import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ExternalLink, Heart, MessageCircle, Play } from "lucide-react";
import { toast } from "sonner";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/estados";
import { mensagemErro } from "@/lib/mensagem-erro";

export const Route = createFileRoute("/_authenticated/curadoria")({
  component: CuradoriaPage,
  head: () => ({
    meta: [
      { title: "Curadoria — selecionar referências | prevIA - CONTENT" },
      {
        name: "description",
        content:
          "Revise as referências capturadas pelo agente curador e escolha quais avançam para pauta.",
      },
      { property: "og:title", content: "Curadoria — selecionar referências | prevIA - CONTENT" },
      {
        property: "og:description",
        content: "Validação humana antes do ideador gerar pautas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

type Curado = {
  id: string;
  url: string | null;
  formato: string | null;
  tema: string | null;
  gancho: string | null;
  score_curadoria: number | null;
  texto_original: string | null;
  capturado_em: string | null;
  likes: number | null;
  comentarios: number | null;
  views: number | null;
  postado_em: string | null;
  aprovacao_humana: string;
  decidido_em: string | null;
  perfis_referencia: {
    handle: string;
    nicho: string | null;
    foco_curadoria: string | null;
    perfis: { nome: string; foco_curadoria: string | null } | null;
  } | null;
};

const TABS = [
  { id: "pendente", label: "Pendentes" },
  { id: "aprovado", label: "Aprovadas" },
  { id: "descartado", label: "Descartadas" },
] as const;

/** Cada aba vazia explica o que vai cair ali — e por quê. */
const VAZIO: Record<(typeof TABS)[number]["id"], { titulo: string; descricao: string }> = {
  pendente: {
    titulo: "Nenhum assunto esperando você",
    descricao:
      "Toda manhã a prevIA lê os perfis que você indicou e separa o que teve mais tração. O que combinar com a sua marca aparece aqui.",
  },
  aprovado: {
    titulo: "Você ainda não escolheu nenhum assunto",
    descricao:
      "Os assuntos que você aprovar ficam registrados aqui e viram roteiro automaticamente.",
  },
  descartado: {
    titulo: "Nada descartado",
    descricao:
      "O que você recusar fica aqui — e ensina a prevIA o que não tem a ver com você.",
  },
};

function CuradoriaPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pendente");
  const queryClient = useQueryClient();

  const { data: itens, isLoading, isError, refetch } = useQuery({
    queryKey: ["curadoria", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos_curados")
        .select(
          "id, url, formato, tema, gancho, score_curadoria, texto_original, capturado_em, likes, comentarios, views, postado_em, aprovacao_humana, decidido_em, perfis_referencia:perfis_referencia(handle,nicho,foco_curadoria,perfis:perfis(nome,foco_curadoria))",
        )
        .eq("aprovacao_humana", tab)
        .order("views", { ascending: false, nullsFirst: false })
        .order("capturado_em", { ascending: false })
        .limit(120);
      if (error) throw error;
      return (data ?? []) as unknown as Curado[];
    },
  });

  const decidir = useMutation({
    mutationFn: async ({ id, decisao }: { id: string; decisao: "aprovado" | "descartado" }) => {
      const { error } = await supabase
        .from("conteudos_curados")
        .update({ aprovacao_humana: decisao, decidido_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      return decisao;
    },
    onSuccess: (decisao) => {
      toast.success(
        decisao === "aprovado"
          ? "Aprovado — a prevIA já está escrevendo o roteiro."
          : "Descartado. A prevIA anotou que esse assunto não é a sua cara.",
      );
      queryClient.invalidateQueries({ queryKey: ["curadoria"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não consegui registrar sua escolha.")),
  });

  return (
    <div className="p-4 sm:p-8 max-w-[1100px]">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Escolher assuntos</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Nada vira post sem você. Estes são os assuntos que mais renderam nos perfis que você
          acompanha, dos de maior alcance para os menores. O que você aprovar vira roteiro seu.
        </p>
      </header>

      <div role="tablist" aria-label="Filtrar referências" className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`min-h-11 sm:min-h-9 px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
              tab === t.id
                ? "bg-primary/25 text-foreground font-semibold"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && <EstadoCarregando linhas={3} rotulo="Carregando as referências" />}

      {isError && (
        <EstadoErro
          titulo="Não consegui carregar as referências"
          descricao="A conexão falhou no meio do caminho. Nada foi perdido."
          onTentarDeNovo={() => refetch()}
        />
      )}

      {!isLoading && !isError && (itens ?? []).length === 0 && (
        <EstadoVazio
          titulo={VAZIO[tab].titulo}
          descricao={VAZIO[tab].descricao}
        />
      )}

      <div className="space-y-4">
        {(itens ?? []).map((item) => (
          <Card key={item.id} className="p-4 sm:p-5 bg-surface border-border">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              {/* Era bg-accent/15 text-accent: cinza claro sobre cinza claro, ilegível. */}
              <Badge className="border-0 bg-muted text-foreground text-[11px] font-mono uppercase tracking-wider">
                para {item.perfis_referencia?.perfis?.nome ?? "perfil não vinculado"}
              </Badge>
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                ref @{item.perfis_referencia?.handle ?? "—"}
              </span>
              <Badge variant="outline" className="text-[11px] font-mono uppercase">
                foco{" "}
                {(item.perfis_referencia?.foco_curadoria ??
                  item.perfis_referencia?.perfis?.foco_curadoria ??
                  "posicionamento") === "viral"
                  ? "viral"
                  : "posicionamento"}
              </Badge>
              {item.formato && (
                <Badge variant="outline" className="text-[11px] font-mono uppercase">
                  {item.formato}
                </Badge>
              )}
              {item.score_curadoria != null && (
                <Badge className="border-0 bg-primary/25 text-foreground text-[11px] font-mono num">
                  score {item.score_curadoria}
                </Badge>
              )}
              {item.capturado_em && (
                <span className="text-[11px] text-muted-foreground num">
                  {new Date(item.capturado_em).toLocaleDateString("pt-BR")}
                </span>
              )}
            </div>

            <h3 className="font-medium text-sm mb-1">{item.tema ?? "(sem tema)"}</h3>
            {item.gancho && <p className="text-sm text-muted-foreground mb-3">{item.gancho}</p>}

            <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground mb-3">
              {item.views != null && (
                <span className="flex items-center gap-1">
                  <Play className="w-3.5 h-3.5" /> {item.views.toLocaleString("pt-BR")}
                </span>
              )}
              {item.likes != null && (
                <span className="flex items-center gap-1">
                  <Heart className="w-3.5 h-3.5" /> {item.likes.toLocaleString("pt-BR")}
                </span>
              )}
              {item.comentarios != null && (
                <span className="flex items-center gap-1">
                  <MessageCircle className="w-3.5 h-3.5" />{" "}
                  {item.comentarios.toLocaleString("pt-BR")}
                </span>
              )}
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-foreground underline underline-offset-2 decoration-border hover:decoration-foreground rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Ver post original
                </a>
              )}
            </div>

            {item.texto_original && (
              <details className="mb-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Caption original
                </summary>
                <p className="text-xs text-muted-foreground mt-2 whitespace-pre-wrap">
                  {item.texto_original}
                </p>
              </details>
            )}

            {tab === "pendente" ? (
              <div className="flex gap-2">
                <Button
                  size="sm"
                  disabled={decidir.isPending}
                  onClick={() => decidir.mutate({ id: item.id, decisao: "aprovado" })}
                >
                  <Check className="w-4 h-4 mr-1" /> Aprovar e gerar pauta
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={decidir.isPending}
                  onClick={() => decidir.mutate({ id: item.id, decisao: "descartado" })}
                >
                  <X className="w-4 h-4 mr-1" /> Descartar
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                disabled={decidir.isPending}
                onClick={() =>
                  decidir.mutate({
                    id: item.id,
                    decisao: tab === "aprovado" ? "descartado" : "aprovado",
                  })
                }
              >
                {tab === "aprovado" ? "Descartar" : "Aprovar e gerar pauta"}
              </Button>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
