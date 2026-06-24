// Ideador: disparado por trigger quando um conteúdo curado entra com score >= 7.
// Pega o perfil dono da referência, lê histórico de decisões + curadoria recente,
// gera N pautas e insere em pautas_geradas (status = 'gerada').
import {
  callClaude,
  corsHeaders,
  extractJson,
  formatAgentError,
  formatHistorico,
  getHistoricoDecisoes,
  getServiceClient,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você é o agente de ideação de pautas da Tractus.
Perfil: {{perfil_nome}} ({{perfil_tipo}})
Diretrizes: {{perfil_diretrizes}}
Histórico de decisões deste perfil (use como referência confiável de padrão aceito/rejeitado):
{{historico_decisoes_formatado}}
Conteúdos curados disponíveis (score >= 7): {{lista_curadoria_filtrada}}
Gere pautas novas, sem repetir ângulo já rejeitado por "tema" ou "gancho" no histórico.
Priorize ângulos conectados a casos reais de implementação de IA da Tractus.
Retorne APENAS um JSON:
{ "pautas": [{ "tema": "string", "angulo": "string", "formato_sugerido": "string",
  "origem_curadoria_id": "string ou null", "justificativa": "string" }] }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await setStatus("ideador", "working", "gerando pautas");
    const { perfil_referencia_id, perfil_id } = await req.json();
    const supabase = getServiceClient();

    let perfilId = perfil_id as string | undefined;
    if (!perfilId && perfil_referencia_id) {
      const { data: ref } = await supabase
        .from("perfis_referencia")
        .select("perfil_id_relacionado")
        .eq("id", perfil_referencia_id)
        .maybeSingle();
      perfilId = ref?.perfil_id_relacionado;
    }
    if (!perfilId) throw new Error("perfil_id_relacionado não encontrado");

    const { data: perfil } = await supabase
      .from("perfis")
      .select("id, nome, tipo, diretrizes")
      .eq("id", perfilId)
      .single();

    const { data: refsDoPerfil } = await supabase
      .from("perfis_referencia")
      .select("id")
      .eq("perfil_id_relacionado", perfilId);

    const refIds = (refsDoPerfil ?? []).map((r) => r.id);
    const curadoriaIdsComPauta = await getCuradoriaIdsComPauta(supabase);
    let curadoriaQuery = supabase
      .from("conteudos_curados")
      .select("id, tema, gancho, score_curadoria, formato")
      .gte("score_curadoria", 7)
      .order("capturado_em", { ascending: false })
      .limit(5);

    if (refIds.length) curadoriaQuery = curadoriaQuery.in("perfil_referencia_id", refIds);
    if (curadoriaIdsComPauta.length) {
      curadoriaQuery = curadoriaQuery.not("id", "in", `(${curadoriaIdsComPauta.join(",")})`);
    }

    const { data: curadoria } = await curadoriaQuery;

    const historico = await getHistoricoDecisoes(perfilId);

    const system = SYSTEM
      .replace("{{perfil_nome}}", perfil!.nome)
      .replace("{{perfil_tipo}}", perfil!.tipo)
      .replace("{{perfil_diretrizes}}", JSON.stringify(perfil!.diretrizes))
      .replace("{{historico_decisoes_formatado}}", formatHistorico(historico))
      .replace("{{lista_curadoria_filtrada}}", JSON.stringify(curadoria ?? []));

    const text = await callClaude(system, "Gere até 3 pautas novas agora.", 1200);
    const parsed = extractJson<{
      pautas: Array<{
        tema: string;
        angulo: string;
        formato_sugerido: string;
        origem_curadoria_id: string | null;
        justificativa: string;
      }>;
    }>(text);

    for (const p of parsed.pautas ?? []) {
      await supabase.from("pautas_geradas").insert({
        perfil_id: perfilId,
        origem_curadoria_id: p.origem_curadoria_id,
        tema: p.tema,
        angulo: p.angulo,
        formato_sugerido: p.formato_sugerido,
        status: "gerada",
      });
    }

    await setStatus("ideador", "idle", `${parsed.pautas?.length ?? 0} pautas geradas`);
    return new Response(JSON.stringify({ ok: true, count: parsed.pautas?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    await setStatus("ideador", "error", formatAgentError(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function getCuradoriaIdsComPauta(supabase: ReturnType<typeof getServiceClient>) {
  const { data } = await supabase
    .from("pautas_geradas")
    .select("origem_curadoria_id")
    .not("origem_curadoria_id", "is", null)
    .limit(100);
  return (data ?? []).map((row) => row.origem_curadoria_id).filter(Boolean);
}
