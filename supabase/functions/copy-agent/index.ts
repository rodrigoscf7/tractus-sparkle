// Copy: disparado quando uma pauta vira 'em_producao'. Gera roteiro falado de Reel.
import {
  callClaude,
  corsHeaders,
  extractJson,
  formatHistorico,
  getHistoricoDecisoes,
  getServiceClient,
  requireAgentAuth,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você escreve roteiros de REELS FALADOS de posicionamento para: {{perfil_nome}}.
Formato fixo: vídeo de 30 a 60 segundos, uma pessoa falando à câmera. NÃO é carrossel, NÃO é slide.
Tom: direto, assertivo, primeira pessoa, português do Brasil. Sem emoji, sem travessão, sem hashtag no meio do texto.
Diretrizes do perfil: {{perfil_diretrizes}}
Pauta: tema={{pauta_tema}} | ângulo={{pauta_angulo}}
Roteiros rejeitados (não repita o padrão): {{historico_roteiros_rejeitados}}

Estruture o discurso em 3 blocos curtos, prontos pra gravar lendo:
1. gancho_falado: 1 frase de até 15 palavras, provocativa, dita nos 3 primeiros segundos.
2. desenvolvimento_falado: 3 a 5 frases curtas, conectadas, defendendo UMA tese de posicionamento. Sem listas, sem "primeiro/segundo/terceiro", sem slides.
3. cta_falado: 1 frase fechando com convite claro (comentar, salvar, chamar no direct, etc.).

Retorne APENAS um JSON compacto:
{ "gancho_falado": "string",
  "desenvolvimento_falado": "string (parágrafo único, frases curtas separadas por ponto)",
  "cta_falado": "string",
  "legenda_sugerida": "string curta de até 280 caracteres, sem emoji" }`;

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
      .replace("{{historico_roteiros_rejeitados}}", formatHistorico(historico));

    const text = await callClaude(system, "Escreva o roteiro falado agora. JSON apenas.", 900);
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
