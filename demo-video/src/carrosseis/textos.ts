// Textos dos carrosséis de anúncio. Um card por item. Os perfis do carrossel 1
// vêm do próprio app (ARQUETIPOS_DO_QUIZ), para o anúncio dizer o que o
// relatório entrega.

import { ARQUETIPOS_DO_QUIZ } from "@/lib/dna-viral";

export type Card =
  | { tipo: "capa"; texto: string; apoio?: string }
  | { tipo: "texto"; texto: string; rotulo?: string }
  | { tipo: "perfil"; rotulo: string; nome: string; frase: string; comeco: string }
  | { tipo: "cta"; texto: string; apoio: string; botao: string; micro: string };

export type Carrossel = { id: string; cards: Card[] };

/**
 * O primeiro passo de cada perfil, tirado do gargalo principal que o relatório
 * dá para a mesma situação (GARGALO_PRINCIPAL em src/lib/dna-viral.ts). É o
 * que o gancho do carrossel promete: achar o seu e saber por onde começar.
 */
const POR_ONDE_COMECAR: Record<string, string> = {
  nao_sei_postar: "Escolha o tema pela dúvida que o cliente mais repete no atendimento.",
  ideias_sem_conteudo: "Use um formato fixo para levar a anotação até a gravação.",
  sem_tempo: "Monte o ritmo pela pior semana do mês, não pela melhor.",
  sem_constancia: "Decida os temas antes de a semana começar, não entre uma audiência e outra.",
  poucas_views: "Reescreva só os 3 primeiros segundos: comece pelo problema do cliente.",
  views_sem_cliente: "Diga em todo vídeo para quem você resolve e o que acontece depois do contato.",
};

export const CARROSSEIS: Carrossel[] = [
  {
    id: "1-Perfis",
    cards: [
      {
        tipo: "capa",
        texto: "Em qual destes 6 perfis o seu Instagram travou?",
        apoio: "Arrasta, acha o seu e veja por onde começar a destravar.",
      },
      ...ARQUETIPOS_DO_QUIZ.map(
        (a, i): Card => ({
          tipo: "perfil",
          rotulo: `Perfil ${i + 1} de ${ARQUETIPOS_DO_QUIZ.length}`,
          nome: a.nome,
          frase: a.uma_linha,
          comeco: POR_ONDE_COMECAR[a.situacao] ?? "",
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
        texto: "Toda sexta você promete: semana que vem eu posto.",
        apoio: "Arrasta e veja em que momento exato a semana se perde.",
      },
      {
        tipo: "texto",
        rotulo: "Domingo, 21h",
        texto:
          "Você abre três perfis de referência e salva onze posts. Nenhum fala do caso do jeito que você atende.",
      },
      {
        tipo: "texto",
        rotulo: "Segunda",
        texto: "Audiência às 9h, cliente às 14h. O vídeo fica pra terça.",
      },
      {
        tipo: "texto",
        rotulo: "Terça",
        texto: "Você escreve o roteiro. Ele sai longo, você corta e grava duas vezes.",
      },
      {
        tipo: "texto",
        rotulo: "Sexta",
        texto: "O vídeo não saiu. E a promessa volta: semana que vem eu posto.",
      },
      {
        tipo: "texto",
        texto:
          "A semana se perde no domingo, na hora de decidir o tema. Sem tema decidido, cada dia empurra o vídeo para o seguinte.",
      },
      {
        tipo: "texto",
        texto:
          "A prevIA faz esse domingo por você. Na segunda de manhã, o tema e o roteiro de cada vídeo já estão lá. Você abre, lê e grava.",
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
