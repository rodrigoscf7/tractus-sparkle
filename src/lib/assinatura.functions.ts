import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** Cria conta + assinatura em trial no primeiro acesso. Idempotente. */
export const iniciarConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;

    const { data: membro } = await admin
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", context.userId)
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (membro) return { contaId: membro.conta_id as string, criada: false };

    const email = (context.claims as Record<string, unknown>)?.["email"];
    const nome = typeof email === "string" ? email.split("@")[0] : "Minha conta";

    const { data, error } = await admin.rpc("iniciar_conta_trial", {
      _user_id: context.userId,
      _nome: nome,
      _plano: "starter",
    });
    if (error) throw new Error(error.message);
    return { contaId: String(data), criada: true };
  });

/** Assinatura da conta do usuário + planos disponíveis para compra. */
export const getMinhaAssinatura = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    await admin.rpc("expirar_trials");

    const { data: membro } = await context.supabase
      .from("conta_membros")
      .select("conta_id, papel")
      .eq("user_id", context.userId)
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (!membro)
      return {
        assinatura: null as any,
        planos: [] as any[],
        custo: null as any,
        contaId: null as string | null,
        papel: null as string | null,
        email: null as string | null,
      };

    const [assinatura, planos, custo] = await Promise.all([
      context.supabase.from("assinaturas").select("*").eq("conta_id", membro.conta_id).maybeSingle(),
      context.supabase.from("planos").select("*").eq("publico", true).eq("ativo", true).order("ordem"),
      context.supabase
        .from("vw_conta_economia_mensal")
        .select("*")
        .eq("conta_id", membro.conta_id)
        .order("ciclo", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const emailClaim = (context.claims as Record<string, unknown>)?.["email"];

    return {
      assinatura: assinatura.data ?? null,
      planos: (planos.data ?? []) as any[],
      custo: custo.data ?? null,
      contaId: membro.conta_id as string,
      papel: membro.papel as string,
      email: typeof emailClaim === "string" ? emailClaim : null,
    };
  });
