import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { temRoteiroEscrito } from "@/lib/roteiro";

/**
 * Disparos de agente feitos pelo cliente.
 *
 * As edge functions só aceitam o segredo interno ou um admin global, então o
 * navegador não pode chamá-las direto. Cada função aqui confirma a posse do
 * recurso usando o client com RLS do próprio usuário (se ele não consegue ler,
 * não é dele) e só então invoca o agente com o segredo do servidor.
 */

/** Gera ou regera o carrossel de uma pauta da conta do usuário, assim que o roteiro estiver escrito. */
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
    if (!temRoteiroEscrito(pauta.status)) {
      throw new Error(
        "O carrossel sai assim que o roteiro estiver escrito. Ele ainda está sendo escrito.",
      );
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
 * Gera por IA a imagem da capa de um carrossel da conta do usuário. A leitura
 * passa pela RLS: carrossel de outra conta não é encontrado. Cota e custo
 * ficam no imagem-agent.
 */
export const gerarImagemCapa = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { carrosselId: string; ideia?: string }) => ({
    carrosselId: data.carrosselId,
    ideia: (data.ideia ?? "").slice(0, 300),
  }))
  .handler(async ({ data, context }) => {
    const { data: carrossel } = await context.supabase
      .from("carrosseis")
      .select("id, status")
      .eq("id", data.carrosselId)
      .maybeSingle();

    if (!carrossel) throw new Error("Carrossel não encontrado nesta conta.");
    if (carrossel.status !== "pronto") {
      throw new Error("Gere o carrossel antes de criar a imagem da capa.");
    }

    const { invocarAgente } = await import("@/lib/agentes.server");
    const resposta = await invocarAgente<{ caminho?: string }>(
      "imagem-agent",
      { carrossel_id: data.carrosselId, ideia: data.ideia },
      { timeoutMs: 120_000 },
    );

    if (!resposta.ok) throw new Error(resposta.erro ?? "Não consegui gerar a imagem.");
    return { ok: true as const, caminho: resposta.data?.caminho ?? null };
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
    let query = context.supabase.from("perfis_referencia").select("id").eq("ativo", true).limit(5);
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
