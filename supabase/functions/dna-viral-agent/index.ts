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
  /** Score ja calculado no app — os gargalos precisam concordar com as barras. */
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

const SYSTEM = `Você lê as respostas de um profissional da advocacia a um diagnóstico de conteúdo e escreve o "DNA Viral": um documento curto que a pessoa recebe na hora, de graça, antes de contratar qualquer coisa.

A pessoa acabou de responder e está esperando na tela. O documento precisa fazer duas coisas ao mesmo tempo: ser genuinamente útil sozinho, e deixar visível o trabalho que um diagnóstico único não faz.

RESPOSTAS:
{{respostas}}

ESTILO NARRATIVO (derivado de como quer ser percebido):
{{estilo}}

SCORE JÁ CALCULADO (não invente outros números — os três gargalos precisam concordar com estas barras):
{{score}}

COMO ESCREVER:
- Fale na segunda pessoa. "Você trava na abertura", não "O usuário apresenta dificuldade".
- Gênero neutro: "você", "a pessoa", "quem assiste" — nunca force flexões de gênero.
- Seja específico da área de atuação e do cliente ideal descrito. Um texto que serviria para qualquer advogado não serve para nenhum — e a pessoa vai perceber na primeira linha.
- Nada de linguagem motivacional, nada de "revolucionário", "poderoso", "descomplicado", "destravar seu potencial". Profissional falando com profissional.
- Nada de elogio vazio. Se o diagnóstico é desconfortável, diga com respeito e sem suavizar.
- Os três ROTEIROS precisam estar prontos para gravar hoje: cada um tem gancho (abertura), desenvolvimento (2–4 frases do miolo) e fecho (CTA editorial, sem mercantilizar). Na área da pessoa, com o vocabulário do cliente — não o do foro. São a prova de que isto funciona.
- Os roteiros precisam soar como o estilo indicado. Se o estilo é Storytelling, não entregue abertura de Professor.
- Arquétipo: só inclua se as respostas derem base concreta (área + situação + cliente ou percepção). Nome curto reconhecível do padrão — não é elogio nem rótulo de personalidade. Se não houver substância, omita o campo arquetipo ou deixe null.
- Os três gargalos: o primeiro deriva da situação atual (o que acontece quando senta pra gravar); os outros dois reforçam as dimensões do score com menor pontuação. Título curto + parágrafo de causa, não só sintoma.

RESTRIÇÕES DE PUBLICIDADE (advocacia) — não negociáveis:
- Nenhum exemplo pode prometer ou insinuar resultado ("garanto seu benefício", "ganhe sua causa").
- Nenhum exemplo pode mercantilizar o serviço (preço, promoção, "consulta grátis") nem captar clientela de forma direta.
- Gancho, retenção e opinião defensável são bem-vindos: o vedado é promessa de resultado e mercantilização, não ser interessante.

SOBRE O CAMPO "o_que_falta":
- Diga, em 2 ou 3 frases, o que este documento NÃO faz: ele é uma fotografia de hoje, não resolve o trabalho de toda semana (descobrir o que está performando agora na área, virar pauta na voz da pessoa, ter roteiro pronto nos dias em que se comprometeu).
- Seja factual. Não venda, não use superlativo, não prometa resultado. Descrever o trabalho que continua sendo necessário já é suficiente.

Retorne APENAS JSON, sem cercas de código, neste formato exato:
{
  "arquetipo": {
    "nome": "nome curto do padrão, 2 a 4 palavras — ou omita se não houver base",
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
      "formato": "nome curto do formato (ex.: Curiosidade & Alerta)",
      "gancho": "abertura pronta, palavra por palavra",
      "desenvolvimento": "2 a 4 frases do miolo, prontas para gravar",
      "fecho": "fecho/CTA editorial, sem preço nem promessa de resultado"
    }
  ],
  "o_que_falta": "2 a 3 frases"
}

Entregue exatamente 3 gargalos, exatamente 3 pilares e exatamente 3 roteiros (cada um com gancho, desenvolvimento e fecho).
NÃO inclua campo de score no JSON — ele já foi calculado fora.
NÃO use o campo "ganchos" — o contrato é "roteiros".`;

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
      : "Não informado — derive a voz dos atributos de percepção escolhidos.";

    const scoreTexto = Array.isArray(payload.score) && payload.score.length
      ? payload.score
          .map((s) => `- ${s.rotulo}: ${s.valor}% (${s.faixa})`)
          .join("\n")
      : "Não informado.";

    const system = SYSTEM
      .replace("{{respostas}}", JSON.stringify(respostas, null, 2))
      .replace("{{estilo}}", estiloTexto)
      .replace("{{score}}", scoreTexto);

    // Sem conta: o custo do funil de aquisicao entra com conta_id nulo e
    // aparece no painel financeiro separado do consumo dos clientes.
    setCustoContexto({
      contaId: null,
      perfilId: null,
      agente: "dna_viral",
      tipo: "lead_magnet",
    });

    /*
     * 4000, e nao um teto apertado.
     *
     * A primeira versao pedia 1500 por ser um contrato curto. Na producao isso
     * devolveu conteudo VAZIO depois de 25 segundos: o orcamento se esgota
     * antes de sair texto, e o relatorio caia no fallback curado sem ninguem
     * perceber. Economizar token aqui custa a personalizacao inteira, que e a
     * unica razao de existir desta funcao.
     */
    const text = await callModelo(system, "Escreva o DNA Viral agora.", 4000);
    const relatorio = extractJson<Record<string, unknown>>(text);

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
