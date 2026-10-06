import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { mensagemErro } from "@/lib/mensagem-erro";
import type { AcaoSuporte } from "@/lib/suporte";

type Chamado = {
  id: string;
  resumo: string;
  status: "aberto" | "resolvido";
  criado_em: string;
  conversa_id: string | null;
  contas: { nome: string | null } | null;
};

const quando = (iso: string) =>
  new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

/** A conversa que gerou o chamado: o que a pessoa perguntou e o que o assistente fez. */
function Conversa({ conversaId }: { conversaId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["suporte-conversa", conversaId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suporte_mensagens")
        .select("id, papel, conteudo, acao, criado_em")
        .eq("conversa_id", conversaId)
        .order("criado_em");
      if (error) throw error;
      return data ?? [];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando a conversa…</p>;
  return (
    <ol className="space-y-2 text-sm">
      {(data ?? []).map((m) => {
        const acao = m.acao as AcaoSuporte | null;
        return (
          <li
            key={m.id}
            className={m.papel === "usuario" ? "text-foreground" : "text-muted-foreground"}
          >
            <span className="font-mono text-[11px] uppercase tracking-wider mr-2">
              {m.papel === "usuario" ? "Pessoa" : "IA"}
            </span>
            <span className="whitespace-pre-wrap">{m.conteudo}</span>
            {acao && (
              <span className="block mt-0.5 text-xs">
                Ação: {acao.descricao} · {acao.status}
                {acao.resultado ? ` · ${acao.resultado}` : ""}
              </span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

/** Chamados que o assistente encaminhou para uma pessoa. */
export function ChamadosSuporte() {
  const queryClient = useQueryClient();
  const [mostrarResolvidos, setMostrarResolvidos] = useState(false);
  const [aberto, setAberto] = useState<string | null>(null);

  const { data: chamados, isLoading } = useQuery({
    queryKey: ["suporte-chamados", mostrarResolvidos],
    queryFn: async () => {
      let q = supabase
        .from("suporte_chamados")
        .select("id, resumo, status, criado_em, conversa_id, contas:contas(nome)")
        .order("criado_em", { ascending: false })
        .limit(100);
      if (!mostrarResolvidos) q = q.eq("status", "aberto");
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Chamado[];
    },
  });

  const resolver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("suporte_chamados")
        .update({ status: "resolvido", resolvido_em: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Chamado resolvido.");
      queryClient.invalidateQueries({ queryKey: ["suporte-chamados"] });
    },
    onError: (e: Error) => toast.error(mensagemErro(e, "Não consegui marcar como resolvido.")),
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Conversas que o assistente encaminhou para uma pessoa. Cada chamado novo também chega por
          push para os admins.
        </p>
        <Button size="sm" variant="outline" onClick={() => setMostrarResolvidos((v) => !v)}>
          {mostrarResolvidos ? "Só os abertos" : "Mostrar resolvidos"}
        </Button>
      </div>

      {isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!isLoading && !chamados?.length && (
        <Card className="p-5 bg-surface border-border text-sm text-muted-foreground">
          <MessageCircle className="w-4 h-4 inline mr-1.5" />
          Nenhum chamado {mostrarResolvidos ? "" : "aberto"}.
        </Card>
      )}

      {chamados?.map((c) => (
        <Card key={c.id} className="p-4 bg-surface border-border">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium">{c.contas?.nome ?? "Conta"}</span>
                <span className="text-xs text-muted-foreground num">{quando(c.criado_em)}</span>
                <Badge variant={c.status === "aberto" ? "default" : "secondary"}>{c.status}</Badge>
              </div>
              <p className="text-sm mt-1.5">{c.resumo}</p>
            </div>
            {c.status === "aberto" && (
              <Button size="sm" onClick={() => resolver.mutate(c.id)} disabled={resolver.isPending}>
                <Check className="w-4 h-4 mr-1.5" /> Resolvido
              </Button>
            )}
          </div>
          {c.conversa_id && (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => setAberto(aberto === c.id ? null : c.id)}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {aberto === c.id ? (
                  <ChevronUp className="w-3.5 h-3.5" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5" />
                )}
                {aberto === c.id ? "Esconder a conversa" : "Ver a conversa"}
              </button>
              {aberto === c.id && (
                <div className="mt-2 rounded-md border border-border bg-background p-3">
                  <Conversa conversaId={c.conversa_id} />
                </div>
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}
