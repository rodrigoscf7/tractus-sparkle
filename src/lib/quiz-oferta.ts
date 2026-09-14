/**
 * O quiz da oferta — público, anônimo, antes da compra.
 *
 * UMA CAMADA DE DADOS, DUAS CAMADAS DE COPY.
 *
 * Este arquivo grava exatamente o mesmo `Respostas` de
 * `onboarding-perguntas.ts`, com os mesmos valores de opção, importados de lá
 * e nunca redeclarados. O que muda é só o enunciado: lá a pergunta configura
 * uma ferramenta ("Qual sua área principal de atuação?"), aqui ela diagnostica
 * uma pessoa ("Em que área você quer ser o primeiro nome que vem à cabeça?").
 *
 * É isso que permite, depois da compra, semear o onboarding com o que já foi
 * respondido. Se alguém redeclarar uma lista de opções aqui, o import quebra
 * em silêncio — por isso `campo` é tipado como `keyof Respostas` e as opções
 * vêm todas de import.
 *
 * Uma pergunta por tela, ao contrário do onboarding, que agrupa 15 em 5
 * passos. Aqui cada resposta é um clique e a barra anda: num quiz de tráfego
 * frio, a sensação de avanço é o que segura a pessoa até o fim.
 */

import {
  AREAS,
  ATRIBUTOS,
  CANAIS,
  DIAS_DA_SEMANA,
  ESTILOS,
  MAX_ATRIBUTOS,
  MAX_OBJETIVOS,
  OBJETIVOS,
  SITUACAO,
  TAMANHOS,
  TRAFEGO,
  labelArea,
  validarPasso,
  type Opcao,
  type Respostas,
} from "@/lib/onboarding-perguntas";

export type { Opcao, Respostas };

/** Widget que a pergunta usa. Cada um mapeia para uma primitiva de `components/onboarding/campos`. */
export type TipoPergunta =
  "unica" | "multipla" | "estilo" | "dias" | "texto" | "texto_longo" | "sim_nao";

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
};

const SIM_NAO: Opcao[] = [
  { valor: "sim", label: "Sim" },
  { valor: "nao", label: "Ainda não" },
];

/**
 * As 12 perguntas, em quatro blocos com escalada de investimento:
 *
 *   1–3  Reconhecimento — um clique, sobre quem ela é. Fricção baixa na entrada.
 *   4–6  Ambição        — onde quer chegar. A pergunta de estilo é o pico.
 *   7–9  Verdade        — o que trava e com o que se compromete. É o que faz
 *                         o diagnóstico ser merecido em vez de adivinhado.
 *  10–12 Identificação  — qualificação de um clique e, por último, o nome:
 *                         a última tela antes da recompensa promete a recompensa.
 */
export const PERGUNTAS: Pergunta[] = [
  // ---- Bloco 1 · Reconhecimento -------------------------------------------
  {
    campo: "area_atuacao",
    tipo: "unica",
    titulo: "Em que área você quer ser o primeiro nome que vem à cabeça?",
    apoio: "É por ela que a prevIA procura o que está funcionando agora.",
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
    campo: "tem_nicho",
    tipo: "sim_nao",
    titulo: "Dentro dessa área, você já tem um recorte?",
    apoio: "Um recorte estreita a concorrência. Se ainda não tem, dá para chegar nele depois.",
    opcoes: SIM_NAO,
    colunas: 2,
    extra: {
      campo: "nicho",
      quando: (r) => r.tem_nicho === true,
      rotulo: "Seu recorte",
      placeholder: "Ex.: benefício por incapacidade para autônomos",
    },
  },
  {
    campo: "cliente_ideal",
    tipo: "texto_longo",
    titulo: "Quem precisa te achar antes de procurar outro advogado?",
    apoio:
      "Descreva como se falasse de um cliente real: a situação, a urgência, o que essa pessoa já tentou sozinha.",
    placeholder: "Quem é essa pessoa e o que está acontecendo com ela?",
  },

  // ---- Bloco 2 · Ambição ---------------------------------------------------
  {
    campo: "objetivos",
    tipo: "multipla",
    titulo: "Se o Instagram funcionasse de verdade pra você, o que mudaria no escritório?",
    apoio: `Escolha até ${MAX_OBJETIVOS}.`,
    opcoes: OBJETIVOS,
    max: MAX_OBJETIVOS,
    colunas: 2,
    extra: {
      campo: "objetivo_outro",
      quando: (r) => (r.objetivos ?? []).includes("outro"),
      rotulo: "O que mudaria",
      placeholder: "O que você espera que mude?",
    },
  },
  {
    campo: "atributos",
    tipo: "multipla",
    titulo: "Quando alguém termina de te ouvir, o que essa pessoa pensa de você?",
    apoio: `Escolha até ${MAX_ATRIBUTOS}. É o que a prevIA defende em cada roteiro.`,
    opcoes: ATRIBUTOS,
    max: MAX_ATRIBUTOS,
    colunas: 3,
  },
  {
    campo: "estilo_narrativo",
    tipo: "estilo",
    titulo: "Qual dessas aberturas você daria — sem ensaiar?",
    apoio: "Não escolha a melhor. Escolha a que sai natural na sua voz.",
  },

  // ---- Bloco 3 · Verdade ---------------------------------------------------
  {
    campo: "situacao",
    tipo: "unica",
    titulo: "O que acontece hoje quando você senta pra gravar?",
    apoio: "É a resposta que mais pesa no seu diagnóstico.",
    opcoes: SITUACAO,
    colunas: 1,
  },
  {
    campo: "ritmo_dias",
    tipo: "dias",
    titulo: "Com quantos dias por semana você se compromete de verdade?",
    apoio: "Não escolha o ideal. Escolha o que você sustenta numa semana ruim.",
  },
  {
    campo: "canais",
    tipo: "multipla",
    titulo: "Onde você publica hoje?",
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
    campo: "trafego_pago",
    tipo: "unica",
    titulo: "Você já investiu em anúncio?",
    apoio: "Orgânico e pago se alimentam. Saber onde você está muda a recomendação.",
    opcoes: TRAFEGO,
    colunas: 3,
  },
  {
    campo: "nome",
    tipo: "texto",
    titulo: "Como você quer ser chamado no seu DNA Viral?",
    apoio: "O relatório é escrito pra você, no seu nome.",
    placeholder: "Seu nome",
  },
];

