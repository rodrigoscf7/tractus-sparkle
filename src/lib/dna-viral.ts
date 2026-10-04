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

/**
 * Remove travessão tipográfico (— e –).
 *
 * Modelos usam isso o tempo todo; em português de profissional soa artificial.
 * Troca por ponto e capitaliza a sequência. Aplicado na normalização e no
 * fallback curado, para a tela nunca entregar esse traço.
 */
export function limparTravessao(entrada: string): string {
  return entrada
    .replace(/\s*[—–]\s*/g, ". ")
    .replace(/\.\s+([a-záàâãéêíóôõúç])/gi, (_m, letra: string) => `. ${letra.toUpperCase()}`)
    .replace(/\.\s*\./g, ".")
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Leitura defensiva: o JSON vem de um modelo, então nada é garantido. */
function texto(v: unknown): string | null {
  if (typeof v !== "string" || !v.trim()) return null;
  return limparTravessao(v.trim());
}

function lista(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v
    .map((i) => (typeof i === "string" ? limparTravessao(i.trim()) : ""))
    .filter(Boolean);
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

  return limparRelatorio({
    arquetipo,
    gargalos,
    pilares,
    roteiros,
    o_que_falta: texto(o.o_que_falta) ?? "",
  });
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

function palavras(s: string): number {
  return s.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Piso de profundidade dos roteiros, aplicado só na hora de GERAR.
 *
 * O contrato pede de 110 a 150 palavras por peça (30 a 50 segundos de fala).
 * Quando o modelo devolve três frases soltas, o relatório passa em todas as
 * validações de forma e chega raso na tela de quem acabou de clicar num
 * anúncio. Aqui é melhor cair no fallback curado, que é mais curto em nuance
 * mas é texto gravável.
 *
 * Não roda em `normalizarDnaViral` de propósito: leads já gravados (inclusive
 * os do formato antigo `ganchos`) continuam precisando abrir.
 */
export function roteirosTemProfundidade(relatorio: DnaViral): boolean {
  if (relatorio.roteiros.length < 3) return false;
  return relatorio.roteiros.every(
    (r) =>
      palavras(r.desenvolvimento) >= 45 &&
      palavras(`${r.gancho} ${r.desenvolvimento} ${r.fecho}`) >= 80,
  );
}

/**
 * Injeta o score calculado no relatório. Chamado em `gerarComFallback`
 * antes de gravar. Nunca confia no modelo para os percentuais.
 */
export function comScore(relatorio: DnaViral, r: Respostas): DnaViral {
  return limparRelatorio({ ...relatorio, score: calcularScore(r) });
}

/** Garante que nenhum campo de texto do relatório leve travessão à tela. */
function limparRelatorio(relatorio: DnaViral): DnaViral {
  return {
    ...relatorio,
    arquetipo: relatorio.arquetipo
      ? {
          nome: limparTravessao(relatorio.arquetipo.nome),
          uma_linha: limparTravessao(relatorio.arquetipo.uma_linha),
          descricao: limparTravessao(relatorio.arquetipo.descricao),
        }
      : null,
    gargalos: relatorio.gargalos.map((g) => ({
      titulo: limparTravessao(g.titulo),
      texto: limparTravessao(g.texto),
    })),
    pilares: relatorio.pilares.map((p) => ({
      nome: limparTravessao(p.nome),
      por_que: limparTravessao(p.por_que),
      exemplos_de_tema: p.exemplos_de_tema.map(limparTravessao),
    })),
    roteiros: relatorio.roteiros.map((rt) => ({
      formato: limparTravessao(rt.formato),
      gancho: limparTravessao(rt.gancho),
      desenvolvimento: limparTravessao(rt.desenvolvimento),
      fecho: limparTravessao(rt.fecho),
    })),
    o_que_falta: limparTravessao(relatorio.o_que_falta),
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
 * Quem assiste o conteúdo desta pessoa.
 *
 * Existe porque roteiro é escrito para uma audiência, não para uma área. Quem
 * faz mentoria para advogados fala com colegas: um roteiro sobre "a Justiça
 * não funciona como deveria" não diz nada para esse público. Errar isso é o
 * que faz o relatório parecer de prateleira.
 */
type Publico = "cliente" | "colega" | "empresa";

function publicoDe(r: Respostas): Publico {
  if (r.area_atuacao === "mentora") return "colega";
  if (r.area_atuacao === "empresarial" || r.area_atuacao === "tributario") return "empresa";

  // Quem marcou "Outro" escreveu a área à mão; o cliente ideal confirma.
  const livre = `${r.area_outro ?? ""} ${r.cliente_ideal ?? ""}`.toLowerCase();
  if (/advogad|escrit[óo]rio|coleg|mentoria|banca/.test(livre)) return "colega";
  if (/empres|cnpj|gestor|s[óo]cio|startup|neg[óo]cio|ind[úu]stria/.test(livre)) return "empresa";
  return "cliente";
}

/**
 * Aberturas do roteiro 1, por público e por estilo de narrativa.
 *
 * A área NÃO entra interpoladada no meio da frase. Texto de usuário colado
 * dentro de uma oração pronta quebra a concordância ("em mentoria para
 * advogados que mudam o caminho") e denuncia máquina na primeira linha.
 */
const ABERTURAS: Record<Publico, Record<string, string>> = {
  cliente: {
    A: "Tem um erro que eu vejo praticamente toda semana no atendimento, e ele custa caro. Presta atenção nos próximos trinta segundos.",
    B: "Semana passada me perguntaram uma coisa que eu escuto quase todo mês. E a resposta pega muita gente de surpresa.",
    C: "Se te disseram que é só entrar com o pedido e esperar, te contaram a versão fácil da história.",
    D: "Existem três momentos em que uma decisão errada muda todo o resultado. Vou te mostrar os três.",
    E: "Uma pessoa chegou aqui achando que já tinha perdido o prazo. Não tinha. Mas quase desistiu por causa disso.",
  },
  colega: {
    A: "Tem um erro que eu vejo em quase todo escritório que me procura, e ele cobra faturamento todo mês.",
    B: "Um advogado me disse uma frase semana passada que eu escuto o tempo todo. Ela explica por que o escritório não cresce.",
    C: "Se te disseram que é só trabalhar mais para o escritório crescer, te venderam a parte confortável da história.",
    D: "Existem três gargalos que travam o faturamento de um escritório. Vou te mostrar os três.",
    E: "Um escritório chegou aqui faturando bem num mês e quase nada no seguinte. O problema não era captação.",
  },
  empresa: {
    A: "Tem um erro que eu vejo em quase toda empresa que me procura, e ele só aparece quando já virou custo.",
    B: "Um gestor me perguntou uma coisa semana passada que eu escuto praticamente todo mês.",
    C: "Se te disseram que isso é só burocracia, te contaram justamente a versão que sai cara.",
    D: "Existem três pontos que mudam completamente o resultado de uma operação. Vou te mostrar os três.",
    E: "Uma empresa chegou aqui achando que estava tudo em ordem. Estava, no papel.",
  },
};

/**
 * Corpo dos três roteiros por público.
 *
 * Cada peça soma de 110 a 140 palavras, que é o que cabe em 30 a 50 segundos
 * de fala. O gancho do primeiro vem de `ABERTURAS`; os outros dois já nascem
 * completos porque o formato deles não depende do estilo de abertura.
 */
const CORPO_ROTEIROS: Record<
  Publico,
  [
    { formato: string; desenvolvimento: string; fecho: string },
    Roteiro,
    Roteiro,
  ]
> = {
  cliente: [
    {
      formato: "Curiosidade e alerta",
      desenvolvimento:
        "O que acontece é quase sempre a mesma coisa: a pessoa só procura orientação depois que o problema virou urgência. " +
        "Aí o que seria uma conversa de dez minutos vira uma discussão longa, com menos caminhos disponíveis. " +
        "E, na prática, o que atrapalha raramente é falta de direito. É falta de informação no momento certo. " +
        "Quando você entende o que está em jogo antes de assinar, antes do prazo e antes de aceitar a primeira proposta, " +
        "você decide com clareza em vez de decidir no susto.",
      fecho:
        "Se você está passando por algo parecido, salva este vídeo para não perder. " +
        "E me conta nos comentários em que ponto você está: eu respondo com o que a prática mostra, sem juridiquês.",
    },
    {
      formato: "Quebra de mito",
      gancho: "O maior mito sobre isso é achar que basta estar com a razão. Estar certo é só metade do caminho.",
      desenvolvimento:
        "Quem vai decidir o seu caso não acompanhou a sua vida. Essa pessoa olha documento, prazo e prova. " +
        "É por isso que duas situações praticamente iguais terminam diferente: uma chegou organizada e a outra chegou no limite. " +
        "O que muda o resultado quase nunca é um argumento genial. É ter reunido a coisa certa, no tempo certo, " +
        "e ter entendido desde o começo qual é a régua que está sendo aplicada. " +
        "Quem entende a régua joga o jogo. Quem não entende só torce.",
      fecho:
        "Se isso fez sentido, compartilha com quem está vivendo essa situação agora. " +
        "E se você quer que eu detalhe algum desses pontos, escreve nos comentários qual deles.",
    },
    {
      formato: "O que ninguém te conta",
      gancho: "Três coisas que a maioria das pessoas só descobre tarde demais. A número dois é a que mais aparece aqui.",
      desenvolvimento:
        "A primeira: prazo corre mesmo quando ninguém te avisa que ele começou. " +
        "A segunda: aquele documento parado no seu e-mail ou na galeria do celular vale muito mais do que a sua memória, " +
        "e é justamente o que quase todo mundo apaga. " +
        "A terceira: a primeira proposta que te oferecem raramente é a última. " +
        "Nenhuma dessas três exige conhecimento técnico. Exige só saber que elas existem antes de você precisar delas.",
      fecho:
        "Salva este vídeo para consultar quando precisar. " +
        "E se você quer que eu aprofunde uma dessas três, me diz o número nos comentários.",
    },
  ],
  colega: [
    {
      formato: "Curiosidade e alerta",
      desenvolvimento:
        "O escritório que não cresce raramente tem problema de competência técnica. Tem problema de previsibilidade. " +
        "Entra cliente por indicação, o mês fecha bem, e no mês seguinte ninguém sabe de onde vem o próximo. " +
        "Sem um canal que traga demanda de forma constante, o faturamento vira sorte. " +
        "E aí a agenda enche de trabalho operacional, sobra pouco tempo para construir presença, e o ciclo se repete no mês seguinte. " +
        "Previsibilidade não nasce de esforço. Nasce de sistema.",
      fecho:
        "Se o seu mês ainda depende de indicação, comenta a palavra previsibilidade aqui embaixo. " +
        "Eu abro esse ponto com detalhe no próximo vídeo.",
    },
    {
      formato: "Quebra de mito",
      gancho: "O maior mito da advocacia é achar que bom técnico atrai cliente sozinho. Não atrai.",
      desenvolvimento:
        "Quem te contrata não tem como avaliar a sua técnica antes de te contratar. " +
        "Essa pessoa avalia o que consegue perceber: clareza, segurança e a sensação de que você já resolveu um caso parecido com o dela. " +
        "É por isso que advogado excelente fica invisível enquanto advogado mediano e comunicativo lota a agenda. " +
        "Isso não é injustiça do mercado. É que competência que ninguém enxerga simplesmente não entra na conta de quem está decidindo.",
      fecho:
        "Se você se reconheceu nisso, marca um colega que precisa ouvir. " +
        "E me diz nos comentários qual parte é mais difícil para você hoje: começar a aparecer ou manter constância.",
    },
    {
      formato: "Os três gargalos",
      gancho: "Três coisas travam o crescimento de um escritório. A número dois é a mais comum e a mais silenciosa.",
      desenvolvimento:
        "A primeira: não existe critério para dizer não, então o escritório aceita qualquer causa e perde foco. " +
        "A segunda: tudo passa pelo sócio, e o teto de faturamento vira exatamente o tamanho da agenda dele. " +
        "A terceira: a presença digital depende de inspiração, então acontece em rajadas e some por semanas. " +
        "As três têm a mesma raiz, que é ausência de processo. " +
        "E nenhuma delas se resolve trabalhando mais horas.",
      fecho:
        "Se alguma dessas três te descreveu, comenta o número aqui embaixo. " +
        "Eu aprofundo a mais citada no próximo vídeo.",
    },
  ],
  empresa: [
    {
      formato: "Curiosidade e alerta",
      desenvolvimento:
        "A maior parte das empresas trata a parte jurídica como algo que se resolve depois, quando o problema aparecer. " +
        "O detalhe é que, quando ele aparece, as opções já diminuíram. " +
        "Contrato mal redigido, prazo perdido, obrigação acessória esquecida: nenhum desses custa caro no dia em que acontece. " +
        "Custa caro meses depois, com juros, multa ou um contrato que não protege quem deveria proteger. " +
        "Estrutura preventiva não é gasto. É exatamente o que evita o gasto maior.",
      fecho:
        "Se a sua empresa está nessa situação, salva este vídeo e revisa o que já está assinado. " +
        "Me conta nos comentários qual é a sua maior dúvida hoje.",
    },
    {
      formato: "Quebra de mito",
      gancho: "O maior mito é achar que contrato modelo baixado da internet protege a sua operação. Não protege.",
      desenvolvimento:
        "Modelo genérico foi escrito para um negócio que não é o seu. " +
        "Ele cobre o caso comum e ignora justamente o ponto em que a sua operação é diferente. " +
        "E é sempre nesse ponto que o conflito nasce. " +
        "Quando a discussão chega, o que vale não é a intenção das partes: é o que está escrito. " +
        "Um contrato bem feito não serve para você ganhar a discussão. Serve para que ela não precise acontecer.",
      fecho:
        "Se você usa modelo pronto hoje, comenta aqui embaixo. " +
        "No próximo vídeo eu mostro as três cláusulas que mais geram problema na prática.",
    },
    {
      formato: "Passivo silencioso",
      gancho: "Três pontos geram passivo sem ninguém perceber. O número dois aparece em quase toda empresa que analiso.",
      desenvolvimento:
        "O primeiro: acordo verbal com fornecedor ou com sócio que nunca virou documento. " +
        "O segundo: obrigação acessória entregue no automático, sem ninguém conferir se ela ainda corresponde à operação real. " +
        "O terceiro: contrato antigo que continua valendo enquanto o negócio já mudou de modelo. " +
        "Os três são silenciosos. Aparecem numa fiscalização, na saída de um sócio ou na ruptura com um cliente grande, " +
        "e nesse momento o custo já está formado.",
      fecho:
        "Se algum desses três existe na sua empresa hoje, comenta o número. " +
        "Eu detalho o mais citado no próximo vídeo.",
    },
  ],
};

/**
 * Três roteiros completos de 30 a 50 segundos, para o público certo.
 *
 * O estilo escolhido define só a abertura do primeiro; o resto é estrutura
 * fechada e revisada à mão. É o que garante que a versão sem IA continue
 * sendo algo que a pessoa grava hoje sem editar.
 */
function roteirosPara(estilo: string, publico: Publico): Roteiro[] {
  const aberturas = ABERTURAS[publico];
  const [primeiro, segundo, terceiro] = CORPO_ROTEIROS[publico];

  return [
    {
      formato: primeiro.formato,
      gancho: aberturas[estilo] ?? aberturas["A"]!,
      desenvolvimento: primeiro.desenvolvimento,
      fecho: primeiro.fecho,
    },
    segundo,
    terceiro,
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
    // O cliente ideal entra como citação, nunca como sujeito de uma oração
    // pronta: texto livre colado no meio de frase quebra a concordância.
    const clienteTrecho = cliente
      ? ` Você descreveu o seu público assim: "${cliente}". É esse o filtro de cada peça.`
      : "";
    arquetipo = {
      nome: arq.nome,
      uma_linha: arq.uma_linha,
      descricao:
        `Você atua com ${area}. Nesse terreno, o diferencial não vem de publicar mais que os outros. Vem de ` +
        `publicar com uma posição reconhecível.${clienteTrecho} O caminho mais curto é escolher poucos temas e ` +
        `voltar neles com constância, até que o seu nome e o assunto passem a andar juntos na cabeça de quem assiste.`,
    };
  }

  return limparRelatorio({
    arquetipo,
    gargalos: gargalosCurados(r, score),
    pilares: pilares.slice(0, 3),
    roteiros: roteirosPara(estilo.valor, publicoDe(r)),
    o_que_falta:
      "Este diagnóstico é uma fotografia. O que ele não faz é o trabalho de toda semana: descobrir o que " +
      "está performando agora na sua área, transformar isso em pauta com a sua voz e ter o roteiro pronto " +
      "nos dias em que você se comprometeu a publicar. É essa parte que a prevIA assume.",
    score,
  });
}
