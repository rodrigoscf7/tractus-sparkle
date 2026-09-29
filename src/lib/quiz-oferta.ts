/**
 * O quiz da oferta — público, anônimo, antes da compra.
 *
 * UMA CAMADA DE DADOS, DUAS CAMADAS DE COPY.
 *
 * Este arquivo grava exatamente o mesmo `Respostas` de
 * `onboarding-perguntas.ts`, com os mesmos valores de opção, importados de lá
 * e nunca redeclarados. O que muda é só o enunciado: lá a pergunta configura
 * uma ferramenta ("Qual sua área principal de atuação?"), aqui ela diagnostica
 * uma pessoa ("Qual é a sua principal área de atuação na advocacia hoje?").
 *
 * É isso que permite, depois da compra, semear o onboarding com o que já foi
 * respondido. Se alguém redeclarar uma lista de opções aqui, o import quebra
 * em silêncio — por isso `campo` é tipado como `keyof Respostas` e as opções
 * vêm todas de import.
 *
 * Uma pergunta por tela, ao contrário do onboarding, que agrupa 15 em 5
 * passos. Aqui cada resposta é um clique e a barra anda: num quiz de tráfego
 * frio, a sensação de avanço é o que segura a pessoa até o fim.
 *
 * A pergunta de percepção (A–D) não existe no onboarding: ela DERIVA
 * `atributos` e `estilo_narrativo`, que são o que o onboarding e os agentes
 * leem. É assim que o passo 3 fecha sem perguntar abertura e atributos
 * separados a tráfego frio.
 */

import {
  AREAS,
  CANAIS,
  DIAS_DA_SEMANA,
  ESTILOS,
  FREQUENCIA,
  MAX_OBJETIVOS,
  OBJETIVOS,
  PERCEPCOES,
  SITUACAO,
  TAMANHOS,
  TEMPO_PRODUCAO,
  labelArea,
  validarPasso,
  type Opcao,
  type Respostas,
} from "@/lib/onboarding-perguntas";

export type { Opcao, Respostas };

/** Widget que a pergunta usa. Cada um mapeia para uma primitiva de `components/onboarding/campos`. */
export type TipoPergunta =
  | "unica"
  | "multipla"
  | "estilo"
  | "dias"
  | "texto"
  | "texto_longo"
  | "sim_nao"
  | "contato";

export type Pergunta = {
  /** Onde a resposta é gravada. Tipado contra o `Respostas` do onboarding de propósito. */
  campo: keyof Respostas;
  tipo: TipoPergunta;
  titulo: string;
  apoio?: string;
  opcoes?: Opcao[];
  max?: number;
  colunas?: 1 | 2 | 3;
  placeholder?: string;
  /**
   * Campo de texto que só aparece quando a resposta principal pede.
   * É o padrão que o onboarding já usa para "Outro".
   */
  extra?: {
    campo: keyof Respostas;
    quando: (r: Respostas) => boolean;
    rotulo: string;
    placeholder: string;
  };
  /**
   * Campos derivados gravados junto com a resposta principal.
   * Usado pela percepção (→ atributos + estilo) e pelo objetivo "tudo"
   * (exclusivo: limpa os outros).
   */
  derivar?: (valor: unknown, r: Respostas) => Partial<Respostas>;
};

/**
 * Subconjunto de objetivos que a reunião pediu no quiz.
 * Valores importados de OBJETIVOS — só a copy muda (duas camadas).
 */
const LABELS_OBJETIVOS_QUIZ: Record<string, string> = {
  autoridade: "Construir autoridade",
  seguidores: "Crescer seguidores e alcance",
  clientes: "Atrair mais clientes",
  contratos: "Fechar mais contratos",
  frequencia: "Ter mais constância",
  tudo: "Tudo isso junto",
};
const ORDEM_OBJETIVOS_QUIZ = [
  "autoridade",
  "seguidores",
  "clientes",
  "contratos",
  "frequencia",
  "tudo",
] as const;