export const TOTAL_PERGUNTAS = PERGUNTAS.length;

/** Dias da semana, reexportado para o wizard não precisar importar do onboarding. */
export { DIAS_DA_SEMANA, ESTILOS };

/**
 * Perguntas que a pessoa pode pular. As de qualificação existem para o painel
 * admin, não para o diagnóstico — cobrá-las no meio do funil custa conversão,
 * a mesma decisão que o onboarding já tomou para elas.
 */
const OPCIONAIS = new Set<keyof Respostas>(["tamanho_escritorio", "trafego_pago"]);

export function ehOpcional(indice: number): boolean {
  const pergunta = PERGUNTAS[indice - 1];
  return pergunta ? OPCIONAIS.has(pergunta.campo) : false;
}

/**
 * Valida uma pergunta (1-based) e devolve o erro em linguagem de usuário.
 * `null` significa que pode avançar.
 */
export function validarPergunta(indice: number, r: Respostas): string | null {
  const pergunta = PERGUNTAS[indice - 1];
  if (!pergunta) return null;
  if (OPCIONAIS.has(pergunta.campo)) return null;

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
    "Anotado. O gargalo não é repertório — é o caminho entre a ideia e o roteiro.",
  nao_sei_postar: "Anotado. Costuma ser falta de pauta, não falta de assunto.",
  demoro_roteiro: "Anotado. Isso é gargalo de processo, não de ideia.",
  poucas_views: "Anotado. A abertura entra como prioridade no seu diagnóstico.",
  views_sem_cliente: "Anotado. Alcance sem posicionamento traz audiência, não cliente.",
  sem_tempo: "Anotado. Então o seu plano precisa caber na semana real, não numa ideal.",
  escalar: "Anotado. Volume sem constância vira esforço sem efeito — seu DNA parte daí.",
};

export function reconhecimento(indice: number, r: Respostas): string | null {
  const pergunta = PERGUNTAS[indice - 1];
  if (!pergunta) return null;

  if (pergunta.campo === "situacao" && r.situacao) {
    return RECONHECIMENTO_SITUACAO[r.situacao] ?? null;
  }

  // Empurrão honesto: ritmo alto prometido agora vira culpa depois.
  if (pergunta.campo === "ritmo_dias") {
    const total = (r.ritmo_dias ?? []).length;
    if (total >= 5) return "Ritmo alto. Só vale se você sustentar na semana ruim.";
    if (total === 1) return "Um dia por semana, sustentado, vale mais que cinco abandonados.";
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
 * Com as 12 perguntas acima, os passos 1, 2, 3 e 5 fecham. Sobra o 4, que pede
 * de 1 a 5 perfis de referência do Instagram — fricção alta demais para pedir
 * a tráfego frio, e a única coisa que resta perguntar depois da compra.
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

  const atributos = (r.atributos ?? []).map((v) => rotulo(ATRIBUTOS, v)).filter(Boolean);
  if (atributos.length) itens.push({ rotulo: "Como quer ser lido", valor: atributos.join(", ") });

  const estilo = ESTILOS.find((e) => e.valor === r.estilo_narrativo);
  if (estilo) itens.push({ rotulo: "Seu estilo de abertura", valor: estilo.label });

  const dias = r.ritmo_dias ?? [];
  if (dias.length) {
    itens.push({
      rotulo: "Seu ritmo",
      valor: dias.length === 1 ? "1 vez por semana" : `${dias.length} vezes por semana`,
    });
  }

  return itens;
}

function rotulo(opcoes: Opcao[], valor: string): string {
  return opcoes.find((o) => o.valor === valor)?.label ?? "";
}
