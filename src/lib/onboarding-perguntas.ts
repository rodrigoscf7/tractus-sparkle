/**
 * Definição das 15 perguntas do onboarding.
 *
 * Perguntas 1 a 11 configuram o perfil e alimentam os agentes.
 * Perguntas 12 a 15 são aquisição e qualificação: ficam só em
 * `onboarding_respostas` e aparecem no painel admin.
 *
 * Compartilhado entre o wizard (renderiza as opções) e a server function
 * (valida e traduz para `perfis` / `perfis_referencia`).
 */

export type Opcao = { valor: string; label: string };

export const TOTAL_PASSOS = 5;

export const PASSOS = [
  { numero: 1, titulo: "Você", resumo: "Quem fala e sobre o que" },
  { numero: 2, titulo: "Seu público", resumo: "Quem precisa ouvir" },
  { numero: 3, titulo: "Sua voz", resumo: "Como você soa" },
  { numero: 4, titulo: "Suas referências", resumo: "Onde buscar repertório" },
  { numero: 5, titulo: "Seu ritmo", resumo: "Com o que você se compromete" },
] as const;

/**
 * O compromisso de publicação. É a pergunta que sustenta o produto inteiro:
 * o app garante que sempre existe conteúdo pronto para estes dias e cobra neles.
 * Três vezes por semana é o ritmo recomendado para quem está começando.
 */
export const RITMO_SUGERIDO = [1, 3, 5];

export const DIAS_DA_SEMANA: { dow: number; curto: string; longo: string }[] = [
  { dow: 1, curto: "Seg", longo: "Segunda" },
  { dow: 2, curto: "Ter", longo: "Terça" },
  { dow: 3, curto: "Qua", longo: "Quarta" },
  { dow: 4, curto: "Qui", longo: "Quinta" },
  { dow: 5, curto: "Sex", longo: "Sexta" },
  { dow: 6, curto: "Sáb", longo: "Sábado" },
  { dow: 0, curto: "Dom", longo: "Domingo" },
];

/** Q2 — área principal de atuação. Também define as referências sugeridas. */
export const AREAS: Opcao[] = [
  { valor: "previdenciario", label: "Previdenciário" },
  { valor: "trabalhista", label: "Trabalhista" },
  { valor: "familia", label: "Família" },
  { valor: "criminal", label: "Criminal" },
  { valor: "empresarial", label: "Empresarial" },
  { valor: "tributario", label: "Tributário" },
  { valor: "consumidor", label: "Consumidor" },
  { valor: "imobiliario", label: "Imobiliário" },
  { valor: "medico_saude", label: "Médico e Saúde" },
  { valor: "bancario", label: "Bancário" },
  { valor: "civil", label: "Civil" },
  { valor: "sucessoes", label: "Sucessões" },
  { valor: "mentora", label: "Mentoria para advogados" },
  { valor: "outro", label: "Outro" },
];

/** Q5 — objetivo do conteúdo. Até 2. Define o foco da curadoria. */
export const OBJETIVOS: Opcao[] = [
  { valor: "seguidores", label: "Atrair novos seguidores" },
  { valor: "leads", label: "Gerar mais leads" },
  { valor: "clientes", label: "Conseguir clientes" },
  { valor: "autoridade", label: "Construir autoridade" },
  { valor: "engajamento", label: "Aumentar engajamento" },
  { valor: "frequencia", label: "Criar conteúdo com mais frequência" },
  { valor: "outro", label: "Outro" },
];

export const MAX_OBJETIVOS = 2;

/** Objetivos que puxam a curadoria para tração em vez de posicionamento. */
const OBJETIVOS_DE_ALCANCE = new Set(["seguidores", "engajamento"]);
const OBJETIVOS_DE_POSICIONAMENTO = new Set(["autoridade", "clientes", "leads"]);

