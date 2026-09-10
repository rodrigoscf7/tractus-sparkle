import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Disparos de agente feitos pelo cliente.
 *
 * As edge functions só aceitam o segredo interno ou um admin global, então o
 * navegador não pode chamá-las direto. Cada função aqui confirma a posse do
 * recurso usando o client com RLS do próprio usuário (se ele não consegue ler,
 * não é dele) e só então invoca o agente com o segredo do servidor.
 */

/** Gera ou regera o carrossel de uma pauta aprovada da conta do usuário. */
export const gerarCarrossel = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { pautaId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: pauta } = await context.supabase
      .from("pautas_geradas")
      .select("id, status")
      .eq("id", data.pautaId)
      .maybeSingle();

    if (!pauta) throw new Error("Pauta não encontrada nesta conta.");
    if (pauta.status !== "aprovada") {
      throw new Error("O carrossel só é gerado depois que a pauta é aprovada.");
    }

    const { invocarAgente } = await import("@/lib/agentes.server");
    const resposta = await invocarAgente(
      "carrossel-agent",
      { pauta_id: data.pautaId },
      { timeoutMs: 150_000 },
    );

    if (!resposta.ok) throw new Error(resposta.erro ?? "Falha ao gerar carrossel.");
    return { ok: true as const };
  });

/**
 * Coleta sob demanda das referências da conta.
 *
 * Sem isso, a primeira curadoria de um cliente novo só aparece no cron diário
 * das 11:00 UTC. Roda em segundo plano: a resposta volta assim que os workers
 * são disparados, não quando terminam.
 */
export const rodarCuradoriaAgora = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { perfilId?: string } | undefined) => data ?? {})
  .handler(async ({ data, context }) => {
    let query = context.supabase
      .from("perfis_referencia")
      .select("id")
      .eq("ativo", true)
      .limit(5);
    if (data.perfilId) query = query.eq("perfil_id_relacionado", data.perfilId);

    const { data: refs } = await query;
    const ids = (refs ?? []).map((r) => r.id as string);

    if (!ids.length) {
      throw new Error(
        "Nenhum perfil de referência ativo. Adicione um em Perfis para o curador ter onde buscar.",
      );
    }

    const { dispararCuradoria } = await import("@/lib/agentes.server");
    dispararCuradoria(ids);

    return { disparados: ids.length };
  });
