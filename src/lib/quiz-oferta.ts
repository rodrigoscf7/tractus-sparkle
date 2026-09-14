/**
 * Definição do quiz da oferta — o quiz público, antes da compra.
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │ AS PERGUNTAS ABAIXO SÃO PROVISÓRIAS. Existem para o fluxo rodar de  │
 * │ ponta a ponta enquanto a estrutura e a copy não são definidas.      │
 * │ Trocar o conteúdo é editar só este arquivo: a rota e o wizard não   │
 * │ sabem nada sobre as perguntas.                                      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Não confundir com `onboarding-perguntas.ts`, que é o quiz DEPOIS da compra
 * e alimenta os agentes. A relação entre os dois é de propósito: o que for
 * perguntado aqui não deve ser perguntado de novo lá.
 */

import type { Opcao } from "@/lib/onboarding-perguntas";

export type { Opcao };

export const PASSOS = [
  { numero: 1, titulo: "Seu momento", resumo: "Onde você está hoje" },
  { numero: 2, titulo: "Seu obstáculo", resumo: "O que trava a publicação" },
  { numero: 3, titulo: "Seu objetivo", resumo: "Onde você quer chegar" },
] as const;

export const TOTAL_PASSOS = PASSOS.length;

/** Provisório. */
export const MOMENTO: Opcao[] = [
  { valor: "nao_publico", label: "Não publico nada hoje" },
  { valor: "as_vezes", label: "Publico de vez em quando, sem constância" },
  { valor: "constante", label: "Publico com constância, mas sem resultado" },
  { valor: "terceirizo", label: "Pago alguém para cuidar disso" },
];

/** Provisório. */
export const OBSTACULO: Opcao[] = [
  { valor: "tempo", label: "Falta tempo" },
  { valor: "ideia", label: "Não sei sobre o que falar" },
  { valor: "trava", label: "Travo na hora de gravar" },
  { valor: "constancia", label: "Começo e não mantenho" },
];

export const MAX_OBSTACULOS = 2;

/** Provisório. */
export const OBJETIVO: Opcao[] = [
  { valor: "clientes", label: "Conseguir clientes pelo Instagram" },
  { valor: "autoridade", label: "Ser reconhecido como referência" },
  { valor: "constancia", label: "Simplesmente manter constância" },
];

export type Respostas = {
  momento?: string;
  obstaculos?: string[];
  objetivo?: string;
};

/**
 * Valida um passo e devolve os erros em linguagem de usuário.
 * Array vazio significa que pode avançar.
 */
export function validarPasso(passo: number, r: Respostas): string[] {
  const erros: string[] = [];

  if (passo === 1 && !r.momento) {
    erros.push("Escolha a opção que mais parece com o seu momento.");
  }

  if (passo === 2 && !r.obstaculos?.length) {
    erros.push("Escolha pelo menos um obstáculo.");
  }

  if (passo === 3 && !r.objetivo) {
    erros.push("Escolha o seu objetivo principal.");
  }

  return erros;
}

/**
 * Traduz as respostas no diagnóstico que a tela de resultado mostra.
 *
 * É aqui que mora o mecanismo do quiz: o que a pessoa recebe em troca de ter
 * respondido, e a ponte para a oferta. Hoje devolve um texto genérico — a
 * lógica de verdade entra junto com a copy.
 */
export type Diagnostico = {
  titulo: string;
  texto: string;
};

export function diagnosticar(r: Respostas): Diagnostico {
  if (!r.momento || !r.objetivo) {
    return {
      titulo: "Não deu para ler seu resultado",
      texto: "Parece que o quiz ficou pela metade. Responda de novo para ver o diagnóstico.",
    };
  }

  return {
    titulo: "Seu diagnóstico",
    texto:
      "Texto provisório do resultado. O mecanismo do diagnóstico entra junto com a copy, " +
      "usando as respostas dos três passos.",
  };
}

export const RESPOSTAS_VAZIAS: Respostas = {};
