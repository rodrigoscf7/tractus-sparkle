// Revisor: dispara quando copy + visual terminam. Checa consistência e sempre
// move a pauta para 'aguardando_aprovacao' para a decisão humana final.
import {
  callClaude,
  corsHeaders,
  extractJson,
  formatAgentError,
  getServiceClient,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você é o agente revisor de consistência de marca da Tractus.
Perfil: {{perfil_nome}}. Diretrizes: {{perfil_diretrizes}}
Conteúdo final a revisar: {{conteudo_completo}}
Verifique: tom de voz, ausência de emojis/travessões, gancho não repetido, coerência
texto-visual.
Retorne APENAS um JSON:
{ "aprovado_para_revisao_humana": true/false, "inconsistencias": ["string"],
  "sugestao_ajuste": "string ou null" }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  let pautaId: string | null = null;

  try {
    await setStatus("revisor", "working", "revisando consistência");
    const { pauta_id } = await req.json();
    pautaId = pauta_id;
    const supabase = getServiceClient();

    const { data: pauta } = await supabase
      .from("pautas_geradas")
      .select("id, perfil_id, tema, angulo, perfis:perfis(nome,diretrizes)")
      .eq("id", pauta_id)
      .single();

    const { data: roteiro } = await supabase
      .from("roteiros")
      .select("conteudo")
      .eq("pauta_id", pauta_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: arte } = await supabase
      .from("artes")
      .select("briefing")
      .eq("pauta_id", pauta_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    const perfil = (pauta as any).perfis;
    const conteudoCompleto = {
      pauta: { tema: pauta!.tema, angulo: pauta!.angulo },
      roteiro: roteiro?.conteudo,
      briefing_visual: arte?.briefing,
    };

    const system = SYSTEM
      .replace("{{perfil_nome}}", perfil.nome)
      .replace("{{perfil_diretrizes}}", JSON.stringify(perfil.diretrizes))
      .replace("{{conteudo_completo}}", JSON.stringify(conteudoCompleto));

    const text = await callClaude(
      `${system}\nLimite a resposta a no máximo 3 inconsistências curtas. Não use markdown nem bloco de código.`,
      "Faça a revisão agora.",
      900,
    );
    const parsed = extractJson<{
      aprovado_para_revisao_humana: boolean;
      inconsistencias: string[];
      sugestao_ajuste: string | null;
    }>(text);

    await supabase
      .from("pautas_geradas")
      .update({ status: "aguardando_aprovacao" })
      .eq("id", pauta_id);

    const inconsistencias = parsed.inconsistencias?.filter(Boolean) ?? [];
    const detalhes = inconsistencias.length
      ? ` com observações: ${inconsistencias.join("; ").slice(0, 120)}`
      : " sem inconsistências críticas";
    await setStatus(
      "revisor",
      "idle",
      `pauta ${pauta_id.slice(0, 8)} enviada para aprovação humana${detalhes}`,
    );

    return new Response(JSON.stringify({ ok: true, ...parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    if (pautaId && String(e).includes("No JSON found")) {
      const supabase = getServiceClient();
      await supabase
        .from("pautas_geradas")
        .update({ status: "aguardando_aprovacao" })
        .eq("id", pautaId);
      await setStatus(
        "revisor",
        "idle",
        `pauta ${pautaId.slice(0, 8)} enviada para aprovação humana; revisão automática veio sem formato válido`,
      );
      return new Response(JSON.stringify({ ok: true, fallback: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    await setStatus("revisor", "error", formatAgentError(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
