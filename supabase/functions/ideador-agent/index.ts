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
  conteudo_id?: string;
};

type PautaGerada = {
  tema: string;
  angulo: string;
  formato_sugerido: string;
  origem_curadoria_id: string | null;
  justificativa: string;
};

const FOCO_SYSTEM = `Você é o agente de ideação de pautas da Tractus.
Perfil: {{perfil_nome}} ({{perfil_tipo}})
Diretrizes: {{perfil_diretrizes}}
Histórico (padrão aceito/rejeitado): {{historico_decisoes_formatado}}
Pautas recentes que NÃO devem ser repetidas: {{pautas_recentes}}

CURADORIA-ALVO (transformar em pauta):
{{curadoria_alvo}}

Sua tarefa: transformar essa curadoria específica em UMA pauta acionável para o perfil.
Adapte o tom, a profundidade e o contexto ao perfil — não é para copiar o post original.
Se o ângulo já foi coberto por uma pauta recente, gere uma variação com ângulo distinto (não retorne vazio).

REGRAS:
- Formato fixo: "Reel falado" (30-60s, pessoa à câmera).
- Ângulo = TESE DE POSICIONAMENTO em 1 frase (opinião defensável, não descrição).
- origem_curadoria_id DEVE ser o id da curadoria-alvo.

Retorne APENAS JSON:
{ "pautas": [{ "tema": "string curto",
   "angulo": "tese de posicionamento em 1 frase",
   "formato_sugerido": "Reel falado",
   "origem_curadoria_id": "id da curadoria-alvo",
   "justificativa": "1 frase" }] }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await setStatus("ideador", "working", "gerando pautas");
    const payload = (await req.json().catch(() => ({}))) as IdeadorPayload;
    const supabase = getServiceClient();

    // Modo foco: veio do trigger com uma curadoria específica → 1 pauta pra ela.
    if (payload.conteudo_id) {
      const inserted = await gerarPautaFocada(supabase, payload.conteudo_id);
      await setStatus("ideador", "idle", `foco: ${inserted} pauta(s) para curadoria ${payload.conteudo_id.slice(0, 8)}`);
      return new Response(JSON.stringify({ ok: true, count: inserted, mode: "foco" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Modo agendado: só ideia a partir de curadorias APROVADAS POR HUMANO que
    // ainda não têm pauta. Sem aprovação, nada é gerado (economia de tokens).
    const pendentes = await getCuradoriasAprovadasSemPauta(supabase, 5);
    let total = 0;
    for (const id of pendentes) {
      total += await gerarPautaFocada(supabase, id);
    }

    await setStatus(
      "ideador",
      "idle",
      pendentes.length
        ? `${total} pauta(s) geradas de ${pendentes.length} curadoria(s) aprovada(s)`
        : "nenhuma curadoria aprovada pendente — nada gerado",
    );
    return new Response(JSON.stringify({ ok: true, count: total, curadorias: pendentes.length }), {
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

async function gerarPautaFocada(supabase: SupabaseClient, conteudoId: string) {
  // Se já tem pauta pra essa curadoria, não gera de novo.
  const { data: existente } = await supabase
    .from("pautas_geradas")
    .select("id")
    .eq("origem_curadoria_id", conteudoId)
    .limit(1)
    .maybeSingle();
  if (existente) return 0;

  const { data: curadoria } = await supabase
    .from("conteudos_curados")
    .select("id, tema, gancho, score_curadoria, formato, texto_original, likes, comentarios, views, perfil_referencia_id")
    .eq("id", conteudoId)
    .maybeSingle();
  if (!curadoria) return 0;

  const { data: ref } = await supabase
    .from("perfis_referencia")
    .select("perfil_id_relacionado")
    .eq("id", curadoria.perfil_referencia_id)
    .maybeSingle();
  const perfilId = ref?.perfil_id_relacionado;
  if (!perfilId) return 0;

  const { data: perfil } = await supabase
    .from("perfis")
    .select("id, nome, tipo, diretrizes")
    .eq("id", perfilId)
    .single();
  if (!perfil) return 0;

  const historico = await getHistoricoDecisoes(perfilId);
  const pautasRecentes = await getPautasRecentes(supabase, perfilId);

  const system = FOCO_SYSTEM
    .replace("{{perfil_nome}}", perfil.nome)
    .replace("{{perfil_tipo}}", perfil.tipo)
    .replace("{{perfil_diretrizes}}", JSON.stringify(perfil.diretrizes))
    .replace("{{historico_decisoes_formatado}}", formatHistorico(historico))
    .replace("{{pautas_recentes}}", JSON.stringify(pautasRecentes))
    .replace("{{curadoria_alvo}}", JSON.stringify({
      id: curadoria.id,
      tema: curadoria.tema,
      gancho: curadoria.gancho,
      score: curadoria.score_curadoria,
      formato: curadoria.formato,
      metricas: { likes: curadoria.likes, comentarios: curadoria.comentarios, views: curadoria.views },
      trecho: (curadoria.texto_original ?? "").slice(0, 400),
    }));

  const text = await callClaude(system, "Gere 1 pauta focada na curadoria-alvo agora.", 500);
  const parsed = extractJson<{ pautas: PautaGerada[] }>(text);
  const p = parsed.pautas?.[0];
  if (!p) return 0;

  const { error } = await supabase.from("pautas_geradas").insert({
    perfil_id: perfilId,
    origem_curadoria_id: conteudoId,
    tema: p.tema,
    angulo: p.angulo,
    formato_sugerido: "Reel falado",
    status: "gerada",
  });
  return error ? 0 : 1;
}



async function getCuradoriasAprovadasSemPauta(supabase: SupabaseClient, limite: number) {
  const comPauta = await getCuradoriaIdsComPauta(supabase);
  let q = supabase
    .from("conteudos_curados")
    .select("id")
    .eq("aprovacao_humana", "aprovado")
    .not("perfil_referencia_id", "is", null)
    .order("decidido_em", { ascending: true })
    .limit(limite);
  if (comPauta.length) q = q.not("id", "in", `(${comPauta.join(",")})`);
  const { data } = await q;
  return (data ?? []).map((row) => row.id as string);
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
