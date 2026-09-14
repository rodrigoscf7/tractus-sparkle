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
};

// Os mesmos cinco estilos da pergunta de abertura. O exemplo e o que a pessoa
// reconheceu ao escolher, entao e ele que orienta os ganchos.
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

const SYSTEM = `Você lê as respostas de um advogado a um diagnóstico de conteúdo e escreve o "DNA Viral" dele: um documento curto que ele recebe na hora, de graça, antes de contratar qualquer coisa.

Ele acabou de responder e está esperando na tela. O documento precisa fazer duas coisas ao mesmo tempo: ser genuinamente útil sozinho, e deixar visível o trabalho que um diagnóstico único não faz.

RESPOSTAS:
{{respostas}}

ESTILO NARRATIVO ESCOLHIDO:
{{estilo}}

COMO ESCREVER:
- Fale com ele, na segunda pessoa. "Você trava na abertura", não "O usuário apresenta dificuldade".
- Seja específico da área de atuação e do cliente ideal que ele descreveu. Um texto que serviria para qualquer advogado não serve para nenhum — e ele vai perceber na primeira linha.
- Nada de linguagem motivacional, nada de "revolucionário", "poderoso", "descomplicado", "destravar seu potencial". Profissional falando com profissional.
- Nada de elogio vazio. Se o diagnóstico dele é desconfortável, diga com respeito e sem suavizar.
- Os três ganchos precisam estar prontos para gravar hoje, na área dele, com o vocabulário do cliente dele — não o vocabulário do foro. São a prova de que isto funciona.
- Os ganchos precisam soar como o estilo que ele escolheu. Se ele escolheu Storytelling, não entregue gancho de Professor.
- O arquétipo é um nome curto e reconhecível para o padrão dele. Não é elogio nem rótulo de personalidade: é a descrição de onde ele está.

RESTRIÇÕES DE PUBLICIDADE (advocacia) — não negociáveis:
- Nenhum exemplo pode prometer ou insinuar resultado ("garanto seu benefício", "ganhe sua causa").
- Nenhum exemplo pode mercantilizar o serviço (preço, promoção, "consulta grátis") nem captar clientela de forma direta.
- Gancho, retenção e opinião defensável são bem-vindos: o vedado é promessa de resultado e mercantilização, não ser interessante.

SOBRE O CAMPO "o_que_falta":
- Diga, em 2 ou 3 frases, o que este documento NÃO faz: ele é uma fotografia de hoje, não resolve o trabalho de toda semana (descobrir o que está performando agora na área dele, virar pauta na voz dele, ter roteiro pronto nos dias em que ele se comprometeu).
- Seja factual. Não venda, não use superlativo, não prometa resultado. Descrever o trabalho que continua sendo necessário já é suficiente.

Retorne APENAS JSON, sem cercas de código, neste formato exato:
{
  "arquetipo": {
    "nome": "nome curto do padrão dele, 2 a 4 palavras",
    "uma_linha": "1 frase que ele leria e reconheceria como verdade sobre si",
    "descricao": "1 parágrafo sobre onde ele está e qual espaço pode ocupar na área dele"
  },
  "diagnostico": {
    "o_que_trava": "1 frase nomeando o gargalo real, derivado do que ele respondeu",
    "por_que": "1 parágrafo explicando a causa, não o sintoma"
  },
  "pilares": [
    { "nome": "nome curto", "por_que": "1 frase", "exemplos_de_tema": ["3 temas específicos da área dele"] }
  ],
  "ganchos": [
    { "formato": "nome curto do formato", "texto": "o gancho pronto, palavra por palavra" }
  ],
  "o_que_falta": "2 a 3 frases"
}

Entregue exatamente 3 pilares e exatamente 3 ganchos.`;

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
      ? `${estilo.nome}\nComo soa: ${estilo.comoSoa}\nExemplo que ele reconheceu: "${estilo.exemplo}"`
      : "Não informado — derive a voz dos atributos de percepção escolhidos.";

    const system = SYSTEM
      .replace("{{respostas}}", JSON.stringify(respostas, null, 2))
      .replace("{{estilo}}", estiloTexto);

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
