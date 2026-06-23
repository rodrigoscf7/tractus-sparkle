// Copy: disparado quando uma pauta vira 'em_producao'. Gera roteiro.
import {
  callClaude,
  corsHeaders,
  extractJson,
  formatHistorico,
  getHistoricoDecisoes,
  getServiceClient,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você é o agente de copywriting da Tractus, escrevendo para: {{perfil_nome}}.
Tom obrigatório: direto, assertivo, sem emojis, sem travessão. Português do Brasil.
Diretrizes: {{perfil_diretrizes}}
Pauta: tema={{pauta_tema}}, ângulo={{pauta_angulo}}, formato={{pauta_formato}}
Histórico de roteiros rejeitados (não repita esses padrões): {{historico_roteiros_rejeitados}}
Retorne APENAS um JSON:
{ "gancho": "string", "corpo": "string ou array de slides", "cta": "string",
  "legenda_sugerida": "string" }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await setStatus("copy", "working", "produzindo roteiro");
    const { pauta_id } = await req.json();
    const supabase = getServiceClient();

    const { data: pauta } = await supabase
      .from("pautas_geradas")
      .select("id, perfil_id, tema, angulo, formato_sugerido, perfis:perfis(nome,diretrizes)")
      .eq("id", pauta_id)
      .single();

    const perfil = (pauta as any).perfis;
    const historico = (await getHistoricoDecisoes(pauta!.perfil_id)).filter(
      (h) => h.item_tipo === "roteiro" && h.decisao === "rejeitado",
    );

    const system = SYSTEM
      .replace("{{perfil_nome}}", perfil.nome)
      .replace("{{perfil_diretrizes}}", JSON.stringify(perfil.diretrizes))
      .replace("{{pauta_tema}}", pauta!.tema ?? "")
      .replace("{{pauta_angulo}}", pauta!.angulo ?? "")
      .replace("{{pauta_formato}}", pauta!.formato_sugerido ?? "")
      .replace("{{historico_roteiros_rejeitados}}", formatHistorico(historico));

    const text = await callClaude(system, "Escreva o roteiro agora.", 2500);
    const parsed = extractJson(text);

    await supabase.from("roteiros").insert({
      pauta_id,
      conteudo: parsed,
      status: "pronto",
    });

    await setStatus("copy", "idle", `roteiro pronto para pauta ${pauta_id.slice(0, 8)}`);
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    await setStatus("copy", "error", String(e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
