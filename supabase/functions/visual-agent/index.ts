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

const SYSTEM = `Você dirige a LINGUAGEM VISUAL de um Reel falado para: {{perfil_nome}}.
É uma pessoa à câmera (30-60s). Cenário é secundário — o que importa é COMO o conteúdo aparece: formato, tom, expressão e o elemento visual que ancora o gancho.

Identidade visual do perfil (referência de estilo, não repetir literal): {{perfil_identidade_visual}}
Pauta: {{pauta_resumo}}
Roteiro: {{roteiro_texto}}
Histórico de direções rejeitadas: {{historico_artes_rejeitadas}}

Analise o gancho e a tese do roteiro. Sua direção deve traduzir a MENSAGEM em decisões visuais concretas — não descrever set. Nada de "cenário clean, luz natural, roupa neutra" genérico. Se o cenário for irrelevante, escreva "qualquer ambiente controlado" e passe adiante.

Retorne APENAS um JSON compacto:
{ "formato": "estrutura visual do vídeo — corte seco, plano-sequência, jump cuts, POV, talking head puro etc — o que serve à mensagem, em 1 frase",
  "tom_visual": "sensação que a imagem precisa transmitir, coerente com o gancho (ex: tensão contida, provocação leve, autoridade calma), em 1 frase",
  "expressao_e_linguagem_corporal": "como a pessoa se posiciona e reage nos momentos-chave do roteiro, em 1-2 frases práticas",
  "elemento_visual_do_gancho": "o recurso que ANCORA o gancho nos primeiros 3s (texto na tela, objeto na mão, gesto específico, close inesperado, corte abrupto), em 1 frase concreta ligada ao gancho do roteiro",
  "texto_em_tela": "frase curta (até 8 palavras) sobreposta reforçando o gancho",
  "reforco_no_meio": "1 apoio visual no meio do vídeo que sustenta a tese (corte, texto, gesto), ou string vazia",
  "cenario_minimo": "só o essencial: onde faz sentido gravar isso, em 1 frase curta" }`;

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
