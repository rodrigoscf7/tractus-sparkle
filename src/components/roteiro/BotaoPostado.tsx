import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { mensagemErro } from "@/lib/mensagem-erro";

async function atualizarPublicacao(pautaId: string, postado: boolean) {
  const { error } = await supabase
    .from("publicacoes")
    .update(
      postado
        ? { status: "postado", postado_em: new Date().toISOString() }
        : { status: "pendente", postado_em: null },
    )
    .eq("pauta_id", pautaId);
  if (error) throw error;
}

/** Marca na hora, com "Desfazer" no aviso: um toque errado não custa nada. */
export function BotaoPostado({
  pautaId,
  variant = "ghost",
}: {
  pautaId: string;
  variant?: "ghost" | "outline";
}) {
  const queryClient = useQueryClient();
  const [salvando, setSalvando] = useState(false);
  // Hoje e Roteiros contam o que foi postado: as duas recarregam.
  const recarregar = () => {
    queryClient.invalidateQueries({ queryKey: ["hoje"] });
    queryClient.invalidateQueries({ queryKey: ["roteiros"] });
  };

  async function marcar() {
    setSalvando(true);
    try {
      await atualizarPublicacao(pautaId, true);
      recarregar();
      toast.success("Marcado como postado.", {
        action: {
          label: "Desfazer",
          onClick: () =>
            atualizarPublicacao(pautaId, false)
              .then(recarregar)
              .catch((e) => toast.error(mensagemErro(e, "Não consegui desfazer."))),
        },
      });
    } catch (e) {
      toast.error(mensagemErro(e, "Não consegui marcar como postado."));
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Button size="sm" variant={variant} onClick={marcar} disabled={salvando}>
      {salvando ? (
        <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
      ) : (
        <Send className="w-4 h-4 mr-1.5" />
      )}
      Marcar como postado
    </Button>
  );
}
