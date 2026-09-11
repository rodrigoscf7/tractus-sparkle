import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito à administração da plataforma.");
}

/**
 * Cria (ou reaproveita) um lote de teste na fila e chama o push-agent na
 * hora, sem esperar o cron — só para o próprio admin confirmar que a
 * configuração de VAPID está funcionando de ponta a ponta.
 */
export const enviarNotificacaoTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as any, context.userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invocarAgente } = await import("@/lib/agentes.server");
    const admin = supabaseAdmin as any;

    const { data: membro, error: erroMembro } = await context.supabase
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", context.userId)
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (erroMembro) throw new Error(erroMembro.message);
    const contaId = membro?.conta_id;
    if (!contaId) throw new Error("Seu usuário não está vinculado a nenhuma conta.");

    const { data: perfil } = await admin
      .from("perfis")
      .select("id")
      .eq("conta_id", contaId)
      .limit(1)
      .maybeSingle();
    if (!perfil?.id) throw new Error("Nenhum perfil encontrado para testar.");

    const { data: lote, error: erroLote } = await admin
      .from("push_notificacoes_pendentes")
      .insert({
        conta_id: contaId,
        perfil_id: perfil.id,
        tipo: "pautas_prontas",
        contagem: 1,
        enviado_em: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (erroLote) throw new Error(erroLote.message);

    const resposta = await invocarAgente<{ enviadas?: number }>("push-agent", {
      queue_id: lote.id,
    });
    if (!resposta.ok) throw new Error(resposta.erro ?? "push-agent falhou.");

    return { enviadas: resposta.data?.enviadas ?? 0 };
  });
