/**
 * Plano semanal no servidor: criação fora do cron de domingo (onboarding, tela
 * e assistente) e as ações do assinante sobre o plano.
 *
 * SEGURANÇA: `criarPlanoDaConta` não confere posse; quem chama garante que
 * `contaId` é da conta do usuário logado. As ações recebem o client do usuário
 * e conferem a posse por ele.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { PautaPlano, RelatorioPlano } from "@/lib/plano";

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

  // Trial expirado volta para 'free': sem assinatura, sem plano (e sem custo).
  const { data: conta } = await db
    .from("contas")
    .select("status, plano_codigo")
    .eq("id", contaId)
    .maybeSingle();
  if (!conta || conta.status !== "ativa" || conta.plano_codigo === "free") {
    throw new Error("Sua assinatura não está ativa. Assine para receber o plano da semana.");
  }

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

// ---------------------------------------------------------------------------
// Ações do assinante sobre o plano (tela do plano e assistente de suporte)
//
// Cada uma confirma a posse lendo o plano com o client do PRÓPRIO usuário
// (se ele não consegue ler, não é dele) e só então escreve com o service role.
// ---------------------------------------------------------------------------

async function planoDoUsuario(supabase: SupabaseClient<Database>, planoId: string) {
  const { data: plano } = await supabase
    .from("planos_semanais")
    .select("id, conta_id, perfil_id, status, relatorio")
    .eq("id", planoId)
    .maybeSingle();
  if (!plano) throw new Error("Plano não encontrado na sua conta.");
  return { ...plano, relatorio: plano.relatorio as unknown as RelatorioPlano | null };
}

/** Marca ou desmarca uma pauta como fora da semana, antes da aprovação. */
export async function alternarPautaDoPlano(
  supabase: SupabaseClient<Database>,
  planoId: string,
  indice: number,
  removida: boolean,
) {
  const plano = await planoDoUsuario(supabase, planoId);
  if (plano.status !== "pronto" || !plano.relatorio) {
    throw new Error("Este plano não pode mais ser alterado.");
  }
  if (!plano.relatorio.pautas[indice]) throw new Error("Esse vídeo não existe no plano.");
  const pautas = plano.relatorio.pautas.map((p, i) => (i === indice ? { ...p, removida } : p));
  if (pautas.every((p) => p.removida)) {
    throw new Error("Deixe pelo menos um vídeo na semana.");
  }

  const { error } = await supabaseAdmin
    .from("planos_semanais")
    .update({
      relatorio: { ...plano.relatorio, pautas } as never,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", plano.id)
    .eq("status", "pronto");
  if (error) throw new Error("Não consegui salvar. Tente de novo.");
}

/** Troca uma pauta por outra gerada na hora, opcionalmente seguindo um pedido. */
export async function trocarPautaDoPlano(
  supabase: SupabaseClient<Database>,
  planoId: string,
  indice: number,
  pedido: string,
): Promise<PautaPlano> {
  const plano = await planoDoUsuario(supabase, planoId);
  if (plano.status !== "pronto") throw new Error("Este plano não pode mais ser alterado.");

  const { invocarAgente } = await import("@/lib/agentes.server");
  const resposta = await invocarAgente<{ pauta?: PautaPlano }>(
    "planejador-agent",
    {
      acao: "trocar_pauta",
      plano_id: plano.id,
      indice,
      pedido: pedido.trim().slice(0, 300) || null,
    },
    { timeoutMs: 90_000 },
  );
  if (!resposta.ok || !resposta.data?.pauta) {
    throw new Error("Não consegui gerar outra opção agora. Tente de novo em instantes.");
  }
  return resposta.data.pauta;
}

/**
 * Aprova o plano: cada pauta mantida vira uma pauta do pipeline, que segue
 * sozinha para roteiro, revisão e aprovação final.
 */
export async function aprovarPlanoDoUsuario(
  supabase: SupabaseClient<Database>,
  planoId: string,
): Promise<{ pautas: number; jaAprovado: boolean }> {
  const plano = await planoDoUsuario(supabase, planoId);
  if (plano.status === "aprovado") return { pautas: 0, jaAprovado: true };
  if (plano.status !== "pronto" || !plano.relatorio) {
    throw new Error("O plano ainda não está pronto para aprovar.");
  }
  if (!plano.perfil_id) throw new Error("Plano sem perfil vinculado. Fale com o suporte.");

  const mantidas = plano.relatorio.pautas.filter((p) => !p.removida);

  const { data: cota } = await supabaseAdmin.rpc("limite_disponivel", {
    _conta_id: plano.conta_id,
    _tipo: "roteiro",
  });
  const c = (cota ?? {}) as { permitido?: boolean; limite?: number; usado?: number };
  if (c.permitido === false) {
    throw new Error("Você chegou ao limite de roteiros do seu plano neste mês.");
  }
  const restantes =
    typeof c.limite === "number" && typeof c.usado === "number" ? c.limite - c.usado : Infinity;
  if (mantidas.length > restantes) {
    throw new Error(
      `Seu plano permite mais ${restantes} roteiro(s) este mês. Remova ${mantidas.length - restantes} vídeo(s) e aprove de novo.`,
    );
  }

  // Fecha o plano antes de criar as pautas: dois cliques não duplicam a semana.
  const { data: fechado } = await supabaseAdmin
    .from("planos_semanais")
    .update({
      status: "aprovado",
      aprovado_em: new Date().toISOString(),
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", plano.id)
    .eq("status", "pronto")
    .select("id")
    .maybeSingle();
  if (!fechado) return { pautas: 0, jaAprovado: true };

  // Em ordem de data: o pipeline produz na ordem de criação.
  const ordenadas = [...mantidas].sort((a, b) => a.data.localeCompare(b.data));
  const { error } = await supabaseAdmin.from("pautas_geradas").insert(
    ordenadas.map((p) => ({
      perfil_id: plano.perfil_id,
      tema: p.tema,
      angulo: p.angulo,
      formato_sugerido: "Reel falado",
      status: "gerada",
      plano_semanal_id: plano.id,
      analise_viral_id: p.analise_viral_id,
      gancho_modelo: p.gancho,
      estrutura_modelo: p.estrutura,
      data_prevista: p.data,
    })),
  );
  if (error) {
    // Reabre o plano para o assinante poder tentar de novo.
    await supabaseAdmin
      .from("planos_semanais")
      .update({ status: "pronto", aprovado_em: null })
      .eq("id", plano.id);
    throw new Error("Não consegui enviar os vídeos para produção. Tente de novo.");
  }
  return { pautas: ordenadas.length, jaAprovado: false };
}
