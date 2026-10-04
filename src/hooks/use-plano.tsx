import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PLANO_EM_ANDAMENTO, type RelatorioPlano, type StatusPlano } from "@/lib/plano";

export type PlanoAtual = {
  id: string;
  status: StatusPlano;
  semana_inicio: string;
  relatorio: RelatorioPlano | null;
  erro: string | null;
  criado_em: string;
  pronto_em: string | null;
  aprovado_em: string | null;
};

/**
 * O plano mais recente da conta do usuário logado.
 *
 * Filtra pela conta do próprio usuário: a política de leitura também libera
 * admins, que veriam o plano de qualquer conta. Enquanto o plano é montado, a
 * consulta se repete sozinha para a tela acompanhar os passos.
 */
export function usePlanoAtual() {
  return useQuery({
    queryKey: ["plano-atual"],
    queryFn: async (): Promise<PlanoAtual | null> => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data: membro, error: e1 } = await supabase
        .from("conta_membros")
        .select("conta_id")
        .eq("user_id", userData.user.id)
        .order("criado_em")
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      if (!membro?.conta_id) return null;

      const { data, error } = await supabase
        .from("planos_semanais")
        .select("id, status, semana_inicio, relatorio, erro, criado_em, pronto_em, aprovado_em")
        .eq("conta_id", membro.conta_id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data as unknown as PlanoAtual) ?? null;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && PLANO_EM_ANDAMENTO.includes(status) ? 15_000 : false;
    },
  });
}
