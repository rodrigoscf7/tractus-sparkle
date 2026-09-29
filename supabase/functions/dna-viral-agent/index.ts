// DNA Viral: o relatorio publico do quiz da oferta, antes da compra.
//
// Diferente do dna-agent em tres pontos que importam:
//   - Nao ha conta. As respostas chegam no payload, nao do banco.
//   - Nao grava nada. Devolve o relatorio no corpo e quem persiste e a server
//     function do app, na tabela oferta_leads.
//   - E menor e mais rapido. Isto e a prova, nao o produto: roda com alguem
//     esperando na tela, logo depois de um clique que custou anuncio.
//
// Autentica como os outros agentes (x-agent-secret via requireAgentAuth). Quem
// chama e sempre a server function, nunca o navegador.
import {
  callModelo,
  corsHeaders,
  extractJson,
  requireAgentAuth,
  setCustoContexto,
} from "../_shared/agent-utils.ts";

type Payload = {
  respostas?: Record<string, unknown>;
  /** Score ja calculado no app. Os gargalos precisam concordar com as barras. */
  score?: Array<{ chave: string; rotulo: string; valor: number; faixa: string }>;
};

// Os mesmos cinco estilos da pergunta de abertura. O exemplo e o que a pessoa
// reconheceu ao escolher (ou que foi derivado da percepcao), entao e ele que
// orienta os ganchos.
const ESTILOS: Record<string, { nome: string; exemplo: string; comoSoa: string }> = {
  A: {
    nome: "Direto ao ponto",
    exemplo:
      "Se você está grávida e acha que precisa esperar seu filho nascer para pedir o benefício, presta atenção.",
    comoSoa: "Abre nomeando o erro que a pessoa comete. Frases curtas, zero rodeio.",
  },
  B: {
    nome: "Conversa",
    exemplo: "Esses dias uma gestante me perguntou uma coisa que eu escuto praticamente toda semana…",
    comoSoa: "Abre com uma situação real de atendimento. Ritmo de conversa, primeira pessoa.",
  },
  C: {
    nome: "Polêmico",
    exemplo: "Talvez tenham te contado errado sobre salário-maternidade.",
    comoSoa: "Abre contrariando uma crença comum. Tensão no primeiro segundo.",
  },
  D: {
    nome: "Professor",
    exemplo: "Existem três situações em que uma gestante pode ter direito ao salário-maternidade…",
    comoSoa: "Abre anunciando a estrutura do que vem. Didático e organizado.",
  },
  E: {
    nome: "Storytelling",
    exemplo: "Semana passada chegou uma mulher aqui no escritório acreditando que não tinha direito…",
    comoSoa: "Abre com um caso concreto e uma pessoa. A tese vem pela história.",
  },
};

// Quem assiste o conteudo. O modelo erra isso sozinho: ele le "mentoria para
// advogados" e escreve roteiro para o cliente final do direito, quando o
// publico e o proprio advogado. Entao a inferencia vem pronta no prompt.
function publicoDe(r: Record<string, unknown>): string {
  const area = String(r["area_atuacao"] ?? "");
  const livre = `${r["area_outro"] ?? ""} ${r["cliente_ideal"] ?? ""}`.toLowerCase();

  if (area === "mentora" || /advogad|escrit[óo]rio|coleg|mentoria|banca/.test(livre)) {
    return [
      "OUTROS ADVOGADOS E DONOS DE ESCRITÓRIO (público B2B, colegas de profissão).",
      "Os roteiros falam de gestão, captação, previsibilidade de faturamento, posicionamento e rotina de escritório.",
      "É ERRADO escrever sobre direitos do cliente final, prazos processuais ou 'como a Justiça funciona'. Esse público já sabe.",
    ].join(" ");
  }

  if (area === "empresarial" || area === "tributario" || /empres|cnpj|gestor|s[óo]cio|startup|ind[úu]stria/.test(livre)) {
    return [
      "EMPRESAS E GESTORES (público B2B).",
      "Os roteiros falam de risco contratual, passivo silencioso, custo de decisão mal tomada e estrutura preventiva.",
      "Fale a língua de quem decide por números e por risco, não a língua do foro.",
    ].join(" ");
  }

  return [
    "PESSOAS FÍSICAS que podem virar clientes (público B2C, leigas em direito).",
    "Os roteiros explicam o que essa pessoa precisa saber antes de decidir, sem juridiquês e sem citar artigo de lei.",
    "Zero vocabulário técnico: se a palavra não é usada numa conversa de mesa de bar, não entra.",
  ].join(" ");
}

