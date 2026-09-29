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
 *
 * O score NUNCA vem do modelo: é calculado em `dna-viral-score.ts` e injetado
 * antes de gravar. O normalizador ignora qualquer score do JSON do agente.
 */

import { ESTILOS, labelArea, type Respostas } from "@/lib/onboarding-perguntas";
import {
  calcularScore,
  type DimensaoScore,
} from "@/lib/dna-viral-score";

export type Roteiro = {
  /** Nome curto do formato (ex.: "Curiosidade & Alerta"). */
  formato: string;
  /** Abertura pronta para gravar. */
  gancho: string;
  /** Desenvolvimento: 2–4 frases do miolo. */
  desenvolvimento: string;
  /** Fecho / CTA editorial (sem mercantilizar serviço). */
  fecho: string;
};

/** @deprecated Use Roteiro. Mantido só para ler leads antigos. */
export type Gancho = { formato: string; texto: string };

export type Pilar = {
  nome: string;
  por_que: string;
  exemplos_de_tema: string[];
};

export type Gargalo = { titulo: string; texto: string };

export type Arquetipo = { nome: string; uma_linha: string; descricao: string };

export type DnaViral = {
  /**
   * Presente só quando há substância (área + situação + cliente ou percepção).
   * Sem isso a página omite o bloco — evita rótulo genérico de prateleira.
   */
  arquetipo: Arquetipo | null;
  /** Três gargalos. Leads antigos podem ter só um (convertido de `diagnostico`). */
  gargalos: Gargalo[];
  pilares: Pilar[];
  /** Três roteiros completos (gancho + desenvolvimento + fecho). */
  roteiros: Roteiro[];
  o_que_falta: string;
  /**
   * Score determinístico. Ausente em leads gerados antes desta versão —
   * a página não renderiza o painel quando faltar.
   */
  score?: DimensaoScore[];
};

/**
 * Há subsídio suficiente para um arquétipo sem superficialidade?
 * Exige área (ou area_outro), situação e ao menos cliente_ideal ou percepção.
 */
export function temSubsidioArquetipo(r: Respostas): boolean {
  const areaOk =
    (r.area_atuacao && r.area_atuacao !== "outro") ||
    Boolean(r.area_outro?.trim());
  const situacaoOk = Boolean(r.situacao);
  const especificidadeOk =
    Boolean(r.cliente_ideal?.trim()) || Boolean(r.percepcao);
  return Boolean(areaOk && situacaoOk && especificidadeOk);
}

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
 *
 * Aceita o contrato novo (`gargalos` + `roteiros`) e o antigo (`diagnostico` +
 * `ganchos`), convertendo o que der — leads já gravados continuam legíveis.
 *
 * Ignora qualquer `score` vindo do modelo: quem chama injeta o calculado.
 */
export function normalizarDnaViral(bruto: unknown): DnaViral | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;

  const arq = (o.arquetipo ?? {}) as Record<string, unknown>;
  const nome = texto(arq.nome);
  const umaLinha = texto(arq.uma_linha);
  const descricao = texto(arq.descricao);
  // Arquétipo opcional: se incompleto, some do relatório em vez de inventar.
  const arquetipo: Arquetipo | null =
    nome && umaLinha && descricao
      ? { nome, uma_linha: umaLinha, descricao }
      : null;

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

  const roteiros = lerRoteiros(o);
  if (!pilares.length || !roteiros.length) return null;

  const gargalos = lerGargalos(o);
  if (!gargalos.length) return null;

  return {
    arquetipo,
    gargalos,
    pilares,
    roteiros,
    o_que_falta: texto(o.o_que_falta) ?? "",
  };
}

/** Preferência: `roteiros[]`. Fallback: `ganchos[]` antigo → roteiro só com gancho. */
function lerRoteiros(o: Record<string, unknown>): Roteiro[] {
  if (Array.isArray(o.roteiros)) {
    return o.roteiros
      .map((item) => {
        const r = (item ?? {}) as Record<string, unknown>;
        return {
          formato: texto(r.formato) ?? "",
          gancho: texto(r.gancho) ?? "",
          desenvolvimento: texto(r.desenvolvimento) ?? "",
          fecho: texto(r.fecho) ?? "",
        };
      })
      .filter((r) => r.gancho && r.desenvolvimento && r.fecho);
  }

  // Leads antigos: um gancho vira roteiro incompleto mas legível.
  if (Array.isArray(o.ganchos)) {
    return o.ganchos
      .map((g) => {
        const item = (g ?? {}) as Record<string, unknown>;
        const gancho = texto(item.texto) ?? "";
        if (!gancho) return null;
        return {
          formato: texto(item.formato) ?? "",
          gancho,
          desenvolvimento: "",
          fecho: "",
        };
      })
      .filter((r): r is Roteiro => Boolean(r));
  }

  return [];
}

