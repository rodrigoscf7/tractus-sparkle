// DNA: lê as respostas do onboarding e escreve o manual de marca do perfil.
// Roda uma vez ao final do wizard (e sob demanda para regerar).
// Não faz parte da esteira de produção: não altera agentes_status nem consome
// cota mensal, mas registra custo para aparecer no painel financeiro.
import {
  MODEL,
  callModelo,
  corsHeaders,
  extractJson,
  getServiceClient,
  requireAgentAuth,
  setCustoContexto,
} from "../_shared/agent-utils.ts";

type DnaPayload = {
  conta_id?: string;
  perfil_id?: string;
};

// Os cinco estilos da pergunta 7. O exemplo é o que a pessoa reconheceu ao
// escolher, então é ele que orienta as fórmulas de gancho do manual.
const ESTILOS: Record<string, { nome: string; exemplo: string; comoSoa: string }> = {
  A: {
    nome: "Direto ao ponto",
    exemplo:
      "Se você está grávida e acha que precisa esperar seu filho nascer para pedir o benefício, presta atenção.",
    comoSoa: "Abre nomeando o erro que a pessoa comete. Frases curtas, verbo no imperativo, zero rodeio.",
  },
  B: {
    nome: "Conversa",
    exemplo: "Esses dias uma gestante me perguntou uma coisa que eu escuto praticamente toda semana…",
    comoSoa: "Abre com uma situação real de atendimento. Ritmo de conversa, primeira pessoa, sem formalidade.",
  },
  C: {
    nome: "Polêmico",
    exemplo: "Talvez tenham te contado errado sobre salário-maternidade.",
    comoSoa: "Abre contrariando uma crença comum. Tensão no primeiro segundo, resolução no desenvolvimento.",
  },
  D: {
    nome: "Professor",
    exemplo: "Existem três situações em que uma gestante pode ter direito ao salário-maternidade…",
    comoSoa: "Abre anunciando a estrutura do que vem. Didático, organizado, promete clareza.",
  },
  E: {
    nome: "Storytelling",
    exemplo: "Semana passada chegou uma mulher aqui no escritório acreditando que não tinha direito…",
    comoSoa: "Abre com um caso concreto e uma pessoa. A tese aparece pela história, não antes dela.",
  },
};

