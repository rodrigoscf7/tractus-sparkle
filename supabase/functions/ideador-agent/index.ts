// Ideador: roda de forma serializada por perfil para evitar estouro de limite.
// Pode receber perfil_id/perfil_referencia_id ou rodar sem payload e encontrar
// perfis com curadoria recente ainda sem pauta.
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
Histórico (padrão aceito/rejeitado): {{historico_decisoes_formatado}}
Curadoria disponível (score >= 7): {{lista_curadoria_filtrada}}
Pautas recentes que NÃO devem ser repetidas: {{pautas_recentes}}

REGRAS DE PAUTA:
- Formato fixo e obrigatório: "Reel falado" (vídeo de 30-60s, pessoa falando à câmera). Nunca sugira carrossel, slide ou estático.
- Ângulo deve ser uma TESE DE POSICIONAMENTO em 1 frase (opinião defensável, não descrição genérica).
- Não repita ângulo já rejeitado no histórico.
- Priorize ângulos conectados a casos reais de implementação de IA da Tractus.

Retorne APENAS JSON:
{ "pautas": [{ "tema": "string curto",
   "angulo": "tese de posicionamento em 1 frase",
   "formato_sugerido": "Reel falado",
   "origem_curadoria_id": "string ou null",
   "justificativa": "1 frase" }] }`;

const FALLBACK_SYSTEM = `Você é o agente de ideação de pautas da Tractus.
Perfil: {{perfil_nome}} ({{perfil_tipo}})
Diretrizes: {{perfil_diretrizes}}
Histórico (padrão aceito/rejeitado): {{historico_decisoes_formatado}}
Pautas recentes que NÃO devem ser repetidas: {{pautas_recentes}}

Não há curadoria nova aproveitável hoje. Gere 1 pauta evergreen de posicionamento, baseada nas dores, crenças e autoridade do perfil.

REGRAS:
- Formato fixo e obrigatório: "Reel falado" (vídeo de 30-60s, pessoa falando à câmera).
- Ângulo deve ser uma TESE DE POSICIONAMENTO em 1 frase, não uma dica genérica.
- Não repita tema, gancho ou estrutura de pautas recentes.
- Para perfis de advogados, priorize autoridade, segurança, decisão e clareza para o cliente final.