const SYSTEM = `Você lê as respostas de um profissional da advocacia a um diagnóstico de conteúdo e escreve o "DNA Viral": um documento curto que a pessoa recebe na hora, de graça, antes de contratar qualquer coisa.

A pessoa acabou de responder e está esperando na tela. O documento precisa fazer duas coisas ao mesmo tempo: ser genuinamente útil sozinho, e deixar visível o trabalho que um diagnóstico único não faz.

RESPOSTAS:
{{respostas}}

ESTILO NARRATIVO (derivado de como quer ser percebido):
{{estilo}}

SCORE JÁ CALCULADO (não invente outros números; os três gargalos precisam concordar com estas barras):
{{score}}

QUEM ASSISTE OS VÍDEOS DESTA PESSOA:
{{publico}}

Escreva PARA esse público. Roteiro é escrito para uma audiência, não para uma área. Quem faz mentoria para advogados fala com colegas de profissão: um roteiro sobre "a Justiça não funciona como deveria" não diz absolutamente nada para esse público. Errar isso invalida o documento inteiro.

COMO ESCREVER:
- Fale na segunda pessoa. "Você trava na abertura", não "O usuário apresenta dificuldade".
- Gênero neutro: "você", "a pessoa", "quem assiste". Nunca force flexões de gênero.
- Nada de linguagem motivacional, nada de "revolucionário", "poderoso", "descomplicado", "destravar seu potencial". Profissional falando com profissional.
- Nada de elogio vazio. Se o diagnóstico é desconfortável, diga com respeito e sem suavizar.
- PROIBIDO o caractere travessão (—) e o traço médio (–) em qualquer campo do JSON. Não use. Prefira ponto, vírgula ou dois-pontos. Esse traço denuncia texto de modelo.
- Arquétipo: só inclua se as respostas derem base concreta (área + situação + cliente ou percepção). Nome curto reconhecível do padrão; não é elogio nem rótulo de personalidade. Se não houver substância, omita o campo arquetipo ou deixe null.
- Os três gargalos: o primeiro deriva da situação atual (o que acontece quando senta pra gravar); os outros dois reforçam as dimensões do score com menor pontuação. Título curto + parágrafo de causa, não só sintoma.

COMO ESCREVER OS TRÊS ROTEIROS (esta é a parte que a pessoa julga o documento inteiro):
- Cada roteiro é um vídeo falado de 30 a 50 SEGUNDOS. Some gancho + desenvolvimento + fecho e você precisa ter entre 110 e 150 palavras. Menos que isso é esboço, não roteiro.
- Tem que estar pronto para gravar HOJE, lendo em voz alta, sem editar nada. Leia mentalmente antes de devolver: se travar na leitura, reescreva.
- Gancho: 1 ou 2 frases, até 25 palavras, ditas nos 3 primeiros segundos.
- Desenvolvimento: 5 a 8 frases curtas e conectadas, defendendo UMA tese só. Tem que ter conteúdo real: um mecanismo, uma consequência concreta, um exemplo. Frase genérica que serviria para qualquer profissão está proibida.
- Fecho: 1 ou 2 frases. Convite editorial (salvar, comentar, marcar alguém). Sem preço, sem promessa de resultado.
- NÃO repita o nome da área de atuação dentro das frases. Escrever "em mentoria para advogados que mudam o caminho" é erro de concordância e denuncia preenchimento automático. A especificidade vem do CONTEÚDO (o problema real, o mecanismo, a consequência), não de citar o nome da área. No máximo uma menção à área nos três roteiros somados, e só se couber naturalmente.
- NÃO use o texto do "cliente ideal" como sujeito de frase. Ele foi escrito em linguagem de briefing ("advogados sem previsibilidade comercial"), não em linguagem falada. Use-o para entender com quem se fala e escreva com palavras suas.
- Os três roteiros têm que ser diferentes entre si em estrutura, não só no tema. Sugestão: um que alerta sobre um erro, um que quebra uma crença, um que enumera três pontos.
- Os roteiros precisam soar como o estilo indicado. Se o estilo é Storytelling, não entregue abertura de Professor.

RESTRIÇÕES DE PUBLICIDADE (advocacia), não negociáveis:
- Nenhum exemplo pode prometer ou insinuar resultado ("garanto seu benefício", "ganhe sua causa").
- Nenhum exemplo pode mercantilizar o serviço (preço, promoção, "consulta grátis") nem captar clientela de forma direta.
- Gancho, retenção e opinião defensável são bem-vindos: o vedado é promessa de resultado e mercantilização, não ser interessante.

SOBRE O CAMPO "o_que_falta":
- Diga, em 2 ou 3 frases, o que este documento NÃO faz: ele é uma fotografia de hoje, não resolve o trabalho de toda semana (descobrir o que está performando agora na área, virar pauta na voz da pessoa, ter roteiro pronto nos dias em que se comprometeu).
- Seja factual. Não venda, não use superlativo, não prometa resultado. Descrever o trabalho que continua sendo necessário já é suficiente.

Retorne APENAS JSON, sem cercas de código, neste formato exato:
{
  "arquetipo": {
    "nome": "nome curto do padrão, 2 a 4 palavras (ou omita se não houver base)",
    "uma_linha": "1 frase que a pessoa leria e reconheceria como verdade sobre si",
    "descricao": "1 parágrafo específico da área e do cliente descritos"
  },
  "gargalos": [
    { "titulo": "nome curto do gargalo", "texto": "1 parágrafo explicando a causa" }
  ],
  "pilares": [
    { "nome": "nome curto", "por_que": "1 frase", "exemplos_de_tema": ["3 temas específicos da área"] }
  ],
  "roteiros": [
    {
      "formato": "nome curto do formato (ex.: Curiosidade e alerta)",
      "gancho": "abertura pronta, palavra por palavra, até 25 palavras",
      "desenvolvimento": "5 a 8 frases curtas do miolo, prontas para gravar lendo",
      "fecho": "fecho/CTA editorial, sem preço nem promessa de resultado"
    }
  ],
  "o_que_falta": "2 a 3 frases"
}

Entregue exatamente 3 gargalos, exatamente 3 pilares e exatamente 3 roteiros (cada um com gancho, desenvolvimento e fecho, somando de 110 a 150 palavras por roteiro).
NÃO inclua campo de score no JSON; ele já foi calculado fora.
NÃO use o campo "ganchos"; o contrato é "roteiros".
NÃO use travessão (—) nem traço médio (–) em lugar nenhum do JSON.`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  try {
    const payload = (await req.json().catch(() => ({}))) as Payload;
    const respostas = payload.respostas ?? {};

    if (!respostas || typeof respostas !== "object" || !Object.keys(respostas).length) {
      return new Response(JSON.stringify({ ok: false, error: "respostas obrigatórias" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const estiloId = String(respostas["estilo_narrativo"] ?? "").toUpperCase();
    const estilo = ESTILOS[estiloId];
    const estiloTexto = estilo
      ? `${estilo.nome}\nComo soa: ${estilo.comoSoa}\nExemplo de referência: "${estilo.exemplo}"`
      : "Não informado. Derive a voz dos atributos de percepção escolhidos.";

    const scoreTexto = Array.isArray(payload.score) && payload.score.length
      ? payload.score
          .map((s) => `- ${s.rotulo}: ${s.valor}% (${s.faixa})`)
          .join("\n")
      : "Não informado.";

    const system = SYSTEM
      .replace("{{respostas}}", JSON.stringify(respostas, null, 2))
      .replace("{{estilo}}", estiloTexto)
      .replace("{{score}}", scoreTexto)
      .replace("{{publico}}", publicoDe(respostas));

    // Sem conta: o custo do funil de aquisicao entra com conta_id nulo e
    // aparece no painel financeiro separado do consumo dos clientes.
    setCustoContexto({
      contaId: null,
      perfilId: null,
      agente: "dna_viral",
      tipo: "lead_magnet",
    });

    /*
     * 8000 + reasoning.effort=low.
     *
     * Historia: com 1500 o modelo esgotava o orcamento e devolvia content
     * vazio. Subimos pra 4000 e o DNA Viral curto funcionava. Quando o
     * contrato passou a pedir 3 roteiros de 110-150 palavras, o Sonnet 5
     * (thinking adaptativo) passou a gastar os 4000 em reasoning e devolver
     * content "" ou JSON truncado. O app via "fora do contrato" / 500 e
     * caia no fallback curado. 8000 deixa folga pra thinking baixo + JSON
     * completo; effort=low evita que o thinking coma o orcamento de novo.
     */
    const text = await callModelo(system, "Escreva o DNA Viral agora. Responda só com o JSON.", 8000, {
      reasoningEffort: "low",
    });
    const relatorio = extractJson<Record<string, unknown>>(text);

    // Recusar devolver ok:true com JSON "reparado" incompleto. Isso era o
    // caminho silencioso pro fallback: o app recebia 200, normalizava null
    // e logava "fora do contrato" sem ninguem ver o motivo real.
    const roteiros = Array.isArray(relatorio.roteiros) ? relatorio.roteiros : [];
    const pilares = Array.isArray(relatorio.pilares) ? relatorio.pilares : [];
    const gargalos = Array.isArray(relatorio.gargalos) ? relatorio.gargalos : [];
    const roteirosOk = roteiros.filter((r) => {
      const item = (r ?? {}) as Record<string, unknown>;
      return Boolean(item.gancho && item.desenvolvimento && item.fecho);
    }).length >= 3;
    if (!roteirosOk || pilares.length < 3 || gargalos.length < 3) {
      throw new Error(
        `Relatório incompleto após parse: roteiros=${roteiros.length}, ` +
          `pilares=${pilares.length}, gargalos=${gargalos.length}. ` +
          `Provável truncamento (finish_reason=length).`,
      );
    }

    return new Response(JSON.stringify({ ok: true, relatorio }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("dna-viral-agent", e);
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
