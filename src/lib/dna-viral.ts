/**
 * O DNA Viral — o relatório que a pessoa recebe no fim do quiz público.
 *
 * Contrato menor que o manual de marca completo (`dna_relatorios.conteudo`,
 * 8 seções) de propósito: este é a prova, não o produto. Mostra o suficiente
 * para a pessoa reconhecer que fomos específicos com ela, e deixa explícito o
 * que só a esteira entrega — continuidade, curadoria e ritmo semanal.
 *
 * Aqui também mora o fallback curado. A geração por IA acontece numa página
 * alimentada por tráfego pago: se o agente cair, estourar o tempo ou a origem
 * bater no limite de geração, a pessoa recebe ESTE relatório em vez de uma
 * tela de erro. Custou o clique do anúncio — não se devolve um erro.
 */

import { ESTILOS, labelArea, type Respostas } from "@/lib/onboarding-perguntas";

export type Gancho = { formato: string; texto: string };

export type Pilar = {
  nome: string;
  por_que: string;
  exemplos_de_tema: string[];
};

export type DnaViral = {
  arquetipo: { nome: string; uma_linha: string; descricao: string };
  diagnostico: { o_que_trava: string; por_que: string };
  pilares: Pilar[];
  ganchos: Gancho[];
  o_que_falta: string;
};

/** Leitura defensiva: o JSON vem de um modelo, então nada é garantido. */
function texto(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.map((i) => (typeof i === "string" ? i.trim() : "")).filter(Boolean);
}

/**
 * Valida o que o agente devolveu. Devolve `null` se o essencial faltar, para
 * quem chamou cair no fallback em vez de renderizar um relatório pela metade.
 */
export function normalizarDnaViral(bruto: unknown): DnaViral | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;

  const arq = (o.arquetipo ?? {}) as Record<string, unknown>;
  const diag = (o.diagnostico ?? {}) as Record<string, unknown>;

  const nome = texto(arq.nome);
  const umaLinha = texto(arq.uma_linha);
  const descricao = texto(arq.descricao);
  if (!nome || !umaLinha || !descricao) return null;

  const pilares: Pilar[] = (Array.isArray(o.pilares) ? o.pilares : [])
    .map((p) => {
      const item = (p ?? {}) as Record<string, unknown>;
      return {
        nome: texto(item.nome) ?? "",
        por_que: texto(item.por_que) ?? "",
        exemplos_de_tema: lista(item.exemplos_de_tema),
      };
    })
    .filter((p) => p.nome && p.por_que);

  const ganchos: Gancho[] = (Array.isArray(o.ganchos) ? o.ganchos : [])
    .map((g) => {
      const item = (g ?? {}) as Record<string, unknown>;
      return { formato: texto(item.formato) ?? "", texto: texto(item.texto) ?? "" };
    })
    .filter((g) => g.texto);

  if (!pilares.length || !ganchos.length) return null;

  return {
    arquetipo: { nome, uma_linha: umaLinha, descricao },
    diagnostico: {
      o_que_trava: texto(diag.o_que_trava) ?? "",
      por_que: texto(diag.por_que) ?? "",
    },
    pilares,
    ganchos,
    o_que_falta: texto(o.o_que_falta) ?? "",
  };
}

// ---------------------------------------------------------------------------
// Fallback curado
// ---------------------------------------------------------------------------

const ARQUETIPO_POR_SITUACAO: Record<string, { nome: string; uma_linha: string }> = {
  ideias_sem_conteudo: {
    nome: "O Repertório Preso",
    uma_linha: "Você tem o que dizer. Falta o caminho entre a ideia e a câmera.",
  },
  nao_sei_postar: {
    nome: "O Especialista Silencioso",
    uma_linha: "Você domina o assunto e trava na hora de escolher por onde começar.",
  },
  demoro_roteiro: {
    nome: "O Artesão Lento",
    uma_linha: "Cada peça sua sai boa. O custo é o tempo que ela leva para sair.",
  },
  poucas_views: {
    nome: "O Conteúdo Sem Porta",
    uma_linha: "O que você diz sustenta. O problema está nos primeiros segundos.",
  },
  views_sem_cliente: {
    nome: "A Audiência Sem Endereço",
    uma_linha: "Você alcança gente. Falta a ponte entre assistir e procurar você.",
  },
  sem_tempo: {
    nome: "A Agenda Cheia",
    uma_linha: "Seu limite não é ideia nem vontade — é hora disponível na semana.",
  },
  escalar: {
    nome: "O Pronto Para Escalar",
    uma_linha: "A base está de pé. O que falta é sistema para repetir sem depender de você.",
  },
};