/** Preferência: `gargalos[]`. Fallback: `diagnostico` antigo → 1 gargalo. */
function lerGargalos(o: Record<string, unknown>): Gargalo[] {
  if (Array.isArray(o.gargalos)) {
    return o.gargalos
      .map((g) => {
        const item = (g ?? {}) as Record<string, unknown>;
        return {
          titulo: texto(item.titulo) ?? "",
          texto: texto(item.texto) ?? "",
        };
      })
      .filter((g) => g.titulo && g.texto);
  }

  const diag = (o.diagnostico ?? {}) as Record<string, unknown>;
  const oQueTrava = texto(diag.o_que_trava);
  const porQue = texto(diag.por_que);
  if (oQueTrava) {
    return [{ titulo: oQueTrava, texto: porQue ?? oQueTrava }];
  }
  return [];
}

/**
 * Injeta o score calculado no relatório. Chamado em `gerarComFallback`
 * antes de gravar — nunca confia no modelo para os percentuais.
 */
export function comScore(relatorio: DnaViral, r: Respostas): DnaViral {
  return { ...relatorio, score: calcularScore(r) };
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
  sem_constancia: {
    nome: "A Presença Intermitente",
    uma_linha: "Você grava. O que falta é o sistema que impede a semana de engolir o perfil.",
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

/** Gargalo principal por situação — o #1 do relatório curado. */
const GARGALO_PRINCIPAL: Record<string, Gargalo> = {
  ideias_sem_conteudo: {
    titulo: "Distância entre a ideia e o roteiro",
    texto:
      "Ideia não vira conteúdo por esforço, vira por processo. Sem um formato fixo para atravessar da anotação até a gravação, cada publicação recomeça do zero — e recomeçar é caro demais para acontecer toda semana.",
  },
  nao_sei_postar: {
    titulo: "Falta de critério para escolher o tema",
    texto:
      "Quem atende todo dia tem assunto de sobra: o que falta é um critério para decidir qual dúvida do cliente vira publicação. Sem esse critério, a página em branco ganha da agenda.",
  },
  demoro_roteiro: {
    titulo: "Tempo excessivo de produção por peça",
    texto:
      "Escrever cada roteiro do zero cobra a mesma energia toda vez. Com estruturas fixas de abertura e desenvolvimento, o esforço cai para o que realmente muda entre um conteúdo e outro: o caso.",
  },
  sem_constancia: {
    titulo: "Ausência de sistema de publicação",
    texto:
      "Tentar inventar ideias do zero no intervalo entre um prazo, uma audiência e um atendimento consome sua energia. A falta de um sistema faz com que você fique semanas sem postar, destruindo sua constância e a autoridade do seu escritório.",
  },
  poucas_views: {
    titulo: "Falta de ganchos de alta retenção nos primeiros 3 segundos",
    texto:
      "As pessoas no Instagram tomam a decisão de continuar assistindo a um vídeo em menos de 3 segundos. Sem uma abertura estratégica validada no Direito, até o seu melhor conteúdo técnico é ignorado pelo algoritmo.",
  },
  views_sem_cliente: {
    titulo: "Ponte quebrada entre audiência e procura",
    texto:
      "Alcance responde a formato; procura responde a posicionamento. Sem deixar claro para quem você resolve e o que acontece depois do contato, a audiência assiste e segue adiante.",
  },
  sem_tempo: {
    titulo: "Ritmo que não cabe na semana real",
    texto:
      "Plano de conteúdo que não cabe na rotina real não é plano, é dívida. O ritmo precisa ser dimensionado pela pior semana do mês, não pela melhor.",
  },
  escalar: {
    titulo: "Dependência de você em cada etapa",
    texto:
      "Produção que passa inteira pela sua cabeça tem teto na sua agenda. Escalar exige que pauta e roteiro cheguem prontos para você decidir, não para você criar.",
  },
};

/** Gargalos auxiliares derivados das dimensões de score mais baixas. */
const GARGALO_POR_DIMENSAO: Record<DimensaoScore["chave"], Gargalo> = {
  clareza: {
    titulo: "Posicionamento ainda genérico no feed",
    texto:
      "Sem um recorte claro de para quem você fala, o conteúdo compete com todo mundo da sua área. Clareza de cliente e de percepção é o que faz o algoritmo — e o cliente — te reconhecer.",
  },
  frequencia: {
    titulo: "Presença irregular que apaga autoridade",
    texto:
      "Autoridade no digital se constrói com presença repetida. Semanas sem publicar resetam o reconhecimento que o perfil já tinha conquistado.",
  },
  potencial_viral: {
    titulo: "Aberturas que não seguram os primeiros segundos",
    texto:
      "Mesmo com bom conteúdo no meio do vídeo, a decisão de continuar acontece antes. Sem gancho validado, o alcance fica preso na bolha atual.",
  },
  conexao: {
    titulo: "Conteúdo que informa, mas não aproxima",
    texto:
      "Explicar bem a lei não basta se a pessoa não se vê no problema. Sem conexão com a dor concreta do cliente ideal, o vídeo gera view e não gera conversa.",
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
  contratos: {
    nome: "Critério de decisão na contratação",
    por_que:
      "Quem está perto de fechar precisa de clareza sobre o próximo passo — não de mais informação genérica.",
    exemplos_de_tema: [
      "O que muda quando você tem um advogado desde o início",
      "Sinais de que o caso precisa de acompanhamento profissional",
      "Como escolher quem vai te representar",
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
  tudo: {
    nome: "Presença que atrai e posiciona",
    por_que:
      "Quando o objetivo é amplo, o caminho é conteúdo que ao mesmo tempo educa, posiciona e convida ao contato — sem diluir a voz.",
    exemplos_de_tema: [
      "O erro que mais atrasa quem está na sua situação",
      "O que muda quando alguém te encontra antes do problema piorar",
      "Uma dúvida da semana, respondida com a sua posição",
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
 * Três roteiros no estilo escolhido, já na área da pessoa.
 *
 * Não dá para reusar o `exemplo` de `ESTILOS` aqui: aqueles textos são todos
 * de previdenciário, porque servem para a pessoa RECONHECER um tom. Entregar
 * um deles como roteiro para quem trabalha com criminal denuncia prateleira.
 *
 * Cada peça tem gancho + desenvolvimento + fecho — a promessa da abertura.
 */
function roteirosPara(estilo: string, area: string, cliente: string): Roteiro[] {
  const a = area.toLowerCase();
  const c = cliente || "quem precisa do seu serviço";

  const aberturas: Record<string, string> = {
    A: `Se você está passando por isso em ${a}, nunca assine nenhum documento antes de checar o que eu vou falar agora.`,
    B: `Esses dias me perguntaram uma coisa sobre ${a} que eu escuto praticamente toda semana…`,
    C: `Talvez tenham te contado errado sobre como ${a} funciona na prática.`,
    D: `Existem três situações em ${a} que mudam completamente o caminho — e a maioria conhece só uma.`,
    E: `Semana passada chegou uma pessoa aqui no escritório convencida de que não tinha direito a nada.`,
  };

  return [
    {
      formato: "Curiosidade & Alerta",
      gancho: aberturas[estilo] ?? aberturas["A"]!,
      desenvolvimento:
        `O que ${c} quase nunca sabe é que o detalhe que parece burocrático é, na prática, ` +
        `o que define se o caso anda ou trava. Em ${a}, esse ponto aparece cedo — e quem ignora ` +
        `só descobre quando o prazo ou a prova já complicou.`,
      fecho:
        "Se isso te descreveu, salva este vídeo e revisa o que você já tem em mãos antes do próximo passo. " +
        "Dúvida específica? Deixa nos comentários — respondo com o que a prática mostra, não com teoria.",
    },
    {
      formato: "Quebra de Mito",
      gancho: `O maior erro que as pessoas cometem ao lidar com ${a} é achar que a Justiça funciona do jeito que deveria. Na prática…`,
      desenvolvimento:
        `O senso comum promete um caminho linear. O que ${c} encontra é outro: prazos, documentos e ` +
        `interpretações que mudam o resultado sem aviso. Quem entende isso cedo evita decisões caras ` +
        `tomadas no escuro.`,
      fecho:
        "Se você já ouviu o contrário disso, marca alguém que precisa ouvir. " +
        "E se quiser o próximo vídeo sobre o seu caso concreto, comenta a situação em uma frase.",
    },
    {
      formato: "Autoridade & Proteção",
      gancho:
        "Três direitos que a maioria das pessoas perde simplesmente porque não sabe que eles existem — e o número 2 é o mais comum.",
      desenvolvimento:
        `Em ${a}, esses direitos não são detalhe: são o que separa quem chega preparado de quem ` +
        `improvisa. O segundo, em especial, é o que ${c} deixa passar com mais frequência — ` +
        `porque parece óbvio demais para checar.`,
      fecho:
        "Anota os três. Na dúvida, volta neste vídeo antes de qualquer assinatura ou prazo. " +
        "Quer que eu aprofunde um deles? Diz qual nos comentários.",
    },
  ];
}

/**
 * Monta três gargalos: o principal da situação + os dois das dimensões
 * de score mais baixas (diferentes do tema do principal, quando possível).
 */
function gargalosCurados(r: Respostas, score: DimensaoScore[]): Gargalo[] {
  const situacao = r.situacao ?? "nao_sei_postar";
  const principal =
    GARGALO_PRINCIPAL[situacao] ?? GARGALO_PRINCIPAL["nao_sei_postar"]!;

  const ordenado = [...score].sort((a, b) => a.valor - b.valor);
  const auxiliares: Gargalo[] = [];
  for (const dim of ordenado) {
    const g = GARGALO_POR_DIMENSAO[dim.chave];
    if (!g) continue;
    if (g.titulo === principal.titulo) continue;
    if (auxiliares.some((a) => a.titulo === g.titulo)) continue;
    auxiliares.push(g);
    if (auxiliares.length >= 2) break;
  }

  while (auxiliares.length < 2) {
    const faltando = Object.values(GARGALO_POR_DIMENSAO).find(
      (g) =>
        g.titulo !== principal.titulo &&
        !auxiliares.some((a) => a.titulo === g.titulo),
    );
    if (!faltando) break;
    auxiliares.push(faltando);
  }

  return [principal, ...auxiliares.slice(0, 2)];
}

/**
 * Monta um relatório a partir das respostas, sem chamar modelo nenhum.
 *
 * Não é genérico: usa área, situação, objetivos e o estilo (derivado da
 * percepção). Quem recebe esta versão recebe menos nuance que a versão
 * gerada, mas recebe algo verdadeiro sobre o que respondeu.
 */
export function dnaViralCurado(r: Respostas): DnaViral {
  // "Outro" é o rótulo do botão, não uma área: quem marcou escreveu a dela em
  // `area_outro`, e é esse texto que precisa entrar nos roteiros. Sem isso sai
  // "quem trabalha com outro".
  const area =
    (r.area_atuacao === "outro" ? r.area_outro?.trim() : labelArea(r.area_atuacao)) || "a sua área";
  const situacao = r.situacao ?? "nao_sei_postar";
  const score = calcularScore(r);
  const cliente = r.cliente_ideal?.trim() || "";

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

  let arquetipo: Arquetipo | null = null;
  if (temSubsidioArquetipo(r)) {
    const arq = ARQUETIPO_POR_SITUACAO[situacao] ?? ARQUETIPO_POR_SITUACAO["nao_sei_postar"]!;
    const clienteTrecho = cliente
      ? ` O cliente que você descreveu — ${cliente} — é o filtro: cada peça precisa falar com essa pessoa, não com “o jurídico” em geral.`
      : "";
    arquetipo = {
      nome: arq.nome,
      uma_linha: arq.uma_linha,
      descricao:
        `Em ${area.toLowerCase()}, o seu diferencial não vai vir de publicar mais que os outros — vai vir de ` +
        `publicar com uma posição reconhecível.${clienteTrecho} O caminho mais curto é escolher poucos temas e ` +
        `voltar neles com constância, até que o seu nome e o assunto passem a andar juntos na cabeça de quem assiste.`,
    };
  }

  return {
    arquetipo,
    gargalos: gargalosCurados(r, score),
    pilares: pilares.slice(0, 3),
    roteiros: roteirosPara(estilo.valor, area, cliente),
    o_que_falta:
      "Este diagnóstico é uma fotografia. O que ele não faz é o trabalho de toda semana: descobrir o que " +
      "está performando agora na sua área, transformar isso em pauta com a sua voz e ter o roteiro pronto " +
      "nos dias em que você se comprometeu a publicar. É essa parte que a prevIA assume.",
    score,
  };
}
