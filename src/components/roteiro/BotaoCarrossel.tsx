import { useState, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Images, Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { gerarCarrossel } from "@/lib/agentes.functions";
import { mensagemErro } from "@/lib/mensagem-erro";

/**
 * Gera ou mostra o carrossel de um roteiro já escrito. Enquanto o agente
 * trabalha (até ~2 min), o botão fica em "Gerando carrossel…".
 */
export function BotaoCarrossel({ pautaId, status }: { pautaId: string; status: string | null }) {
  const solicitar = useServerFn(gerarCarrossel);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [gerando, setGerando] = useState(false);

  async function gerar() {
    setGerando(true);
    try {
      await solicitar({ data: { pautaId } });
      // Roteiros e Plano mostram o estado do carrossel: as duas recarregam.
      queryClient.invalidateQueries({ queryKey: ["roteiros"] });
      queryClient.invalidateQueries({ queryKey: ["plano-pautas"] });
      toast.success("Carrossel pronto.", {
        action: {
          label: "Ver",
          onClick: () =>
            navigate({
              to: "/aprovacao/$pautaId",
              params: { pautaId },
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
        <Link to="/aprovacao/$pautaId" params={{ pautaId }} hash="carrossel">
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
