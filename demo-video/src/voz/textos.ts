// O texto da narração, cena a cena. Cada cena é gravada numa tomada só
// (public/voz/<cena>.mp3, por gerar-voz.mts), para a entonação correr de uma
// frase para a outra; as marcas de tempo do ElevenLabs dizem onde cada fala
// começa, e ela aparece escrita na faixa do topo nesse momento.
//
// Escrito para ser dito, como quem conversa com um colega: frases que se
// emendam, sem tom de locução institucional.
//
// `de` é o frame mínimo em que a fala entra. Se a fala anterior ainda estiver
// tocando, ela entra depois, e a cena inteira acompanha. Dentro de uma frase o
// `de` fica em 0: a voz conduz, e um mínimo maior criaria uma pausa no meio dela.
//
// Sem imports: gerar-voz.mts lê este arquivo direto com o Node.

export type FalaRoteiro = {
  readonly id: string;
  /** Como aparece escrita na tela. */
  readonly texto: string;
  /** Como a voz deve falar, quando difere do texto (pronúncia). */
  readonly fala?: string;
  /** Intenção da fala, em inglês: vira etiqueta de emoção no modelo v3 (ex.: "warmly"). */
  readonly tom?: string;
  readonly de: number;
  readonly destaque?: string;
};

export const NARRACAO = {
  gancho: [
    {
      id: "gancho-1",
      texto: "Você sabe que precisa postar.",
      tom: "knowingly",
      de: 0,
    },
    {
      id: "gancho-2",
      texto: "O difícil é saber o quê. Toda semana.",
      tom: "sighs",
      destaque: "Toda semana.",
      de: 50,
    },
  ],
  configuracao: [
    {
      id: "config-1",
      texto: "Com a prevIA, você conta quem é e para quem fala,",
      fala: "Com a prévia, você conta quem é e para quem fala,",
      tom: "warmly",
      de: 0,
    },
    { id: "config-2", texto: "escolhe os perfis que admira", de: 0 },
    { id: "config-3", texto: "e os dias em que vai postar.", de: 0 },
    {
      id: "config-4",
      texto: "Pronto: ela monta o seu DNA viral.",
      tom: "satisfied",
      destaque: "DNA viral",
      de: 0,
    },
  ],
  plano: [
    {
      id: "plano-1",
      texto: "Todo domingo, ela estuda o que viralizou no seu nicho",
      tom: "confident",
      de: 0,
    },
    {
      id: "plano-2",
      texto: "e entrega o seu plano da semana.",
      destaque: "plano da semana",
      de: 0,
    },
    {
      id: "plano-3",
      texto: "Cada vídeo já vem com o gancho escrito.",
      tom: "impressed",
      de: 170,
    },
    { id: "plano-4", texto: "Você só aprova.", tom: "playfully", de: 0 },
  ],
  roteiro: [
    {
      id: "roteiro-1",
      texto: "Cada vídeo aprovado vira um roteiro completo,",
      tom: "confident",
      de: 0,
    },
    {
      id: "roteiro-2",
      texto: "na sua voz, do gancho à legenda.",
      destaque: "na sua voz",
      de: 0,
    },
    {
      id: "roteiro-3",
      texto: "Não gostou? Recusa, e ela aprende com o motivo.",
      tom: "reassuring",
      de: 0,
    },
    {
      id: "roteiro-4",
      texto: "Gostou? Já pode gravar.",
      tom: "cheerful",
      de: 0,
    },
  ],
  teleprompter: [
    {
      id: "tele-1",
      texto: "Na hora de gravar, é só abrir o modo gravação.",
      tom: "casual",
      de: 0,
    },
    {
      id: "tele-2",
      texto: "O texto rola sozinho, pertinho da câmera.",
      destaque: "rola sozinho",
      de: 95,
    },
    { id: "tele-3", texto: "Você lê e grava.", tom: "encouraging", de: 0 },
  ],
  carrossel: [
    {
      id: "carrossel-1",
      texto: "E o mesmo roteiro ainda vira carrossel,",
      tom: "excited",
      de: 0,
    },
    {
      id: "carrossel-2",
      texto: "com a sua identidade visual,",
      destaque: "sua identidade",
      de: 75,
    },
    { id: "carrossel-3", texto: "pronto para baixar e postar.", de: 145 },
  ],
  ritmo: [
    {
      id: "ritmo-1",
      texto: "Semana após semana, sem começar do zero.",
      tom: "warmly",
      destaque: "sem começar do zero",
      de: 0,
    },
  ],
  oferta: [
    {
      id: "oferta-1",
      texto: "Você ganhou 1 mês grátis da prevIA.",
      fala: "E você ganhou um mês grátis da prévia.",
      tom: "excited",
      destaque: "1 mês grátis",
      de: 0,
    },
    {
      id: "oferta-2",
      texto: "Leia o QR code abaixo e comece hoje.",
      tom: "friendly",
      de: 75,
    },
  ],
} satisfies Record<string, FalaRoteiro[]>;
