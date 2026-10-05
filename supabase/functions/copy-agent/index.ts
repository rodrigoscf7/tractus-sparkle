// Copy: disparado quando uma pauta vira 'em_producao'. Gera roteiro falado de Reel.
import {
  callModelo,
  corsHeaders,
  extractJson,
  formatHistorico,
  formatRestricoes,
  getHistoricoDecisoes,
  getServiceClient,
  limiteDisponivel,
  requireAgentAuth,
  setCustoContexto,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você escreve roteiros de REELS FALADOS de posicionamento para: {{perfil_nome}}.
Formato fixo: vídeo de 30 a 60 segundos, uma pessoa falando à câmera. NÃO é carrossel, NÃO é slide.
Tom: direto, assertivo, primeira pessoa, português do Brasil. Sem emoji, sem travessão, sem hashtag no meio do texto.
Diretrizes do perfil: {{perfil_diretrizes}}
CTA padrão do perfil (âncora obrigatória): {{cta_padrao}}
Pauta: tema={{pauta_tema}} | ângulo={{pauta_angulo}}
{{modelo_viral}}
Roteiros rejeitados (não repita o padrão): {{historico_roteiros_rejeitados}}

REGRAS INEGOCIÁVEIS DESTE PERFIL
{{restricoes_perfil}}

Estruture o discurso em 3 blocos, prontos pra gravar lendo:
1. gancho_falado: 1 frase de até 20 palavras, provocativa, dita nos 3 primeiros segundos.
2. desenvolvimento_falado: 5 a 8 frases curtas, conectadas, defendendo UMA tese de posicionamento. Sem listas, sem "primeiro/segundo/terceiro", sem slides.
3. cta_falado: 1 ou 2 frases fechando com convite claro. Se houver CTA padrão do perfil, ela é a base:
   mantenha a MESMA intenção e o MESMO canal de resposta, podendo ajustar as palavras ao tema.
   Se a CTA padrão for "nenhuma", escolha você a melhor CTA.

TAMANHO E PROFUNDIDADE (o que separa roteiro de esboço):
- Os três blocos somados têm de 110 a 150 palavras. É o que cabe em 30 a 50 segundos de fala.
- O desenvolvimento precisa entregar substância: um mecanismo, uma consequência concreta ou um exemplo real. Frase que serviria para qualquer profissão não entra.
- Leia mentalmente em voz alta antes de devolver. Se travar na leitura, reescreva.

REPETIÇÃO MECÂNICA (erro mais comum, proibido):
- NÃO fique repetindo o nome do nicho ou da área dentro das frases. Escrever "em mentoria para advogados que muda o resultado" é erro de concordância e denuncia preenchimento automático. A especificidade vem do conteúdo, não de citar o nome do nicho.
- NÃO use descrição de público escrita em linguagem de briefing como sujeito de frase. Entenda com quem se fala e escreva com palavras suas, faladas.

Retorne APENAS um JSON compacto:
{ "gancho_falado": "string",
  "desenvolvimento_falado": "string (parágrafo único, frases curtas separadas por ponto)",
  "cta_falado": "string",
  "legenda_sugerida": "string curta de até 280 caracteres, sem emoji" }`;

/**
 * Pauta nascida do plano semanal: traz o gancho e a estrutura modelados no
 * padrão de um viral analisado. O roteiro parte deles em vez de partir do zero.
 */
function modeloViral(pauta: { gancho_modelo?: string | null; estrutura_modelo?: unknown }): string {
  const estrutura = Array.isArray(pauta.estrutura_modelo) ? pauta.estrutura_modelo.map(String) : [];
  if (!pauta.gancho_modelo && !estrutura.length) return "";
  return `
MODELO DESTA PAUTA (tirado de um post que performou muito acima do normal no nicho):
- Gancho sugerido: ${pauta.gancho_modelo ?? "(livre)"}
- Estrutura que funcionou: ${estrutura.join(" → ") || "(livre)"}
Siga o mecanismo e a ordem dos blocos. Pode ajustar as palavras do gancho para soar como ele, sem perder a força.`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  try {
    await setStatus("copy", "working", "produzindo roteiro");
    const { pauta_id } = await req.json();
    const supabase = getServiceClient();

    const { data: pauta } = await supabase
      .from("pautas_geradas")
      .select(
        "id, perfil_id, tema, angulo, formato_sugerido, conta_id, gancho_modelo, estrutura_modelo, perfis:perfis(nome,diretrizes,cta_padrao,conta_id)",
      )
      .eq("id", pauta_id)
      .single();

    const perfil = (pauta as any).perfis;

    // Cota do plano validada no servidor antes de gastar tokens.
    const cota = await limiteDisponivel(
      (pauta as any)?.conta_id ?? perfil?.conta_id,
      "roteiro",
    );
    if (!cota.permitido) {
      await setStatus("copy", "idle", `limite de roteiros: ${cota.motivo}`);
      return new Response(JSON.stringify({ ok: false, limite: cota.motivo }), {
        status: 402,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const historico = (await getHistoricoDecisoes(pauta!.perfil_id)).filter(
      (h) => h.item_tipo === "roteiro" && h.decisao === "rejeitado",
    );

    const system = SYSTEM
      .replace("{{perfil_nome}}", perfil.nome)
      .replace("{{perfil_diretrizes}}", JSON.stringify(perfil.diretrizes))
      .replace("{{cta_padrao}}", String(perfil.cta_padrao ?? "").trim() || "nenhuma")
      .replace("{{pauta_tema}}", pauta!.tema ?? "")
      .replace("{{pauta_angulo}}", pauta!.angulo ?? "")
      // Função como substituto: o gancho pode ter "R$", e "$" é especial em replace.
      .replace("{{modelo_viral}}", () => modeloViral(pauta as any))
      .replace("{{historico_roteiros_rejeitados}}", formatHistorico(historico))
      .replace("{{restricoes_perfil}}", formatRestricoes(perfil.diretrizes));

    setCustoContexto({
      contaId: (pauta as any)?.conta_id ?? perfil?.conta_id ?? null,
      perfilId: pauta!.perfil_id,
      agente: "copy",
      tipo: "roteiro",
    });
    const text = await callModelo(system, "Escreva o roteiro falado agora. JSON apenas.", 1500);
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
