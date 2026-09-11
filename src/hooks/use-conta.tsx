import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TipoUso = "curadoria" | "roteiro" | "carrossel";

export const TIPOS_USO: { tipo: TipoUso; label: string; campoLimite: string }[] = [
  { tipo: "curadoria", label: "Referências curadas", campoLimite: "limite_curadorias_mes" },
  { tipo: "roteiro", label: "Roteiros produzidos", campoLimite: "limite_roteiros_mes" },
  { tipo: "carrossel", label: "Carrosséis gerados", campoLimite: "limite_carrosseis_mes" },
];

/** Conta (workspace) do usuário atual, com plano e consumo do ciclo corrente. */
export function useConta() {
  return useQuery({
    queryKey: ["minha-conta"],
    queryFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) return null;

      const { data: membro, error: e1 } = await supabase
        .from("conta_membros")
        .select("papel, conta_id, contas:contas(*, planos:planos(*))")
        .eq("user_id", userData.user.id)
        .order("criado_em")
        .limit(1)
        .maybeSingle();
      if (e1) throw e1;
      if (!membro?.contas) return null;

      const ciclo = new Date();
      const cicloInicio = new Date(ciclo.getFullYear(), ciclo.getMonth(), 1);
      const cicloStr = `${cicloInicio.getFullYear()}-${String(cicloInicio.getMonth() + 1).padStart(2, "0")}-01`;

      const { data: uso, error: e2 } = await supabase
        .from("uso_mensal")
        .select("tipo, quantidade")
        .eq("conta_id", membro.conta_id)
        .eq("ciclo", cicloStr);
      if (e2) throw e2;

      const { count: perfisCount } = await supabase
        .from("perfis")
        .select("id", { count: "exact", head: true })
        .eq("conta_id", membro.conta_id);
      const { count: refsCount } = await supabase
        .from("perfis_referencia")
        .select("id", { count: "exact", head: true })
        .eq("conta_id", membro.conta_id);

      const usoMap = Object.fromEntries((uso ?? []).map((u) => [u.tipo, u.quantidade]));

      const resetEm = new Date(cicloInicio.getFullYear(), cicloInicio.getMonth() + 1, 1);

      return {
        papel: membro.papel,
        conta: membro.contas,
        plano: membro.contas.planos,
        uso: usoMap as Record<string, number>,
        perfisCount: perfisCount ?? 0,
        refsCount: refsCount ?? 0,
        ciclo: cicloStr,
        resetEm,
      };
    },
  });
}
