// Visual: gera briefing visual a partir da pauta + identidade visual do perfil.
import {
  callClaude,
  corsHeaders,
  extractJson,
  formatHistorico,
  getHistoricoDecisoes,
  getServiceClient,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você é o agente de direção visual da Tractus para: {{perfil_nome}}.
Identidade visual vigente (extraída do brandbook): {{perfil_identidade_visual}}
Roteiro/pauta de referência: {{roteiro_completo}}
Histórico de artes rejeitadas (não repita): {{historico_artes_rejeitadas}}
Seja específico em composição — evite termos vagos como "moderno" sem detalhar paleta,
tipografia e hierarquia.
Retorne APENAS um JSON:
{ "estilo_geral": "string", "paleta_cores": ["hex"], "estrutura_por_slide_ou_frame": ["string"],
  "tipografia": "string", "observacoes_producao": "string" }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await setStatus("visual", "working", "produzindo briefing visual");
    const { pauta_id } = await req.json();
    const supabase = getServiceClient();

    const { data: pauta } = await supabase
      .from("pautas_geradas")
      .select("id, perfil_id, tema, angulo, formato_sugerido, perfis:perfis(nome,identidade_visual)")
      .eq("id", pauta_id)
      .single();

    const perfil = (pauta as any).perfis;
    const historico = (await getHistoricoDecisoes(pauta!.perfil_id)).filter(
      (h) => h.item_tipo === "arte" && h.decisao === "rejeitado",
    );

    const system = SYSTEM
      .replace("{{perfil_nome}}", perfil.nome)
      .replace("{{perfil_identidade_visual}}", JSON.stringify(perfil.identidade_visual))
      .replace(
        "{{roteiro_completo}}",
        `tema=${pauta!.tema}; ângulo=${pauta!.angulo}; formato=${pauta!.formato_sugerido}`,
      )
      .replace("{{historico_artes_rejeitadas}}", formatHistorico(historico));

    const text = await callClaude(system, "Produza o briefing visual.", 2000);
    const parsed = extractJson(text);

    await supabase.from("artes").insert({
      pauta_id,
      briefing: parsed,
      status: "pronto",
    });

    await setStatus("visual", "idle", `arte pronta para pauta ${pauta_id.slice(0, 8)}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    await setStatus("visual", "error", String(e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
