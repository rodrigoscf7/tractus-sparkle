import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useEnsureConta } from "@/hooks/use-ensure-conta";

/**
 * Moldura do onboarding. Fora de `_authenticated` de propósito: sem sidebar,
 * sem menu, sem nada competindo com a pergunta na tela.
 *
 * O gate é o espelho do de `_authenticated`: lá, quem não concluiu vem para
 * cá; aqui, quem já concluiu volta para o app. Sem laço entre os dois.
 */
export const Route = createFileRoute("/onboarding")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });

    const { data: membro } = await supabase
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", data.user.id)
      .order("criado_em")
      .limit(1)
      .maybeSingle();

    // Sem conta ainda: o componente cria via useEnsureConta e o wizard segue.
    if (!membro?.conta_id) return { user: data.user };

    const { data: onboarding } = await supabase
      .from("onboarding_respostas")
      .select("concluido_em")
      .eq("conta_id", membro.conta_id)
      .maybeSingle();

    if (onboarding?.concluido_em) throw redirect({ to: "/pipeline" });

    return { user: data.user };
  },
  component: OnboardingLayout,
});

function OnboardingLayout() {
  useEnsureConta();

  return (
    <div className="min-h-screen bg-background">
      <Outlet />
    </div>
  );
}
