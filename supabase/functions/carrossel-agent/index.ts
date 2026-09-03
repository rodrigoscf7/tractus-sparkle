// Carrossel: disparado manualmente após a aprovação final de uma pauta.
// Etapa 1 (copy): reescreve o roteiro falado como copy de carrossel (hook / desenvolvimento / CTA).
// Etapa 2 (visual): define a direção dos slides no template estilo post de rede social.
import {
  callClaude,
  corsHeaders,
  extractJson,
  getServiceClient,
  requireAgentAuth,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM_COPY =
  `Você adapta um ROTEIRO FALADO de Reel para a COPY de um CARROSSEL de {{perfil_nome}}.
Tom: direto, assertivo, primeira pessoa, português do Brasil. Sem emoji, sem hashtag, sem travessão.
Diretrizes do perfil: {{perfil_diretrizes}}
CTA padrão do perfil (âncora obrigatória do último slide): {{cta_padrao}}
Pauta: tema={{pauta_tema}} | ângulo={{pauta_angulo}}
Roteiro aprovado (fonte da verdade — mantenha a MESMA tese e o MESMO posicionamento): {{roteiro_texto}}

Regras do carrossel:
- Entre 5 e 8 slides no total, você decide conforme a densidade do roteiro.
- Slide 1 = hook: frase curta e provocativa, até 12 palavras.
- Slides do meio = desenvolvimento: um argumento por slide, 1 a 3 frases curtas cada, encadeados.
- Último slide = CTA: sempre presente. Se houver CTA padrão do perfil, ela é a base: mantenha a MESMA
  intenção e o MESMO canal de resposta, podendo ajustar as palavras ao tema. Se for "nenhuma", escolha você.
- Cada slide é TEXTO SIMPLES lido em segundos. Máximo 220 caracteres por slide. Sem numeração no texto.

Retorne APENAS um JSON compacto:
{ "slides": [ { "tipo": "hook|desenvolvimento|cta", "texto": "string" } ],
  "legenda_sugerida": "string até 280 caracteres, sem emoji" }`;

const SYSTEM_VISUAL =
  `Você dirige a apresentação visual de um carrossel de {{perfil_nome}} no template "post de rede social": fundo sólido, foto e arroba do perfil, selo de verificado, texto simples.
O template é fixo — você NÃO escreve HTML nem CSS, nem sugere imagens ou ilustrações. Você decide ênfase e ritmo de leitura.
Identidade visual do perfil (referência): {{perfil_identidade_visual}}
Slides (na ordem): {{slides_texto}}

Para cada slide, escolha no máximo 4 palavras contíguas do próprio texto para destacar em negrito (copie exatamente como aparecem, ou string vazia se nada merecer destaque).

Retorne APENAS um JSON compacto:
{ "slides": [ { "destaque": "trecho exato do texto ou string vazia", "ritmo": "uma palavra: impacto, respiro ou fechamento" } ],
  "observacao_geral": "1 frase sobre como a sequência deve ser lida" }`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  let carrosselId: string | null = null;
  const supabase = getServiceClient();

  try {
    const { pauta_id } = await req.json();
    if (!pauta_id) throw new Error("pauta_id obrigatório");

    const { data: pauta, error: pautaErr } = await supabase
      .from("pautas_geradas")
      .select(
        "id, perfil_id, tema, angulo, status, perfis:perfis(nome,diretrizes,identidade_visual,cta_padrao)",
      )
      .eq("id", pauta_id)
      .single();
    if (pautaErr || !pauta) throw new Error("Pauta não encontrada");
    if (pauta.status !== "aprovada") {
      throw new Error("O carrossel só pode ser gerado depois da aprovação final da pauta");
    }

    const { data: roteiro } = await supabase
      .from("roteiros")
      .select("conteudo")
      .eq("pauta_id", pauta_id)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!roteiro?.conteudo) throw new Error("Roteiro aprovado não encontrado para esta pauta");

    const c = roteiro.conteudo as Record<string, unknown>;
    const roteiroTexto = [
      c["gancho_falado"] ?? c["gancho"],
      c["desenvolvimento_falado"] ?? c["corpo"],
      c["cta_falado"] ?? c["cta"],
    ]
      .filter(Boolean)
      .map((x) => (typeof x === "string" ? x : JSON.stringify(x)))
      .join("\n\n")
      .slice(0, 2000);

    const perfil = (pauta as unknown as { perfis: Record<string, unknown> }).perfis;

    // Reaproveita o carrossel existente (regeneração) ou cria um novo registro.
    const { data: existente } = await supabase
      .from("carrosseis")
      .select("id")
      .eq("pauta_id", pauta_id)
      .maybeSingle();

    if (existente) {
      carrosselId = existente.id;
      await supabase
        .from("carrosseis")
        .update({ status: "gerando", erro: null })
        .eq("id", carrosselId);
    } else {
      const { data: novo, error: insErr } = await supabase
        .from("carrosseis")
        .insert({ pauta_id, perfil_id: pauta.perfil_id, status: "gerando" })
        .select("id")
        .single();
      if (insErr) throw insErr;
      carrosselId = novo.id;
    }

    // ---- Etapa 1: copy ----
    await setStatus("copy", "working", "adaptando roteiro para carrossel");
    const systemCopy = SYSTEM_COPY
      .replace("{{perfil_nome}}", String(perfil?.["nome"] ?? ""))
      .replace("{{perfil_diretrizes}}", JSON.stringify(perfil?.["diretrizes"] ?? {}).slice(0, 900))
      .replace("{{pauta_tema}}", pauta.tema ?? "")
      .replace("{{pauta_angulo}}", pauta.angulo ?? "")
      .replace("{{cta_padrao}}", String(perfil?.["cta_padrao"] ?? "").trim() || "nenhuma")
      .replace("{{roteiro_texto}}", roteiroTexto);

    const copyText = await callClaude(systemCopy, "Copy do carrossel agora. JSON apenas.", 1100);
    const copyJson = extractJson(copyText) as {
      slides?: Array<{ tipo?: string; texto?: string }>;
      legenda_sugerida?: string;
    };
    const slides = (copyJson.slides ?? []).filter((s) => s?.texto);
    if (slides.length === 0) throw new Error("Copy do carrossel voltou sem slides");

    await supabase.from("carrosseis").update({ copy: copyJson }).eq("id", carrosselId);
    await setStatus("copy", "idle", `copy de carrossel pronta (${slides.length} slides)`);

    // ---- Etapa 2: visual ----
    await setStatus("visual", "working", "dirigindo slides do carrossel");
    const systemVisual = SYSTEM_VISUAL
      .replace("{{perfil_nome}}", String(perfil?.["nome"] ?? ""))
      .replace(
        "{{perfil_identidade_visual}}",
        JSON.stringify(perfil?.["identidade_visual"] ?? {}).slice(0, 600),
      )
      .replace(
        "{{slides_texto}}",
        slides.map((s, i) => `${i + 1}. [${s.tipo ?? ""}] ${s.texto}`).join("\n"),
      );

    let visualJson: unknown = null;
    try {
      const visualText = await callClaude(systemVisual, "Direção dos slides em JSON.", 600);
      visualJson = extractJson(visualText);
    } catch (e) {
      // Direção é opcional: sem ela o carrossel renderiza com texto simples.
      console.error("visual step failed", e);
    }

    await supabase
      .from("carrosseis")
      .update({ visual: visualJson, status: "pronto", erro: null })
      .eq("id", carrosselId);
    await setStatus("visual", "idle", `slides de carrossel prontos para ${pauta_id.slice(0, 8)}`);

    return new Response(JSON.stringify({ ok: true, carrossel_id: carrosselId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    const msg = String(e).slice(0, 400);
    if (carrosselId) {
      await supabase.from("carrosseis").update({ status: "erro", erro: msg }).eq("id", carrosselId);
    }
    await setStatus("copy", "error", msg.slice(0, 200));
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