const OBJETIVOS_QUIZ: Opcao[] = ORDEM_OBJETIVOS_QUIZ.map((valor) => {
  const base = OBJETIVOS.find((o) => o.valor === valor);
  if (!base) throw new Error(`OBJETIVOS sem valor "${valor}" — não redeclarar aqui.`);
  return { valor: base.valor, label: LABELS_OBJETIVOS_QUIZ[valor] ?? base.label };
});

/**
 * Subconjunto de situações da reunião. Valores de SITUACAO;
 * demoro_roteiro e escalar ficam só no onboarding.
 */
const LABELS_SITUACAO_QUIZ: Record<string, string> = {
  nao_sei_postar: "Não sei o que postar",
  ideias_sem_conteudo: "Tenho ideias, mas não sei transformar em roteiro",
  sem_tempo: "Falta tempo para produzir",
  sem_constancia: "Gravo, mas não tenho constância",
  poucas_views: "Posto, mas os conteúdos não performam",
  views_sem_cliente: "Tenho alcance, mas não gera clientes",
};
const ORDEM_SITUACAO_QUIZ = [
  "nao_sei_postar",
  "ideias_sem_conteudo",
  "sem_tempo",
  "sem_constancia",
  "poucas_views",
  "views_sem_cliente",
] as const;

const SITUACAO_QUIZ: Opcao[] = ORDEM_SITUACAO_QUIZ.map((valor) => {
  const base = SITUACAO.find((o) => o.valor === valor);
  if (!base) throw new Error(`SITUACAO sem valor "${valor}" — não redeclarar aqui.`);
  return { valor: base.valor, label: LABELS_SITUACAO_QUIZ[valor] ?? base.label };
});

/**
 * Percepção A–D → atributos + estilo narrativo.
 *
 * Autoridade/sofisticação mapeia para Professor (D), não Direto: o tom
 * sofisticado combina com estrutura didática, não com abertura brusca.
 */
const DERIVACAO_PERCEPCAO: Record<
  string,
  { estilo: string; atributos: string[] }
> = {
  A: { estilo: "D", atributos: ["autoridade", "sofisticado", "elegante"] },
  B: { estilo: "B", atributos: ["acolhedor", "didatico", "popular"] },
  C: { estilo: "A", atributos: ["direto", "tecnico"] },
  D: { estilo: "C", atributos: ["bem_humorado", "popular", "energico"] },
};

/**
 * As 11 perguntas, em quatro blocos com escalada de investimento:
 *
 *   1–2  Reconhecimento — área e cliente. Fricção baixa na entrada.
 *   3–4  Ambição        — objetivos e como quer ser percebido.
 *   5–8  Verdade        — o que trava, frequência, tempo, canais.
 *   9–11 Identificação  — tamanho, nome e contato (obrigatório).
 */