/** Q6 — como quer ser percebido. Até 3. */
export const ATRIBUTOS: Opcao[] = [
  { valor: "autoridade", label: "Autoridade" },
  { valor: "didatico", label: "Didático" },
  { valor: "acolhedor", label: "Acolhedor" },
  { valor: "sofisticado", label: "Sofisticado" },
  { valor: "direto", label: "Direto" },
  { valor: "provocador", label: "Provocador" },
  { valor: "bem_humorado", label: "Bem-humorado" },
  { valor: "inspirador", label: "Inspirador" },
  { valor: "tecnico", label: "Técnico" },
  { valor: "popular", label: "Linguagem simples" },
  { valor: "elegante", label: "Elegante" },
  { valor: "energico", label: "Enérgico" },
];

export const MAX_ATRIBUTOS = 3;

/**
 * Q7 — estilo de gravação.
 * O exemplo é a pergunta: quase ninguém sabe descrever o próprio tom de voz,
 * mas todo mundo reconhece a própria abertura numa frase pronta.
 */
export type Estilo = {
  valor: string;
  label: string;
  exemplo: string;
  comoSoa: string;
};

export const ESTILOS: Estilo[] = [
  {
    valor: "A",
    label: "Direto ao ponto",
    exemplo:
      "Se você está grávida e acha que precisa esperar seu filho nascer para pedir o benefício, presta atenção.",
    comoSoa: "Abre nomeando o erro. Frases curtas, sem rodeio.",
  },
  {
    valor: "B",
    label: "Conversa",
    exemplo:
      "Esses dias uma gestante me perguntou uma coisa que eu escuto praticamente toda semana…",
    comoSoa: "Abre com um atendimento real. Ritmo de conversa.",
  },
  {
    valor: "C",
    label: "Polêmico",
    exemplo: "Talvez tenham te contado errado sobre salário-maternidade.",
    comoSoa: "Abre contrariando uma crença comum. Tensão logo no início.",
  },
  {
    valor: "D",
    label: "Professor",
    exemplo:
      "Existem três situações em que uma gestante pode ter direito ao salário-maternidade…",
    comoSoa: "Abre anunciando a estrutura. Didático e organizado.",
  },
  {
    valor: "E",
    label: "Storytelling",
    exemplo:
      "Semana passada chegou uma mulher aqui no escritório acreditando que não tinha direito…",
    comoSoa: "Abre com um caso e uma pessoa. A tese vem pela história.",
  },
];

/** Q10 — perfis de referência. Pelo menos um: sem referência a esteira não roda. */
export const MIN_REFERENCIAS = 1;
export const MAX_REFERENCIAS = 5;

/** Q11 — onde publica hoje. */
export const CANAIS: Opcao[] = [
  { valor: "instagram", label: "Instagram" },
  { valor: "tiktok", label: "TikTok" },
  { valor: "youtube_shorts", label: "YouTube Shorts" },
  { valor: "linkedin", label: "LinkedIn" },
  { valor: "nenhum", label: "Ainda não produzo conteúdo" },
];

/** Q12 — tamanho do escritório. */
export const TAMANHOS: Opcao[] = [
  { valor: "so_eu", label: "Somente eu" },
  { valor: "2_3", label: "2 a 3 pessoas" },
  { valor: "4_5", label: "4 a 5 pessoas" },
  { valor: "6_10", label: "6 a 10 pessoas" },
  { valor: "11_20", label: "11 a 20 pessoas" },
  { valor: "mais_20", label: "Mais de 20 pessoas" },
];

/** Q13 — tráfego pago. */
export const TRAFEGO: Opcao[] = [
  { valor: "sim", label: "Sim, atualmente" },
  { valor: "parei", label: "Já investi, mas parei" },
  { valor: "nunca", label: "Nunca investi" },
];

/** Q14 — origem. Atribuição de canal. */
export const ORIGEM: Opcao[] = [
  { valor: "instagram", label: "Instagram" },
  { valor: "anuncio", label: "Anúncio" },
  { valor: "indicacao", label: "Indicação de amigo ou colega" },
  { valor: "influenciador", label: "Influenciador ou parceiro" },
  { valor: "evento", label: "Evento" },
  { valor: "whatsapp", label: "WhatsApp" },
  { valor: "google", label: "Google" },
  { valor: "tiktok", label: "TikTok" },
  { valor: "outro", label: "Outro" },
];

