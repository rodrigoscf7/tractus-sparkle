import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import type { PautaPlano, RelatorioPlano } from "@/lib/plano";

/**
 * Ações do assinante sobre o plano semanal.
 *
 * `planos_semanais` só tem política de leitura para os membros da conta. Cada
 * função confirma a posse lendo o plano com o client do próprio usuário (se ele
 * não consegue ler, não é dele) e só então escreve com o service role.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function planoDoUsuario(supabase: SupabaseClient<Database>, planoId: string) {
  const { data: plano } = await supabase
    .from("planos_semanais")
    .select("id, conta_id, perfil_id, status, relatorio")
    .eq("id", planoId)
    .maybeSingle();
  if (!plano) throw new Error("Plano não encontrado na sua conta.");
  return { ...plano, relatorio: plano.relatorio as unknown as RelatorioPlano | null };
}

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
    const plano = await planoDoUsuario(context.supabase, data.planoId);
    if (plano.status !== "pronto" || !plano.relatorio) {
      throw new Error("Este plano não pode mais ser alterado.");
    }
    const pautas = plano.relatorio.pautas.map((p, i) =>
      i === data.indice ? { ...p, removida: data.removida } : p,
    );
    if (pautas.every((p) => p.removida)) {
      throw new Error("Deixe pelo menos um vídeo na semana.");
    }

    const db = await admin();
    const { error } = await db
      .from("planos_semanais")
      .update({
        relatorio: { ...plano.relatorio, pautas },
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", plano.id)
      .eq("status", "pronto");
    if (error) throw new Error("Não consegui salvar. Tente de novo.");
    return { ok: true as const };
  });

/** Troca uma pauta por outra gerada na hora, opcionalmente seguindo um pedido. */
export const trocarPauta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planoId: string; indice: number; pedido?: string }) => ({
    ...data,
    pedido: (data.pedido ?? "").trim().slice(0, 300),
  }))
  .handler(async ({ data, context }) => {
    const plano = await planoDoUsuario(context.supabase, data.planoId);
    if (plano.status !== "pronto") throw new Error("Este plano não pode mais ser alterado.");

    const { invocarAgente } = await import("@/lib/agentes.server");
    const resposta = await invocarAgente<{ pauta?: PautaPlano }>(
      "planejador-agent",
      {
        acao: "trocar_pauta",
        plano_id: plano.id,
        indice: data.indice,
        pedido: data.pedido || null,
      },
      { timeoutMs: 90_000 },
    );
    if (!resposta.ok || !resposta.data?.pauta) {
      throw new Error("Não consegui gerar outra opção agora. Tente de novo em instantes.");
    }
    return { pauta: resposta.data.pauta };
  });

/**
 * Aprova o plano: cada pauta mantida vira uma pauta do pipeline, que segue
 * sozinha para roteiro, revisão e aprovação final.
 */
export const aprovarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { planoId: string }) => data)
  .handler(async ({ data, context }) => {
    const plano = await planoDoUsuario(context.supabase, data.planoId);
    if (plano.status === "aprovado") return { pautas: 0, jaAprovado: true as const };
    if (plano.status !== "pronto" || !plano.relatorio) {
      throw new Error("O plano ainda não está pronto para aprovar.");
    }
    if (!plano.perfil_id) throw new Error("Plano sem perfil vinculado. Fale com o suporte.");

    const mantidas = plano.relatorio.pautas.filter((p) => !p.removida);
    const db = await admin();

    const { data: cota } = await db.rpc("limite_disponivel", {
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
    const { data: fechado } = await db
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
    if (!fechado) return { pautas: 0, jaAprovado: true as const };

    // Em ordem de data: o pipeline produz na ordem de criação.
    const ordenadas = [...mantidas].sort((a, b) => a.data.localeCompare(b.data));
    const { error } = await db.from("pautas_geradas").insert(
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
      await db
        .from("planos_semanais")
        .update({ status: "pronto", aprovado_em: null })
        .eq("id", plano.id);
      throw new Error("Não consegui enviar os vídeos para produção. Tente de novo.");
    }
    return { pautas: ordenadas.length, jaAprovado: false as const };
  });
