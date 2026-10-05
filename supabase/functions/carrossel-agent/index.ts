// Carrossel: disparado manualmente após a aprovação final de uma pauta.
//
// O carrossel é um formato próprio, lido e arrastado, não o roteiro do vídeo
// fatiado em slides. O roteiro entra só como referência da tese; a estrutura,
// o ritmo e a retenção são pensados para o arrasto. Uma chamada ao modelo
// escreve título, corpo e destaque de cada slide.
import {
  callModelo,
  corsHeaders,
  extractJson,
  formatRestricoes,
  getServiceClient,
  limiteDisponivel,
  requireAgentAuth,
  setCustoContexto,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM_COPY = `Você é roteirista de carrosséis do Instagram para {{perfil_nome}}, advogado. Seu trabalho é fazer a pessoa arrastar até o último slide e salvar o post.

CARROSSEL NÃO É VÍDEO. O roteiro do Reel abaixo serve só para você saber a TESE que ele defende. Não transcreva, não resuma e não fatie o roteiro em slides: escreva do zero para LEITURA. Quem lê escaneia em segundos, decide se arrasta e só salva o que tem valor prático. Nada de oralidade ("olha só", "vem comigo", "deixa eu te contar").

CONTEXTO
- Diretrizes do perfil: {{perfil_diretrizes}}
- Manual de marca (voz, público, ganchos): {{manual}}
- Pauta: tema={{pauta_tema}} | ângulo (tese)={{pauta_angulo}}
- Gancho e estrutura do viral que inspirou a pauta: {{modelo_viral}}
- Roteiro do Reel (só a tese, NÃO copie frases): {{roteiro_texto}}
- CTA padrão do perfil: {{cta_padrao}}

REGRAS INEGOCIÁVEIS DESTE PERFIL
{{restricoes_perfil}}

1) ESCOLHA O FORMATO que melhor carrega a tese, um destes:
lista de erros | passo a passo | mito x verdade | antes e depois | checklist | tese e provas.

2) ESTRUTURA (7 a 10 slides):
- CAPA (slide 1): título de até 9 palavras que cria tensão ou curiosidade e promete algo concreto. Corpo opcional de até 12 palavras que aumenta a vontade de arrastar. NUNCA entregue a resposta na capa.
- CONTEXTO (slide 2): por que isso importa para o público dele, em linguagem dele. Aumente a tensão e termine puxando para o próximo slide.
- CONTEÚDO (o miolo): uma ideia por slide. Título curto (até 8 palavras) que funciona sozinho; corpo de até 35 palavras com algo concreto: exemplo, consequência ou como fazer. Em lista ou passo a passo, numere no título ("1. ...").
- RITMO: alterne slides densos com slides de respiro (só um título forte, sem corpo). Em pelo menos 2 slides do miolo, termine abrindo o próximo slide, cada vez com uma frase diferente e ligada ao conteúdo que vem (nunca a mesma fórmula duas vezes).
- VIRADA ou RESUMO (penúltimo): a síntese prática que vale salvar.
- CTA (último): peça para salvar ou enviar a quem precisa e use a CTA padrão do perfil (mesma intenção e mesmo canal, palavras adaptadas ao tema; se for "nenhuma", escolha você).

3) TEXTO
- Máximo de 70 caracteres no título e 240 no corpo.
- Destaque: até 4 palavras contíguas copiadas exatamente do corpo (ou do título, se o slide não tiver corpo). Vazio se nada merecer.
- Sem emoji, sem hashtag, sem travessão (—) ou traço médio (–).
- Publicidade da advocacia: sem prometer resultado, sem preço, promoção ou consulta grátis, sem captação direta.
- Não afirme mudança de lei, entendimento, número ou estatística que não esteja no contexto acima. Na dúvida, escreva como erro comum ou opinião.

Retorne APENAS um JSON compacto:
{ "formato": "um dos formatos acima",
  "estrategia": "1 frase: por que essa estrutura segura o arrasto neste tema",
  "slides": [ { "tipo": "capa|contexto|conteudo|respiro|virada|resumo|cta", "titulo": "string ou vazio", "corpo": "string ou vazio", "destaque": "string ou vazio" } ],
  "legenda_sugerida": "até 280 caracteres, sem emoji, que complementa o carrossel sem repetir a capa" }`;

type SlideCopy = { tipo?: string; titulo?: string; corpo?: string; destaque?: string };

/** Partes do manual que mudam a escrita: voz, público e fórmulas de gancho. */
function resumoDoManual(conteudo: unknown): string {
  const m = (conteudo ?? {}) as Record<string, unknown>;
  const partes = {
    posicionamento: m["resumo_posicionamento"],
    como_soa: m["como_voce_soa"],
    publico: m["publico"],
    formulas_de_gancho: m["formulas_de_gancho"],
    lista_proibida: m["lista_proibida"],
  };
  return JSON.stringify(partes).slice(0, 2500);
}

function modeloViral(
  pauta: { gancho_modelo?: string | null; estrutura_modelo?: unknown },
  analise: { formato?: string; analise?: Record<string, unknown> } | null,
): string {
  const estrutura = Array.isArray(pauta.estrutura_modelo) ? pauta.estrutura_modelo.map(String) : [];
  const partes: string[] = [];
  if (pauta.gancho_modelo) partes.push(`gancho: ${pauta.gancho_modelo}`);
  if (estrutura.length) partes.push(`estrutura: ${estrutura.join(" → ")}`);
  // Se o viral de origem já era um carrossel, a estrutura dele é a referência mais direta.
  if (analise?.formato === "carrossel" && analise.analise) {
    const a = analise.analise;
    partes.push(
      `o viral era um CARROSSEL: ${JSON.stringify({
        estrutura: a["estrutura"],
        retencao: a["retencao"],
        padrao: a["padrao_replicavel"],
      }).slice(0, 1200)}`,
    );
  }
  return partes.join(" | ") || "nenhum (pauta sem viral de origem)";
}

/** Destaque acima disso deixa de destacar: vira meio parágrafo em negrito. */
const DESTAQUE_MAX_PALAVRAS = 5;

/** Limpa o que o modelo devolveu: slide sem título nem corpo some; destaque longo ou que não existe no texto vira vazio. */
function normalizarSlides(slides: SlideCopy[]): SlideCopy[] {
  return slides
    .map((s) => ({
      tipo: String(s.tipo ?? "conteudo"),
      titulo: String(s.titulo ?? "").trim(),
      corpo: String(s.corpo ?? "").trim(),
      destaque: String(s.destaque ?? "").trim(),
    }))
    .filter((s) => s.titulo || s.corpo)
    .map((s) => {
      const alvo = (s.corpo || s.titulo).toLowerCase();
      const valido = s.destaque &&
        s.destaque.split(/\s+/).length <= DESTAQUE_MAX_PALAVRAS &&
        alvo.includes(s.destaque.toLowerCase());
      return { ...s, destaque: valido ? s.destaque : "" };
    });
}

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
        "id, perfil_id, tema, angulo, status, conta_id, gancho_modelo, estrutura_modelo, analise_viral_id, perfis:perfis(nome,diretrizes,cta_padrao,conta_id)",
      )
      .eq("id", pauta_id)
      .single();
    if (pautaErr || !pauta) throw new Error("Pauta não encontrada");
    if (pauta.status !== "aprovada") {
      throw new Error("O carrossel só pode ser gerado depois da aprovação final da pauta");
    }

    const perfil = (pauta as unknown as { perfis: Record<string, unknown> | null }).perfis ?? {};
    const contaId = (pauta.conta_id as string | null) ?? (perfil["conta_id"] as string | null) ?? null;

    // Cota do plano validada no servidor antes de gastar tokens.
    const cotaCarrossel = await limiteDisponivel(contaId, "carrossel");
    if (!cotaCarrossel.permitido) {
      throw new Error(
        `Limite de carrosséis do plano atingido (${cotaCarrossel.motivo}). Renova no próximo ciclo.`,
      );
    }

    const [{ data: roteiro }, { data: manual }, { data: analise }] = await Promise.all([
      supabase
        .from("roteiros")
        .select("conteudo")
        .eq("pauta_id", pauta_id)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("dna_relatorios")
        .select("conteudo")
        .eq("conta_id", contaId ?? "")
        .order("versao", { ascending: false })
        .limit(1)
        .maybeSingle(),
      pauta.analise_viral_id
        ? supabase
          .from("analises_virais")
          .select("formato, analise")
          .eq("id", pauta.analise_viral_id)
          .maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
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

    await setStatus("copy", "working", "escrevendo carrossel");
    // Funções como substituto: o texto pode ter "$" (R$), que é especial em replace.
    const systemCopy = SYSTEM_COPY
      .replace("{{perfil_nome}}", () => String(perfil["nome"] ?? ""))
      .replace("{{perfil_diretrizes}}", () => JSON.stringify(perfil["diretrizes"] ?? {}).slice(0, 900))
      .replace("{{manual}}", () => resumoDoManual(manual?.conteudo))
      .replace("{{pauta_tema}}", () => pauta.tema ?? "")
      .replace("{{pauta_angulo}}", () => pauta.angulo ?? "")
      .replace("{{modelo_viral}}", () => modeloViral(pauta, analise as never))
      .replace("{{roteiro_texto}}", () => roteiroTexto)
      .replace("{{cta_padrao}}", () => String(perfil["cta_padrao"] ?? "").trim() || "nenhuma")
      .replace("{{restricoes_perfil}}", () => formatRestricoes(perfil["diretrizes"]));

    setCustoContexto({ contaId, perfilId: pauta.perfil_id, agente: "carrossel", tipo: "carrossel" });
    const copyText = await callModelo(systemCopy, "Escreva o carrossel agora. JSON apenas.", 4000);
    const copyJson = extractJson<{
      formato?: string;
      estrategia?: string;
      slides?: SlideCopy[];
      legenda_sugerida?: string;
    }>(copyText);

    const slides = normalizarSlides(copyJson.slides ?? []);
    if (slides.length < 4) throw new Error(`Carrossel voltou com ${slides.length} slides`);

    // `texto` mantém o app anterior (que só lê esse campo) exibindo os slides
    // enquanto a versão com título e corpo não está publicada.
    const slidesCompat = slides.map((s) => ({
      ...s,
      texto: [s.titulo, s.corpo].filter(Boolean).join("\n\n"),
    }));

    await supabase
      .from("carrosseis")
      .update({
        copy: { ...copyJson, slides: slidesCompat },
        // O destaque agora vem na copy; o passo visual separado deixou de existir.
        visual: null,
        status: "pronto",
        erro: null,
      })
      .eq("id", carrosselId);
    await setStatus("copy", "idle", `carrossel pronto (${slides.length} slides, ${copyJson.formato ?? "?"})`);

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
