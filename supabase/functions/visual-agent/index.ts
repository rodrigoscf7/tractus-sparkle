// Visual: direção de gravação enxuta para Reel falado.
import {
  callClaude,
  corsHeaders,
  extractJson,
  formatHistorico,
  getHistoricoDecisoes,
  getServiceClient,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você dirige a GRAVAÇÃO de Reels falados para: {{perfil_nome}}.
O conteúdo é uma pessoa falando à câmera (30-60s). NÃO é carrossel, NÃO é arte estática.
Identidade visual do perfil (use como referência, não repita inteira): {{perfil_identidade_visual}}
Pauta: {{pauta_resumo}}
Histórico de direções rejeitadas: {{historico_artes_rejeitadas}}

Seja MUITO enxuto. Cada campo abaixo é uma frase curta e prática, escrita para quem vai gravar amanhã. Nada de jargão técnico de produção, nada de parâmetros de câmera, nada de "moderno/clean/minimalista" sem dizer o que é.

Retorne APENAS um JSON compacto:
{ "cenario": "onde gravar, em 1 frase",
  "enquadramento": "plano e altura da câmera, em 1 frase",
  "figurino_e_postura": "como a pessoa deve aparecer, em 1 frase",
  "texto_em_tela": "frase curta (até 8 palavras) que aparece sobreposta no início do vídeo",
  "legenda_visual_de_apoio": "1 frase opcional que reforça o gancho no meio do vídeo, ou string vazia",
  "clima": "uma palavra ou expressão curta que descreve a sensação (ex: confidencial, urgente, sereno)" }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await setStatus("visual", "working", "produzindo direção de gravação");
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
      .replace("{{perfil_identidade_visual}}", JSON.stringify(perfil.identidade_visual).slice(0, 800))
      .replace(
        "{{pauta_resumo}}",
        `tema=${pauta!.tema}; ângulo=${pauta!.angulo}`,
      )
      .replace("{{historico_artes_rejeitadas}}", formatHistorico(historico));

    const text = await callClaude(system, "Direção de gravação em JSON compacto.", 600);
    const parsed = extractJson(text);

    await supabase.from("artes").insert({
      pauta_id,
      briefing: parsed,
      status: "pronto",
    });

    await setStatus("visual", "idle", `direção pronta para pauta ${pauta_id.slice(0, 8)}`);
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
