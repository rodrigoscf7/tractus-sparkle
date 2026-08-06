import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, X, ExternalLink, Heart, MessageCircle, Play, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/curadoria")({
  component: CuradoriaPage,
  head: () => ({
    meta: [
      { title: "Curadoria — selecionar referências | Tractus" },
      {
        name: "description",
        content:
          "Revise as referências capturadas pelo agente curador e escolha quais avançam para pauta.",
      },
      { property: "og:title", content: "Curadoria — selecionar referências | Tractus" },
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
    perfis: { nome: string } | null;
  } | null;
};

const TABS = [
  { id: "pendente", label: "Pendentes" },
  { id: "aprovado", label: "Aprovadas" },
  { id: "descartado", label: "Descartadas" },
] as const;

function CuradoriaPage() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("pendente");
  const queryClient = useQueryClient();

  const { data: itens, isLoading } = useQuery({
    queryKey: ["curadoria", tab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conteudos_curados")
        .select(
          "id, url, formato, tema, gancho, score_curadoria, texto_original, capturado_em, likes, comentarios, views, postado_em, aprovacao_humana, decidido_em, perfis_referencia:perfis_referencia(handle,nicho,perfis:perfis(nome))",
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
          ? "Referência aprovada — o ideador vai gerar a pauta."
          : "Referência descartada.",
      );
      queryClient.invalidateQueries({ queryKey: ["curadoria"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-8 max-w-[1100px]">
      <header className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Curadoria</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Nada avança sem você. O curador captura e pontua as referências; o ideador só gera pauta
          das que você aprovar aqui.
        </p>
      </header>

      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-mono uppercase tracking-wider transition ${
              tab === t.id
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-foreground hover:bg-surface-elevated"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {isLoading && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" /> Carregando…
        </div>
      )}

      {!isLoading && (itens ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground italic">Nada aqui ainda.</p>
      )}

      <div className="space-y-4">
        {(itens ?? []).map((item) => (
          <Card key={item.id} className="p-4 sm:p-5 bg-surface border-border">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <span className="text-[11px] font-mono uppercase tracking-wider text-muted-foreground">
                @{item.perfis_referencia?.handle ?? "—"}
              </span>
              {item.formato && (
                <Badge variant="outline" className="text-[10px] font-mono uppercase">
                  {item.formato}
                </Badge>
              )}
              {item.score_curadoria != null && (
                <Badge className="border-0 bg-primary/15 text-primary text-[10px] font-mono">
                  score {item.score_curadoria}
                </Badge>
              )}
              {item.capturado_em && (
                <span className="text-[11px] text-muted-foreground/70">
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
                  className="flex items-center gap-1 text-primary hover:underline"
                >
                  <ExternalLink className="w-3.5 h-3.5" /> ver post
                </a>
              )}
            </div>

            {item.texto_original && (
              <details className="mb-3">
                <summary className="text-xs text-muted-foreground cursor-pointer">
                  Caption original
                </summary>
                <p className="text-xs text-muted-foreground/80 mt-2 whitespace-pre-wrap">
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
