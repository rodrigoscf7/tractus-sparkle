import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Onboarding: garante que o usuário logado pertença a uma conta.
 * Na primeira entrada cria a conta, vincula como owner e aplica o plano gratuito.
 */
export function useEnsureConta() {
  const queryClient = useQueryClient();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || cancelled) return;

      const { data: membro } = await supabase
        .from("conta_membros")
        .select("id")
        .eq("user_id", user.id)
        .limit(1)
        .maybeSingle();
      if (membro || cancelled) return;

      const nome = user.email?.split("@")[0] ?? "Minha conta";
      const { data: conta, error } = await supabase
        .from("contas")
        .insert({ nome, plano_codigo: "free" })
        .select("id")
        .single();
      if (error || !conta || cancelled) return;

      await supabase
        .from("conta_membros")
        .insert({ conta_id: conta.id, user_id: user.id, papel: "owner" });

      queryClient.invalidateQueries({ queryKey: ["minha-conta"] });
    })();

    return () => {
      cancelled = true;
    };
  }, [queryClient]);
}