const SYSTEM = `Você escreve manuais de marca para advogados que estão construindo presença e posicionamento nas redes sociais.

Recebeu as respostas do onboarding de um advogado. Sua tarefa é escrever o manual de marca dele — um documento que ele vai baixar, guardar e usar como referência ao produzir conteúdo.

RESPOSTAS DO ONBOARDING:
{{respostas}}

ESTILO NARRATIVO ESCOLHIDO:
{{estilo}}

COMO ESCREVER:
- Fale com ele, na segunda pessoa. "Você abre seus vídeos nomeando o erro…", não "O usuário deve…".
- Seja específico da área de atuação e do nicho dele. Um manual que serviria para qualquer advogado não serve para nenhum.
- Nada de linguagem motivacional, nada de "revolucionário", "poderoso", "descomplicado". Profissional falando com profissional.
- As fórmulas de gancho precisam soar como o estilo escolhido. Se ele escolheu Storytelling, não entregue gancho de Professor.
- Os exemplos de tema e de gancho precisam ser sobre o direito que ele pratica, com o vocabulário do cliente dele — não o vocabulário do foro.
- Respeite a lista proibida: nada do que ele pediu para evitar pode aparecer nos seus exemplos.
- Se ele informou bordões, use-os nos exemplos de fechamento.

RESTRIÇÕES DE PUBLICIDADE (advocacia):
- Nenhum exemplo pode prometer ou insinuar resultado ("garanto seu benefício", "ganhe sua causa").
- Nenhum exemplo pode mercantilizar o serviço (preço, promoção, "consulta grátis") nem captar clientela de forma direta.
- Gancho, retenção e opinião defensável são bem-vindos: o que é vedado é promessa de resultado e mercantilização, não ser interessante.

Retorne APENAS JSON, sem cercas de código, neste formato exato:
{
  "resumo_posicionamento": "2 a 3 frases dizendo qual espaço ele ocupa e por que alguém o seguiria em vez de outro advogado da mesma área",
  "como_voce_soa": {
    "descricao": "1 parágrafo sobre a voz dele, derivado do estilo e dos atributos escolhidos",
    "faca": ["4 a 6 orientações concretas de escrita"],
    "evite": ["3 a 5 itens, incorporando a lista proibida dele"]
  },
  "publico": {
    "quem_e": "1 parágrafo com o cliente ideal dele em linguagem de gente",
    "dores": ["3 a 5 dores reais"],
    "objecoes": ["3 a 4 objeções que travam essa pessoa antes de procurar um advogado"],
    "onde_esta_a_atencao": "1 frase sobre o que faz essa pessoa parar o dedo no feed"
  },
  "pilares": [
    { "nome": "nome curto do pilar", "por_que": "1 frase", "exemplos_de_tema": ["3 temas específicos"] }
  ],
  "formulas_de_gancho": [
    { "nome": "nome da fórmula", "estrutura": "o molde, com lacunas", "exemplo": "gancho pronto, na área dele, no estilo dele" }
  ],
  "bordoes": ["bordões dele, ou lista vazia se não informou"],
  "lista_proibida": ["o que ele não quer ver no conteúdo dele"],
  "primeiras_quatro_semanas": [
    { "semana": 1, "foco": "1 frase", "entregas": ["2 a 3 entregas concretas"] }
  ],
  "proximo_passo": "1 frase dizendo o que fazer ao fechar este documento"
}

Entregue de 3 a 5 pilares, de 4 a 5 fórmulas de gancho e exatamente 4 semanas.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  try {
    const payload = (await req.json().catch(() => ({}))) as DnaPayload;
    if (!payload.conta_id) {
      return new Response(JSON.stringify({ ok: false, error: "conta_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = getServiceClient();

    const { data: onboarding } = await supabase
      .from("onboarding_respostas")
      .select("respostas, perfil_id")
      .eq("conta_id", payload.conta_id)
      .maybeSingle();

    if (!onboarding) {
      return new Response(JSON.stringify({ ok: false, error: "onboarding não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const perfilId = payload.perfil_id ?? onboarding.perfil_id ?? null;
    const respostas = (onboarding.respostas ?? {}) as Record<string, unknown>;

    const estiloId = String(respostas["estilo_narrativo"] ?? "").toUpperCase();
    const estilo = ESTILOS[estiloId];
    const estiloTexto = estilo
      ? `${estilo.nome}\nComo soa: ${estilo.comoSoa}\nExemplo que ele reconheceu: "${estilo.exemplo}"`
      : "Não informado — derive a voz dos atributos de percepção escolhidos.";

    const system = SYSTEM
      .replace("{{respostas}}", JSON.stringify(respostas, null, 2))
      .replace("{{estilo}}", estiloTexto);

    setCustoContexto({
      contaId: payload.conta_id,
      perfilId,
      agente: "dna",
      tipo: "manual_marca",
    });

    const text = await callModelo(system, "Escreva o manual de marca agora.", 4000);
    const conteudo = extractJson<Record<string, unknown>>(text);

    const { data: anterior } = await supabase
      .from("dna_relatorios")
      .select("versao")
      .eq("conta_id", payload.conta_id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: relatorio, error } = await supabase
      .from("dna_relatorios")
      .insert({
        conta_id: payload.conta_id,
        perfil_id: perfilId,
        conteudo,
        modelo: MODEL,
        versao: (anterior?.versao ?? 0) + 1,
      })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    return new Response(JSON.stringify({ ok: true, relatorio_id: relatorio.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dna-agent", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