Retorne APENAS JSON:
{ "pautas": [{ "tema": "string curto",
   "angulo": "tese de posicionamento em 1 frase",
   "formato_sugerido": "Reel falado",
   "origem_curadoria_id": null,
   "justificativa": "pauta evergreen por falta de curadoria nova" }] }`;

type SupabaseClient = ReturnType<typeof getServiceClient>;

type IdeadorPayload = {
  perfil_id?: string;
  perfil_referencia_id?: string;
};

type PautaGerada = {
  tema: string;
  angulo: string;
  formato_sugerido: string;
  origem_curadoria_id: string | null;
  justificativa: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await setStatus("ideador", "working", "gerando pautas");
    const payload = (await req.json().catch(() => ({}))) as IdeadorPayload;
    const supabase = getServiceClient();
    const perfilIds = await resolvePerfilIds(supabase, payload);

    let total = 0;
    for (const perfilId of perfilIds) {
      total += await gerarPautasDoPerfil(supabase, perfilId);
    }

    await setStatus("ideador", "idle", `${total} pautas geradas`);
    return new Response(JSON.stringify({ ok: true, count: total, profiles: perfilIds.length }), {
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

async function resolvePerfilIds(supabase: SupabaseClient, payload: IdeadorPayload) {
  if (payload.perfil_id) return [payload.perfil_id];

  if (payload.perfil_referencia_id) {
    const { data: ref } = await supabase
      .from("perfis_referencia")
      .select("perfil_id_relacionado")
      .eq("id", payload.perfil_referencia_id)
      .maybeSingle();
    return ref?.perfil_id_relacionado ? [ref.perfil_id_relacionado] : [];
  }

  const curadoriaIdsComPauta = await getCuradoriaIdsComPauta(supabase);
  let curadoriaQuery = supabase
    .from("conteudos_curados")
    .select("id, perfil_referencia_id")
    .gte("score_curadoria", 7)
    .not("perfil_referencia_id", "is", null)
    .order("capturado_em", { ascending: false })
    .limit(100);

  if (curadoriaIdsComPauta.length) {
    curadoriaQuery = curadoriaQuery.not("id", "in", `(${curadoriaIdsComPauta.join(",")})`);
  }

  const { data: curadoria } = await curadoriaQuery;
  const refIds = Array.from(new Set((curadoria ?? []).map((row) => row.perfil_referencia_id).filter(Boolean)));
  if (!refIds.length) return getPerfisComReferenciaAtiva(supabase);

  const { data: refs } = await supabase
    .from("perfis_referencia")
    .select("perfil_id_relacionado")
    .in("id", refIds);

  return Array.from(new Set((refs ?? []).map((ref) => ref.perfil_id_relacionado).filter(Boolean)));
}

async function gerarPautasDoPerfil(supabase: SupabaseClient, perfilId: string) {
  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, tipo, diretrizes")
    .eq("id", perfilId)
    .single();

  if (!perfil) return 0;

  const { data: refsDoPerfil } = await supabase
    .from("perfis_referencia")
    .select("id")
    .eq("perfil_id_relacionado", perfilId);

  const refIds = (refsDoPerfil ?? []).map((r) => r.id);
  if (!refIds.length) return 0;

  const curadoriaIdsComPauta = await getCuradoriaIdsComPauta(supabase);
  let curadoriaQuery = supabase
    .from("conteudos_curados")
    .select("id, tema, gancho, score_curadoria, formato")
    .gte("score_curadoria", 7)
    .in("perfil_referencia_id", refIds)
    .order("capturado_em", { ascending: false })
    .limit(5);

  if (curadoriaIdsComPauta.length) {
    curadoriaQuery = curadoriaQuery.not("id", "in", `(${curadoriaIdsComPauta.join(",")})`);
  }

  const { data: curadoria } = await curadoriaQuery;

  const historico = await getHistoricoDecisoes(perfilId);
  const pautasRecentes = await getPautasRecentes(supabase, perfilId);
  const hasCuradoria = Boolean(curadoria?.length);
  const systemTemplate = hasCuradoria ? SYSTEM : FALLBACK_SYSTEM;
  const system = systemTemplate
    .replace("{{perfil_nome}}", perfil.nome)
    .replace("{{perfil_tipo}}", perfil.tipo)
    .replace("{{perfil_diretrizes}}", JSON.stringify(perfil.diretrizes))
    .replace("{{historico_decisoes_formatado}}", formatHistorico(historico))
    .replace("{{lista_curadoria_filtrada}}", JSON.stringify(curadoria ?? []))
    .replace("{{pautas_recentes}}", JSON.stringify(pautasRecentes));

  const text = await callClaude(
    system,
    hasCuradoria ? "Gere até 3 pautas novas agora." : "Gere 1 pauta evergreen nova agora.",
    hasCuradoria ? 1200 : 700,
  );
  const parsed = extractJson<{ pautas: PautaGerada[] }>(text);
  const curadoriaIdsPermitidos = new Set((curadoria ?? []).map((item) => item.id));

  let inserted = 0;
  for (const p of parsed.pautas ?? []) {
    const origemId = p.origem_curadoria_id && curadoriaIdsPermitidos.has(p.origem_curadoria_id)
      ? p.origem_curadoria_id
      : null;

    const { error } = await supabase.from("pautas_geradas").insert({
      perfil_id: perfilId,
      origem_curadoria_id: origemId,
      tema: p.tema,
      angulo: p.angulo,
      formato_sugerido: "Reel falado",
      status: "gerada",
    });
    if (!error) inserted++;
  }

  return inserted;
}

async function getPerfisComReferenciaAtiva(supabase: SupabaseClient) {
  const { data: refs } = await supabase
    .from("perfis_referencia")
    .select("perfil_id_relacionado")
    .eq("ativo", true)
    .not("perfil_id_relacionado", "is", null);

  return Array.from(new Set((refs ?? []).map((ref) => ref.perfil_id_relacionado).filter(Boolean)));
}

async function getPautasRecentes(supabase: SupabaseClient, perfilId: string) {
  const { data } = await supabase
    .from("pautas_geradas")
    .select("tema, angulo, criado_em")
    .eq("perfil_id", perfilId)
    .order("criado_em", { ascending: false })
    .limit(12);

  return (data ?? []).map((p) => ({ tema: p.tema, angulo: p.angulo }));
}

async function getCuradoriaIdsComPauta(supabase: SupabaseClient) {
  const { data } = await supabase
    .from("pautas_geradas")
    .select("origem_curadoria_id")
    .not("origem_curadoria_id", "is", null)
    .limit(100);
  return (data ?? []).map((row) => row.origem_curadoria_id).filter(Boolean);
}