const TRAVA_POR_SITUACAO: Record<string, { o_que_trava: string; por_que: string }> = {
  ideias_sem_conteudo: {
    o_que_trava: "A distância entre ter a ideia e ter o roteiro pronto.",
    por_que:
      "Ideia não vira conteúdo por esforço, vira por processo. Sem um formato fixo para atravessar da anotação até a gravação, cada publicação recomeça do zero — e recomeçar é caro demais para acontecer toda semana.",
  },
  nao_sei_postar: {
    o_que_trava: "A escolha do tema, não o domínio do tema.",
    por_que:
      "Quem atende todo dia tem assunto de sobra: o que falta é um critério para decidir qual dúvida do cliente vira publicação. Sem esse critério, a página em branco ganha da agenda.",
  },
  demoro_roteiro: {
    o_que_trava: "O tempo de produção por peça.",
    por_que:
      "Escrever cada roteiro do zero cobra a mesma energia toda vez. Com estruturas fixas de abertura e desenvolvimento, o esforço cai para o que realmente muda entre um conteúdo e outro: o caso.",
  },
  poucas_views: {
    o_que_trava: "A abertura.",
    por_que:
      "A decisão de continuar assistindo acontece antes do conteúdo começar. Um bom desenvolvimento não recupera uma abertura que não deu motivo para ficar.",
  },
  views_sem_cliente: {
    o_que_trava: "A ponte entre audiência e procura.",
    por_que:
      "Alcance responde a formato; procura responde a posicionamento. Sem deixar claro para quem você resolve e o que acontece depois do contato, a audiência assiste e segue adiante.",
  },
  sem_tempo: {
    o_que_trava: "A semana, não a disposição.",
    por_que:
      "Plano de conteúdo que não cabe na rotina real não é plano, é dívida. O ritmo precisa ser dimensionado pela pior semana do mês, não pela melhor.",
  },
  escalar: {
    o_que_trava: "A dependência de você em cada etapa.",
    por_que:
      "Produção que passa inteira pela sua cabeça tem teto na sua agenda. Escalar exige que pauta e roteiro cheguem prontos para você decidir, não para você criar.",
  },
};

const PILARES_POR_OBJETIVO: Record<string, Pilar> = {
  clientes: {
    nome: "Dúvida que antecede a contratação",
    por_que:
      "São as perguntas que a pessoa faz antes de decidir procurar um advogado. Responder elas te coloca na frente no momento em que a decisão acontece.",
    exemplos_de_tema: [
      "O erro mais caro que as pessoas cometem antes de procurar ajuda",
      "Quando vale a pena entrar com o pedido e quando não vale",
      "O que levar na primeira conversa",
    ],
  },
  autoridade: {
    nome: "Tese contra o senso comum",
    por_que:
      "Repetir o que todo mundo diz não constrói autoridade. Discordar com fundamento, sim — e é o que separa você de quem só informa.",
    exemplos_de_tema: [
      "A crença mais comum da sua área que não se sustenta",
      "O que mudou na prática e quase ninguém atualizou",
      "Por que o caminho mais óbvio costuma ser o pior",
    ],
  },
  leads: {
    nome: "Diagnóstico guiado",
    por_que:
      "Conteúdo que ajuda a pessoa a se identificar em uma situação específica gera contato qualificado, não curiosidade solta.",
    exemplos_de_tema: [
      "Como saber se o seu caso se encaixa",
      "Três sinais de que você está deixando dinheiro na mesa",
      "O que fazer nas primeiras 48 horas",
    ],
  },
  seguidores: {
    nome: "Caso real, contado direito",
    por_que:
      "História prende onde explicação perde. É o formato que mais viaja para fora da sua bolha de seguidores.",
    exemplos_de_tema: [
      "Um caso que terminou diferente do esperado",
      "O detalhe pequeno que mudou o resultado",
      "O que ninguém conta sobre como isso funciona na prática",
    ],
  },
  engajamento: {
    nome: "Pergunta que divide opinião",
    por_que:
      "Conteúdo que admite dois lados legítimos gera conversa. Conversa é o que a plataforma promove.",
    exemplos_de_tema: [
      "Uma prática comum na sua área que merece discussão",
      "O que você faria no lugar do cliente",
      "Onde a lei e o senso de justiça não se encontram",
    ],
  },
  frequencia: {
    nome: "Série de formato fixo",
    por_que:
      "Um formato que se repete elimina a decisão mais cara da semana — a de o que postar — e é o que sustenta constância.",
    exemplos_de_tema: [
      "Uma dúvida do atendimento por semana",
      "O termo jurídico da semana em linguagem de cliente",
      "O que mudou nesta semana na sua área",
    ],
  },
};

const PILAR_PADRAO: Pilar = {
  nome: "Tradução do jurídico para o cotidiano",
  por_que:
    "O que é óbvio para você não é para quem precisa do serviço. Traduzir é o trabalho que mais aproxima.",
  exemplos_de_tema: [
    "O que esse termo significa na prática",
    "O que acontece depois que o processo começa",
    "Quanto tempo isso realmente leva",
  ],
};