/** Q15 — situação atual. Qualificação e texto da primeira tela pós-relatório. */
export const SITUACAO: Opcao[] = [
  { valor: "ideias_sem_conteudo", label: "Tenho ideias, mas não consigo transformar em conteúdo" },
  { valor: "nao_sei_postar", label: "Não sei o que postar" },
  { valor: "demoro_roteiro", label: "Demoro muito para criar roteiros" },
  { valor: "poucas_views", label: "Posto, mas meus conteúdos têm poucas visualizações" },
  { valor: "views_sem_cliente", label: "Tenho visualizações, mas não atraio clientes" },
  { valor: "sem_tempo", label: "Minha rotina não me permite produzir conteúdo" },
  { valor: "escalar", label: "Quero aumentar muito minha produção de conteúdo" },
];

/** Forma das respostas gravadas em `onboarding_respostas.respostas`. */
export type Respostas = {
  // Passo 1
  nome?: string;
  area_atuacao?: string;
  area_outro?: string;
  tem_nicho?: boolean;
  nicho?: string;
  // Passo 2
  cliente_ideal?: string;
  objetivos?: string[];
  objetivo_outro?: string;
  // Passo 3
  atributos?: string[];
  estilo_narrativo?: string;
  /** Texto cru da pergunta 8, preservado para reabrir o wizard. */
  restricoes_texto?: string;
  restricoes?: string[];
  tem_bordoes?: boolean;
  /** Texto cru da pergunta 9. */
  bordoes_texto?: string;
  bordoes?: string[];
  // Passo 4
  referencias?: string[];
  canais?: string[];
  // Passo 5
  /** Dias da semana com que a pessoa se compromete (0=dom … 6=sáb). */
  ritmo_dias?: number[];
  tamanho_escritorio?: string;
  trafego_pago?: string;
  situacao?: string;
  origem?: string;
  origem_outro?: string;
};

function label(opcoes: Opcao[], valor?: string) {
  return opcoes.find((o) => o.valor === valor)?.label ?? valor ?? "";
}

export function labelArea(valor?: string) {
  return label(AREAS, valor);
}

export function estiloPor(valor?: string) {
  return ESTILOS.find((e) => e.valor === valor);
}

/** Q5 → `perfis.foco_curadoria`. Posicionamento ganha quando os dois aparecem. */
export function focoDeObjetivos(objetivos: string[] | undefined): "posicionamento" | "viral" {
  const escolhidos = objetivos ?? [];
  if (escolhidos.some((o) => OBJETIVOS_DE_POSICIONAMENTO.has(o))) return "posicionamento";
  if (escolhidos.some((o) => OBJETIVOS_DE_ALCANCE.has(o))) return "viral";
  return "posicionamento";
}

/** Q6 + Q7 → `perfis.tom_de_voz`, em uma frase legível. */
export function tomDeVoz(respostas: Respostas): string {
  const atributos = (respostas.atributos ?? []).map((a) => label(ATRIBUTOS, a).toLowerCase());
  const estilo = estiloPor(respostas.estilo_narrativo);
  const partes: string[] = [];
  if (atributos.length) partes.push(atributos.join(", "));
  if (estilo) partes.push(`abertura no estilo ${estilo.label.toLowerCase()}`);
  return partes.join(" — ");
}

