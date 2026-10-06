import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Ações do assinante sobre o plano semanal, chamadas pela tela do plano.
 *
 * A lógica (posse, cota, regras) mora em `plano.server.ts`, compartilhada com o
 * assistente de suporte. Aqui só entra o usuário da sessão.
 */

/**
 * Pede o plano agora, sem esperar o domingo. Usado pelo onboarding e pela tela
 * do plano de quem ainda não tem um. Idempotente: se já existe um plano recente,
 * devolve esse.
 */
export const solicitarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: membro } = await context.supabase
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", context.userId)
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (!membro?.conta_id) throw new Error("Seu usuário ainda não está vinculado a uma conta.");

    const { criarPlanoDaConta } = await import("@/lib/plano.server");
    const planoId = await criarPlanoDaConta(membro.conta_id as string);
    return { planoId };
  });

/** Marca ou desmarca uma pauta como removida antes da aprovação. */
export const removerPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planoId: string; indice: number; removida: boolean }) => data)
  .handler(async ({ data, context }) => {
    const { alternarPautaDoPlano } = await import("@/lib/plano.server");
    await alternarPautaDoPlano(context.supabase, data.planoId, data.indice, data.removida);
    return { ok: true as const };
  });

/** Troca uma pauta por outra gerada na hora, opcionalmente seguindo um pedido. */
export const trocarPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planoId: string; indice: number; pedido?: string }) => data)
  .handler(async ({ data, context }) => {
    const { trocarPautaDoPlano } = await import("@/lib/plano.server");
    const pauta = await trocarPautaDoPlano(
      context.supabase,
      data.planoId,
      data.indice,
      data.pedido ?? "",
    );
    return { pauta };
  });

/**
 * Aprova o plano: cada pauta mantida vira uma pauta do pipeline, que segue
 * sozinha para roteiro, revisão e aprovação final.
 */
export const aprovarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planoId: string }) => data)
  .handler(async ({ data, context }) => {
    const { aprovarPlanoDoUsuario } = await import("@/lib/plano.server");
    return await aprovarPlanoDoUsuario(context.supabase, data.planoId);
  });
