// Revisor: dispara quando copy + visual terminam. Checa consistência e, se ok,
// move a pauta para 'aguardando_aprovacao'.
import {
  callClaude,
  corsHeaders,
  extractJson,
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

  try {
    await setStatus("revisor", "working", "revisando consistência");
    const { pauta_id } = await req.json();
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

    const text = await callClaude(system, "Faça a revisão agora.", 1500);
    const parsed = extractJson<{
      aprovado_para_revisao_humana: boolean;
      inconsistencias: string[];
      sugestao_ajuste: string | null;
    }>(text);

    if (parsed.aprovado_para_revisao_humana) {
      await supabase
        .from("pautas_geradas")
        .update({ status: "aguardando_aprovacao" })
        .eq("id", pauta_id);
      await setStatus("revisor", "idle", `pauta ${pauta_id.slice(0, 8)} aprovada para humano`);
    } else {
      await setStatus(
        "revisor",
        "waiting",
        `pauta ${pauta_id.slice(0, 8)} com inconsistências: ${parsed.inconsistencias.join("; ").slice(0, 120)}`,
      );
    }

    return new Response(JSON.stringify({ ok: true, ...parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    await setStatus("revisor", "error", String(e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
