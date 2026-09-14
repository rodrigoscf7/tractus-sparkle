/**
 * Cache local das respostas do quiz, entre uma pergunta e outra.
 *
 * NÃO é a fonte da verdade — essa é `oferta_leads` no banco, escrita por
 * `quiz-oferta.functions.ts`. O que mora aqui serve para a tela responder na
 * hora: ler do localStorage é instantâneo, e o wizard não pode esperar um
 * round-trip para pintar a resposta que a pessoa acabou de marcar.
 *
 * A gravação no servidor acontece em paralelo, a cada avanço, e o objeto
 * inteiro é reenviado na última pergunta — então uma gravação parcial perdida
 * no meio do caminho não deixa o lead incompleto.
 */

import type { Respostas } from "@/lib/quiz-oferta";

const CHAVE = "previa.oferta.quiz";

export function lerRespostas(): Respostas {
  if (typeof window === "undefined") return {};
  try {
    const bruto = window.localStorage.getItem(CHAVE);
    return bruto ? (JSON.parse(bruto) as Respostas) : {};
  } catch {
    return {};
  }
}

export function gravarRespostas(respostas: Respostas): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(CHAVE, JSON.stringify(respostas));
  } catch {
    // Aba anônima ou storage bloqueado: a pessoa perde a retomada, mas o quiz
    // continua funcionando na sessão atual. Não vale derrubar a tela por isso.
  }
}

export function limparRespostas(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CHAVE);
  } catch {
    // idem
  }
}