export const PERGUNTAS: Pergunta[] = [
  // ---- Bloco 1 · Reconhecimento -------------------------------------------
  {
    campo: "area_atuacao",
    tipo: "unica",
    titulo: "Qual é a sua principal área de atuação na advocacia hoje?",
    opcoes: AREAS,
    colunas: 2,
    extra: {
      campo: "area_outro",
      quando: (r) => r.area_atuacao === "outro",
      rotulo: "Sua área",
      placeholder: "Qual é a sua área?",
    },
  },
  {
    campo: "cliente_ideal",
    tipo: "texto_longo",
    titulo: "Hoje, quem é o cliente que você mais gostaria de atrair pelo Instagram?",
    placeholder: "Ex.: Gestantes sem carteira assinada",
  },

  // ---- Bloco 2 · Ambição ---------------------------------------------------
  {
    campo: "objetivos",
    tipo: "multipla",
    titulo: "Qual é o objetivo principal que você quer alcançar com as redes sociais hoje?",
    apoio: `Escolha até ${MAX_OBJETIVOS}.`,
    opcoes: OBJETIVOS_QUIZ,
    max: MAX_OBJETIVOS,
    colunas: 2,
    derivar: (valor) => {
      const lista = Array.isArray(valor) ? (valor as string[]) : [];
      // "Tudo isso junto" é exclusivo: se marcado, limpa os outros.
      if (lista.includes("tudo") && lista.length > 1) {
        return { objetivos: ["tudo"] };
      }
      return {};
    },
  },
  {
    campo: "percepcao",
    tipo: "unica",
    titulo: "Como você gostaria que o seu escritório fosse percebido no ambiente digital?",
    opcoes: PERCEPCOES,
    colunas: 1,
    derivar: (valor) => {
      const chave = typeof valor === "string" ? valor : "";
      const mapa = DERIVACAO_PERCEPCAO[chave];
      if (!mapa) return {};
      return {
        estilo_narrativo: mapa.estilo,
        atributos: mapa.atributos,
      };
    },
  },

  // ---- Bloco 3 · Verdade ---------------------------------------------------
  {
    campo: "situacao",
    tipo: "unica",
    titulo: "O que acontece hoje quando você senta pra gravar?",
    apoio: "É a resposta que mais pesa no seu diagnóstico.",
    opcoes: SITUACAO_QUIZ,
    colunas: 1,
  },
  {
    campo: "frequencia_atual",
    tipo: "unica",
    titulo: "Com que frequência você publica conteúdo hoje nas redes sociais?",
    opcoes: FREQUENCIA,
    colunas: 1,
  },
  {
    campo: "tempo_producao",
    tipo: "unica",
    titulo:
      "Quanto tempo você costuma gastar pensando, roteirizando e criando um único post ou vídeo?",
    opcoes: TEMPO_PRODUCAO,
    colunas: 1,
  },
  {
    campo: "canais",
    tipo: "multipla",
    titulo: "Onde você publica conteúdo atualmente?",
    apoio: "Pode marcar mais de um.",
    opcoes: CANAIS,
    max: CANAIS.length,
    colunas: 2,
  },

  // ---- Bloco 4 · Identificação --------------------------------------------
  {
    campo: "tamanho_escritorio",
    tipo: "unica",
    titulo: "Quantas pessoas tocam o escritório com você?",
    apoio: "Muda o quanto de produção dá para sustentar.",
    opcoes: TAMANHOS,
    colunas: 3,
  },
  {
    campo: "nome",
    tipo: "texto",
    titulo: "Como você quer ser chamado?",
    apoio: "O relatório é escrito pra você, no seu nome.",
    placeholder: "Seu nome",
  },
  {
    campo: "email",
    tipo: "contato",
    titulo: "E por último, qual o seu melhor e-mail e WhatsApp?",
    apoio:
      "Usamos só para entregar o diagnóstico e falar sobre ele. Sem spam.",
  },
];

export const TOTAL_PERGUNTAS = PERGUNTAS.length;

/** Dias da semana, reexportado para o wizard não precisar importar do onboarding. */
export { DIAS_DA_SEMANA, ESTILOS, PERCEPCOES };

/** Label legível da percepção escolhida. */
export function labelPercepcao(valor?: string): string {
  return PERCEPCOES.find((p) => p.valor === valor)?.label ?? "";
}

/**
 * Nenhuma pergunta é opcional neste funil: tamanho e tráfego pagos saíram
 * do conjunto de "pular", e tráfego pago saiu do quiz.
 */
export function ehOpcional(_indice: number): boolean {
  return false;
}

const EMAIL_RE = /^[^@\s]+@[^@\s.]+\.[^@\s]+$/;

/** Normaliza WhatsApp para só dígitos (aceita +55 e máscara). */
export function digitosWhatsapp(bruto: string): string {
  return bruto.replace(/\D/g, "");
}

export function emailValido(email: string): boolean {
  const e = email.trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254;
}

