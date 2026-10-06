import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useConta } from "@/hooks/use-conta";
import { usePlanoAtual } from "@/hooks/use-plano";

/**
 * O que espera uma decisão do usuário, para o menu mostrar ao lado de cada item.
 *
 * Filtra pela conta do próprio usuário: a leitura de pautas também libera
 * admins, que contariam os roteiros de todas as contas.
 */
export function useAvisosMenu() {
  const { data: conta } = useConta();
  const { data: plano } = usePlanoAtual();
  const contaId = conta?.conta?.id as string | undefined;

  const { data: roteirosParaLer = 0, refetch } = useQuery({
    queryKey: ["avisos-menu", "roteiros-para-ler", contaId],
    enabled: Boolean(contaId),
    queryFn: async () => {
      const { count, error } = await supabase
        .from("pautas_geradas")
        .select("id", { count: "exact", head: true })
        .eq("conta_id", contaId as string)
        .eq("status", "aguardando_aprovacao");
      if (error) throw error;
      return count ?? 0;
    },
  });

  // Roteiro novo ou aprovado em outra aba: o número acompanha sem recarregar.
  useEffect(() => {
    if (!contaId) return;
    const canal = supabase
      .channel("avisos-menu-pautas")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "pautas_geradas",
          filter: `conta_id=eq.${contaId}`,
        },
        () => refetch(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [contaId, refetch]);

  return {
    roteirosParaLer,
    planoParaAprovar: plano?.status === "pronto",
  };
}
