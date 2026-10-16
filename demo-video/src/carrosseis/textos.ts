// Textos dos carrosséis de anúncio. Um card por item. Os perfis do carrossel 1
// vêm do próprio app (ARQUETIPOS_DO_QUIZ), para o anúncio dizer o que o
// relatório entrega.

import { ARQUETIPOS_DO_QUIZ } from "@/lib/dna-viral";

export type Card =
  | { tipo: "capa"; texto: string; apoio?: string }
  | { tipo: "texto"; texto: string; rotulo?: string }
  | { tipo: "perfil"; rotulo: string; nome: string; frase: string }
  | { tipo: "cta"; texto: string; apoio: string; botao: string; micro: string };

export type Carrossel = { id: string; cards: Card[] };

export const CARROSSEIS: Carrossel[] = [
  {
    id: "1-Perfis",
    cards: [
      {
        tipo: "capa",
        texto: "6 perfis de advogado no Instagram.",
        apoio: "Arrasta até achar o seu.",
      },
      ...ARQUETIPOS_DO_QUIZ.map(
        (a, i): Card => ({
          tipo: "perfil",
          rotulo: `Perfil ${i + 1} de ${ARQUETIPOS_DO_QUIZ.length}`,
          nome: a.nome,
          frase: a.uma_linha,
        }),
      ),
      {
        tipo: "cta",
        texto: "Descubra o seu em 2 minutos",
        apoio: "O diagnóstico gratuito diz qual é o seu perfil e entrega 3 roteiros prontos pra sua área.",
        botao: "Descobrir o meu perfil",
        micro: "Gratuito · 11 perguntas",
      },
    ],
  },
  {
    id: "2-Domingo",
    cards: [
      {
        tipo: "capa",
        texto: "Domingo, 21h. Você abre o Instagram pra decidir o que gravar na semana.",
      },
      {
        tipo: "texto",
        texto:
          "Abre três perfis de referência. Salva onze posts. Nenhum fala do caso do jeito que você atende.",
      },
      { tipo: "texto", texto: "Segunda tem audiência às 9h e cliente às 14h. O vídeo fica pra terça." },
      {
        tipo: "texto",
        texto: "Na terça você escreve o roteiro. Ele sai longo, você corta, grava duas vezes.",
      },
      {
        tipo: "texto",
        texto: "Sexta à noite. O vídeo não saiu, e o próximo domingo começa do zero.",
      },
      {
        tipo: "texto",
        texto:
          "A prevIA faz esse domingo por você. Ela lê o que mais performou nos perfis que você acompanha e monta o plano da semana.",
      },
      {
        tipo: "texto",
        texto: "Na segunda de manhã, o tema e o roteiro de cada vídeo já estão lá. Você abre, lê e grava.",
      },
      {
        tipo: "cta",
        texto: "Comece pelo diagnóstico gratuito",
        apoio: "Em 2 minutos você sai com 3 roteiros prontos pra sua área.",
        botao: "Fazer meu diagnóstico",
        micro: "Gratuito · 11 perguntas",
      },
    ],
  },
  {
    id: "5-Teste",
    cards: [
      { tipo: "capa", texto: "Seu Instagram passa nessas 4 perguntas?" },
      {
        tipo: "texto",
        rotulo: "1 · Clareza",
        texto: "Quem cai no seu perfil entende em 3 segundos com que tipo de caso você trabalha?",
      },
      {
        tipo: "texto",
        rotulo: "2 · Frequência",
        texto: "Você publicou nas últimas duas semanas sem ser uma data comemorativa?",
      },
      {
        tipo: "texto",
        rotulo: "3 · Potencial viral",
        texto: "Seus vídeos começam pelo problema do cliente ou pela sua apresentação?",
      },
      {
        tipo: "texto",
        rotulo: "4 · Conexão",
        texto: "Algum comentário já disse “é exatamente o meu caso”?",
      },
      {
        tipo: "texto",
        texto:
          "No diagnóstico da prevIA, cada uma vira uma nota de 0 a 100, calculada a partir das suas respostas.",
      },
      {
        tipo: "texto",
        texto:
          "Junto com a nota vêm os 3 gargalos que mais pesam no seu perfil e 3 roteiros pra começar a resolver.",
      },
      {
        tipo: "cta",
        texto: "Veja a nota do seu perfil",
        apoio: "Clareza, frequência, potencial viral e conexão, de 0 a 100.",
        botao: "Ver a nota do meu perfil",
        micro: "Gratuito · 2 minutos",
      },
    ],
  },
];