export function whatsappValido(bruto: string): boolean {
  const d = digitosWhatsapp(bruto);
  // 10–11 (BR sem DDI) ou 12–13 (com 55).
  if (d.length >= 10 && d.length <= 11) return true;
  if (d.length >= 12 && d.length <= 13 && d.startsWith("55")) return true;
  return false;
}

/**
 * Valida uma pergunta (1-based) e devolve o erro em linguagem de usuário.
 * `null` significa que pode avançar.
 */
export function validarPergunta(indice: number, r: Respostas): string | null {
  const pergunta = PERGUNTAS[indice - 1];
  if (!pergunta) return null;

  if (pergunta.tipo === "contato") {
    if (!r.email?.trim() || !emailValido(r.email)) {
      return "Confira o e-mail digitado.";
    }
    if (!r.whatsapp?.trim() || !whatsappValido(r.whatsapp)) {
      return "Confira o WhatsApp (DDD + número).";
    }
    return null;
  }

  const valor = r[pergunta.campo];

  switch (pergunta.tipo) {
    case "unica":
    case "estilo":
      if (!valor) return "Escolha uma opção para continuar.";
      break;
    case "sim_nao":
      if (typeof valor !== "boolean") return "Escolha uma opção para continuar.";
      break;
    case "multipla": {
      const lista = Array.isArray(valor) ? valor : [];
      if (!lista.length) return "Escolha pelo menos uma opção.";
      break;
    }
    case "dias": {
      const dias = Array.isArray(valor) ? valor : [];
      if (!dias.length) return "Escolha ao menos um dia da semana.";
      break;
    }
    case "texto":
    case "texto_longo":
      if (typeof valor !== "string" || !valor.trim()) return "Preencha para continuar.";
      break;
  }

  if (pergunta.extra?.quando(r)) {
    const complemento = r[pergunta.extra.campo];
    if (typeof complemento !== "string" || !complemento.trim()) {
      return `Preencha "${pergunta.extra.rotulo}" para continuar.`;
    }
  }

  // Percepção precisa ter derivado estilo + atributos (senão o passo 3 do
  // onboarding fica pendente sem a pessoa ter como saber).
  if (pergunta.campo === "percepcao") {
    if (!r.estilo_narrativo || !(r.atributos ?? []).length) {
      return "Escolha uma opção para continuar.";
    }
  }

  return null;
}

/**
 * A linha curta que aparece depois da resposta.
 *
 * Reconhece o que a pessoa disse e diz o que aquilo faz no relatório — vira
 * conversa em vez de formulário, e constrói expectativa pelo que vem.
 *
 * REGRA: nada de estatística inventada, escassez falsa ou prova social
 * fabricada. O público é advogado e identifica isso na hora; a oferta inteira
 * depende da confiança que uma frase inventada destruiria. Opinião profissional
 * declarada, sim. Número que a gente não mediu, não.
 */
const RECONHECIMENTO_SITUACAO: Record<string, string> = {
  ideias_sem_conteudo:
    "Anotado. O gargalo não é repertório: é o caminho entre a ideia e o roteiro.",
  nao_sei_postar: "Anotado. Costuma ser falta de pauta, não falta de assunto.",
  demoro_roteiro: "Anotado. Isso é gargalo de processo, não de ideia.",
  sem_constancia:
    "Anotado. Gravar sem sistema vira esforço esporádico, e autoridade precisa de presença.",
  poucas_views: "Anotado. A abertura entra como prioridade no seu diagnóstico.",
  views_sem_cliente: "Anotado. Alcance sem posicionamento traz audiência, não cliente.",
  sem_tempo: "Anotado. Então o seu plano precisa caber na semana real, não numa ideal.",
  escalar: "Anotado. Volume sem constância vira esforço sem efeito. Seu DNA parte daí.",
};

