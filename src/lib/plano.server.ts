/**
 * Criação do plano semanal fora do cron de domingo: no fim do onboarding e
 * quando o assinante pede pela tela. Só roda no servidor (service role).
 *
 * SEGURANÇA: não confere posse. Quem chama garante que `contaId` é da conta do
 * usuário logado.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Um plano novo só depois deste intervalo; antes disso devolve o que já existe. */
const DIAS_ENTRE_PLANOS = 6;

/** Data de amanhã em São Paulo (AAAA-MM-DD): o plano pedido agora cobre os 7 dias seguintes. */
function amanhaEmSaoPaulo(): string {
  const hoje = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(
    new Date(),
  );
  const d = new Date(`${hoje}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Garante um plano recente para a conta e devolve o id. Idempotente: um plano
 * criado nos últimos dias (e que não falhou) é devolvido em vez de duplicado.
 * O plano entra com prioridade na fila do planejador.
 */
export async function criarPlanoDaConta(contaId: string): Promise<string> {
  const db = supabaseAdmin;
  const desde = new Date(Date.now() - DIAS_ENTRE_PLANOS * 86_400_000).toISOString();

  const { data: recente } = await db
    .from("planos_semanais")
    .select("id")
    .eq("conta_id", contaId)
    .neq("status", "erro")
    .gte("criado_em", desde)
    .order("criado_em", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (recente?.id) return recente.id;

  const { data: onboarding } = await db
    .from("onboarding_respostas")
    .select("perfil_id, concluido_em")
    .eq("conta_id", contaId)
    .maybeSingle();
  if (!onboarding?.concluido_em || !onboarding.perfil_id) {
    throw new Error("Conclua o onboarding para receber o seu plano da semana.");
  }

  // Upsert: um plano que falhou para a mesma semana recomeça do zero.
  const { data: plano, error } = await db
    .from("planos_semanais")
    .upsert(
      {
        conta_id: contaId,
        perfil_id: onboarding.perfil_id,
        semana_inicio: amanhaEmSaoPaulo(),
        prioridade: 1,
        status: "coletando",
        etapa_dados: {},
        relatorio: null,
        erro: null,
        tentativas: 0,
        reservado_em: null,
        atualizado_em: new Date().toISOString(),
      },
      { onConflict: "conta_id,semana_inicio" },
    )
    .select("id")
    .single();
  if (error || !plano) throw new Error("Não consegui pedir o seu plano. Tente de novo.");
  return plano.id;
}