/** Respostas → `perfis.diretrizes`. É o que todos os agentes leem. */
export function diretrizesDeRespostas(respostas: Respostas) {
  const estilo = estiloPor(respostas.estilo_narrativo);
  return {
    area_atuacao:
      respostas.area_atuacao === "outro"
        ? respostas.area_outro?.trim() || "Outro"
        : labelArea(respostas.area_atuacao),
    nicho: respostas.tem_nicho ? respostas.nicho?.trim() || null : null,
    cliente_ideal: respostas.cliente_ideal?.trim() || null,
    objetivos: (respostas.objetivos ?? []).map((o) => label(OBJETIVOS, o)),
    objetivo_outro: respostas.objetivo_outro?.trim() || null,
    atributos: (respostas.atributos ?? []).map((a) => label(ATRIBUTOS, a)),
    estilo_narrativo: respostas.estilo_narrativo ?? null,
    estilo_nome: estilo?.label ?? null,
    estilo_exemplo: estilo?.exemplo ?? null,
    estilo_como_soa: estilo?.comoSoa ?? null,
    restricoes: respostas.restricoes ?? [],
    bordoes: respostas.tem_bordoes ? respostas.bordoes ?? [] : [],
    canais: (respostas.canais ?? []).map((c) => label(CANAIS, c)),
  };
}

/** Texto livre em lista: uma por linha, ponto e vírgula também separa. */
export function linhasParaLista(texto: string): string[] {
  return texto
    .split(/[\n;]+/)
    .map((linha) => linha.trim())
    .filter(Boolean);
}

export function normalizarHandle(bruto: string): string {
  return bruto
    .trim()
    .replace(/^https?:\/\/(www\.)?instagram\.com\//i, "")
    .replace(/\/.*$/, "")
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();
}

/** Valida um passo. Retorna a lista de problemas — vazia significa liberado. */
export function validarPasso(passo: number, r: Respostas): string[] {
  const erros: string[] = [];

  if (passo === 1) {
    if (!r.nome?.trim()) erros.push("Diga como você quer ser chamado.");
    if (!r.area_atuacao) erros.push("Escolha sua principal área de atuação.");
    if (r.area_atuacao === "outro" && !r.area_outro?.trim())
      erros.push("Descreva sua área de atuação.");
    if (r.tem_nicho && !r.nicho?.trim()) erros.push("Descreva seu nicho ou desmarque a opção.");
  }

  if (passo === 2) {
    if (!r.cliente_ideal?.trim()) erros.push("Descreva quem você quer atrair.");
    const objetivos = r.objetivos ?? [];
    if (!objetivos.length) erros.push("Escolha ao menos um objetivo.");
    if (objetivos.length > MAX_OBJETIVOS)
      erros.push(`Escolha no máximo ${MAX_OBJETIVOS} objetivos.`);
    if (objetivos.includes("outro") && !r.objetivo_outro?.trim())
      erros.push("Descreva o outro objetivo.");
  }

  if (passo === 3) {
    const atributos = r.atributos ?? [];
    if (!atributos.length) erros.push("Escolha ao menos uma característica.");
    if (atributos.length > MAX_ATRIBUTOS)
      erros.push(`Escolha no máximo ${MAX_ATRIBUTOS} características.`);
    if (!r.estilo_narrativo) erros.push("Escolha o estilo que mais combina com você.");
    if (r.tem_bordoes && !(r.bordoes ?? []).length)
      erros.push("Escreva seus bordões ou desmarque a opção.");
  }

  if (passo === 4) {
    const refs = r.referencias ?? [];
    if (refs.length < MIN_REFERENCIAS)
      erros.push("Adicione ao menos um perfil de referência — é o que a prevIA usa para buscar repertório.");
    if (refs.length > MAX_REFERENCIAS)
      erros.push(`Adicione no máximo ${MAX_REFERENCIAS} perfis.`);
    if (!(r.canais ?? []).length) erros.push("Diga onde você publica hoje.");
  }

  // Só o compromisso de ritmo é obrigatório aqui. Tamanho de escritório, tráfego
  // pago e "como conheceu" são perguntas nossas, de qualificação comercial —
  // cobrá-las no ponto de maior atrito do funil custa conversão.
  if (passo === 5) {
    const dias = r.ritmo_dias ?? [];
    if (!dias.length) erros.push("Escolha ao menos um dia para publicar.");
    if (dias.some((d) => d < 0 || d > 6)) erros.push("Dia da semana inválido.");
    if (r.origem === "outro" && !r.origem_outro?.trim())
      erros.push("Descreva como você conheceu a prevIA.");
  }

  return erros;
}