const RECONHECIMENTO_FREQUENCIA: Record<string, string> = {
  diaria: "Ritmo alto. O diagnóstico vai olhar se o esforço está virando resultado.",
  "3_5": "Bom volume. O que pesa agora é o que cada peça entrega.",
  "1_2": "Ritmo sustentável. O ganho vem de cada publicação valer mais.",
  raramente: "Anotado. Sem sistema, o perfil some entre um prazo e outro.",
  parado: "Começar do zero é mais simples do que corrigir um perfil desalinhado.",
};

const RECONHECIMENTO_TEMPO: Record<string, string> = {
  ate_15: "Processo leve. O diagnóstico foca no que falta para converter.",
  "15_30": "Tempo razoável. Dá para enxugar ainda mais com estrutura pronta.",
  "30_60": "Anotado. Uma hora por peça é o limite antes de a produção virar dívida.",
  mais_2h: "Anotado. Tempo demais por peça é o que mata a constância.",
  travo: "Anotado. Travamento na tela em branco é falta de pauta, não de vontade.",
};

export function reconhecimento(indice: number, r: Respostas): string | null {
  const pergunta = PERGUNTAS[indice - 1];
  if (!pergunta) return null;

  if (pergunta.campo === "situacao" && r.situacao) {
    return RECONHECIMENTO_SITUACAO[r.situacao] ?? null;
  }

  if (pergunta.campo === "frequencia_atual" && r.frequencia_atual) {
    return RECONHECIMENTO_FREQUENCIA[r.frequencia_atual] ?? null;
  }

  if (pergunta.campo === "tempo_producao" && r.tempo_producao) {
    return RECONHECIMENTO_TEMPO[r.tempo_producao] ?? null;
  }

  if (pergunta.campo === "canais" && (r.canais ?? []).includes("nenhum")) {
    return "Começar do zero é mais simples do que corrigir um perfil desalinhado.";
  }

  return null;
}

/**
 * Quais passos do onboarding as respostas do quiz já satisfazem.
 *
 * É a função que sustenta a promessa de não responder duas vezes: roda a
 * validação REAL do onboarding (não uma cópia dela) contra o que o quiz
 * coletou. Usada na costura pós-compra e na verificação de paridade.
 *
 * Com as 11 perguntas atuais (percepção derivando estilo + atributos, sem
 * ritmo_dias), os passos 1, 2 e 3 fecham. Sobram o 4 (referências) e o 5
 * (compromisso de dias) — os dois pedem fricção alta demais para tráfego frio.
 */
export function passosPendentes(r: Respostas): number[] {
  const pendentes: number[] = [];
  for (let passo = 1; passo <= 5; passo++) {
    if (validarPasso(passo, r).length > 0) pendentes.push(passo);
  }
  return pendentes;
}

/**
 * O que mostrar na tela de continuidade, depois da compra.
 *
 * A pessoa precisa VER o que foi aproveitado — é o que transforma "não
 * perguntamos de novo" em uma economia perceptível em vez de um silêncio.
 * Só campos que ela reconhece como tendo respondido.
 */
export function resumoDoQuiz(r: Respostas): { rotulo: string; valor: string }[] {
  const itens: { rotulo: string; valor: string }[] = [];

  const area = r.area_atuacao === "outro" ? r.area_outro : labelArea(r.area_atuacao);
  if (area) itens.push({ rotulo: "Sua área", valor: area });
  if (r.nicho?.trim()) itens.push({ rotulo: "Seu recorte", valor: r.nicho.trim() });

  const objetivos = (r.objetivos ?? []).map((v) => rotulo(OBJETIVOS, v)).filter(Boolean);
  if (objetivos.length) itens.push({ rotulo: "O que você busca", valor: objetivos.join(", ") });

  const percepcao = labelPercepcao(r.percepcao);
  if (percepcao) itens.push({ rotulo: "Como quer ser percebido", valor: percepcao });

  return itens;
}

function rotulo(opcoes: Opcao[], valor: string): string {
  return opcoes.find((o) => o.valor === valor)?.label ?? "";
}