/**
 * Aberturas no estilo escolhido, já na área da pessoa.
 *
 * Não dá para reusar o `exemplo` de `ESTILOS` aqui: aqueles textos são todos
 * de previdenciário, porque servem para a pessoa RECONHECER um tom na hora de
 * escolher. Entregar um deles como gancho pronto para quem trabalha com
 * criminal ou tributário denuncia na hora que o relatório é de prateleira.
 *
 * Estes são estruturais o suficiente para funcionar em qualquer área, e a área
 * entra no texto para o gancho sair utilizável sem edição.
 */
function ganchosPara(estilo: string, area: string): Gancho[] {
  const a = area.toLowerCase();

  const porEstilo: Record<string, Gancho> = {
    A: {
      formato: "Abertura direta",
      texto: `Se você trabalha com ${a}, tem um erro que eu vejo direto e que custa caro para o cliente.`,
    },
    B: {
      formato: "Abertura em conversa",
      texto: `Esses dias me perguntaram uma coisa sobre ${a} que eu escuto praticamente toda semana…`,
    },
    C: {
      formato: "Abertura que contraria",
      texto: `Talvez tenham te contado errado sobre como ${a} funciona na prática.`,
    },
    D: {
      formato: "Abertura que anuncia a estrutura",
      texto: `Existem três situações em ${a} que mudam completamente o resultado — e a maioria conhece só uma.`,
    },
    E: {
      formato: "Abertura por caso",
      texto:
        "Semana passada chegou uma pessoa aqui no escritório convencida de que não tinha direito a nada.",
    },
  };

  return [
    porEstilo[estilo] ?? porEstilo["A"]!,
    {
      formato: "Abertura por erro comum",
      texto: `Quem trabalha com ${a} vê esse erro toda semana — e ele só aparece quando já é tarde.`,
    },
    {
      formato: "Abertura por pergunta do cliente",
      texto:
        "Me perguntaram isso ontem no atendimento e eu percebi que quase ninguém sabe a resposta.",
    },
  ];
}

/**
 * Monta um relatório a partir das respostas, sem chamar modelo nenhum.
 *
 * Não é genérico: usa área, situação, objetivos e o estilo escolhido. Quem
 * recebe esta versão recebe menos nuance que a versão gerada, mas recebe algo
 * verdadeiro sobre o que respondeu.
 */
export function dnaViralCurado(r: Respostas): DnaViral {
  // "Outro" é o rótulo do botão, não uma área: quem marcou escreveu a dela em
  // `area_outro`, e é esse texto que precisa entrar nos ganchos. Sem isso sai
  // "quem trabalha com outro".
  const area =
    (r.area_atuacao === "outro" ? r.area_outro?.trim() : labelArea(r.area_atuacao)) || "a sua área";
  const situacao = r.situacao ?? "nao_sei_postar";

  const arq = ARQUETIPO_POR_SITUACAO[situacao] ?? ARQUETIPO_POR_SITUACAO["nao_sei_postar"]!;
  const trava = TRAVA_POR_SITUACAO[situacao] ?? TRAVA_POR_SITUACAO["nao_sei_postar"]!;

  const objetivos = r.objetivos ?? [];
  const pilares = objetivos
    .map((o) => PILARES_POR_OBJETIVO[o])
    .filter((p): p is Pilar => Boolean(p));
  while (pilares.length < 3) {
    const faltando = Object.values(PILARES_POR_OBJETIVO).find(
      (p) => !pilares.some((atual) => atual.nome === p.nome),
    );
    pilares.push(faltando ?? PILAR_PADRAO);
    if (!faltando) break;
  }

  const estilo = ESTILOS.find((e) => e.valor === r.estilo_narrativo) ?? ESTILOS[0]!;

  return {
    arquetipo: {
      nome: arq.nome,
      uma_linha: arq.uma_linha,
      descricao:
        `Em ${area.toLowerCase()}, o seu diferencial não vai vir de publicar mais que os outros — vai vir de ` +
        `publicar com uma posição reconhecível. O caminho mais curto para isso é escolher poucos temas e ` +
        `voltar neles com constância, até que o seu nome e o assunto passem a andar juntos na cabeça de quem assiste.`,
    },
    diagnostico: trava,
    pilares: pilares.slice(0, 3),
    ganchos: ganchosPara(estilo.valor, area),
    o_que_falta:
      "Este diagnóstico é uma fotografia. O que ele não faz é o trabalho de toda semana: descobrir o que " +
      "está performando agora na sua área, transformar isso em pauta com a sua voz e ter o roteiro pronto " +
      "nos dias em que você se comprometeu a publicar. É essa parte que a prevIA assume.",
  };
}
