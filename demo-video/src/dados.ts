// Persona e conteúdo fictícios. Tom informativo, sem promessa de resultado
// (Provimento 205/2021 da OAB), como a prevIA escreve.

export const persona = {
  nome: "Dra. Marina Albuquerque",
  arroba: "marina.previdencia",
  area: "Direito Previdenciário",
  nicho: "Aposentadoria e benefícios do INSS",
  cidade: "Curitiba",
  referencias: [
    "exemplo.previdencia",
    "inss.descomplicado",
    "direito.do.aposentado",
  ],
  dias: ["seg", "qua", "sex"],
};

export type VideoDoPlano = {
  dia: string;
  data: string;
  tema: string;
  angulo: string;
  gancho: string;
  origem: string;
  acimaDoNormal: string;
};

export const semana = {
  intervalo: "Semana de 12/10 a 16/10",
  resumo:
    "Os vídeos que mais performaram nas suas referências abriram com uma pergunta direta sobre um “não” do INSS e responderam em menos de 40 segundos.",
};

export const plano: VideoDoPlano[] = [
  {
    dia: "Seg",
    data: "12/10",
    tema: "Aposentadoria negada não é o fim",
    angulo:
      "Muita gente desiste no primeiro “não” do INSS sem saber que existe recurso.",
    gancho: "O INSS negou sua aposentadoria? Não jogue essa carta fora ainda.",
    origem: "@exemplo.previdencia",
    acimaDoNormal: "4,2×",
  },
  {
    dia: "Qua",
    data: "14/10",
    tema: "O erro no CNIS que reduz o benefício",
    angulo:
      "Vínculos que faltam no extrato puxam a média para baixo, e quase ninguém confere.",
    gancho:
      "Tem um documento que pode estar diminuindo a sua aposentadoria. E você nunca abriu.",
    origem: "@inss.descomplicado",
    acimaDoNormal: "3,7×",
  },
  {
    dia: "Sex",
    data: "16/10",
    tema: "BPC/LOAS: quem tem direito de verdade",
    angulo: "Desfaz o mito de que só recebe quem nunca contribuiu.",
    gancho:
      "Você acha que não tem direito ao BPC porque já trabalhou de carteira assinada?",
    origem: "@direito.do.aposentado",
    acimaDoNormal: "5,1×",
  },
];

export const ETAPAS_DO_PLANO = [
  "Lendo os últimos posts dos perfis que você acompanha",
  "Assistindo aos vídeos que mais performaram e entendendo por quê",
  "Transformando os padrões em vídeos para a sua semana",
];

/** O roteiro do vídeo de segunda, como a tela do roteiro mostra. */
export const roteiro = {
  gancho: "O INSS negou sua aposentadoria? Não jogue essa carta fora ainda.",
  desenvolvimento:
    "Muita gente lê “indeferido” e desiste. Mas essa carta diz o motivo da negativa, e é por ele que se decide o próximo passo. Em muitos casos cabe recurso, com prazo contado a partir da ciência da decisão. E confira o seu CNIS: vínculos que faltam no extrato são uma causa comum de negativa.",
  cta: "Salve este vídeo e mande para quem recebeu um “não” do INSS esta semana.",
  legenda:
    "Indeferido não é ponto final. Leia o motivo, confira o CNIS e fique de olho no prazo. #previdenciario #INSS #aposentadoria",
};

/** O carrossel que sai do roteiro de segunda (capa, uma ideia por slide, CTA). */
export const slidesCarrossel = [
  {
    tipo: "capa",
    titulo: "O INSS negou sua aposentadoria. E agora?",
    destaque: "E agora?",
  },
  {
    tipo: "conteudo",
    titulo: "Um “não” não é a palavra final",
    corpo:
      "A decisão do INSS pode ser revista. Em muitos casos cabe recurso, com prazo contado a partir da ciência da decisão.",
    destaque: "pode ser revista",
  },
  {
    tipo: "conteudo",
    titulo: "Comece pela carta",
    corpo:
      "A carta de indeferimento diz o motivo da negativa. É por ele que se decide o próximo passo.",
    destaque: "o motivo da negativa",
  },
  {
    tipo: "conteudo",
    titulo: "Confira o seu CNIS",
    corpo:
      "Vínculos e contribuições que faltam no extrato são uma causa comum de negativa.",
    destaque: "faltam no extrato",
  },
  {
    tipo: "cta",
    titulo: "Salve este post",
    corpo: "E envie para quem recebeu um “não” do INSS esta semana.",
    destaque: "Salve",
  },
];

/**
 * O QR code da oferta abre o link de convite do app: a pessoa cria a própria
 * conta (nome, e-mail, WhatsApp e senha) e já entra com a cortesia.
 *
 * O código precisa existir e estar ativo em Admin → Contas → Links de convite.
 */
export const CODIGO_CONVITE = "advdeouro";
export const LINK_CONVITE: string = `https://previaviral.tractusoficial.com/convite/${CODIGO_CONVITE}`;

/** Enquanto o QR apontar para cá, a cena cobre o QR com "link provisório". */
export const LINK_PROVISORIO: string = "https://exemplo.com/convite-previa";
