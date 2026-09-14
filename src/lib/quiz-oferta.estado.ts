/**
 * Onde as respostas do quiz da oferta ficam entre um passo e outro.
 *
 * Hoje: só localStorage. De propósito — o quiz é público e anônimo, e nenhuma
 * tabela do app serve: todas são por `conta_id` com RLS, e a pessoa aqui ainda
 * não tem conta.
 *
 * Quando o lead for para o banco, é este arquivo que muda (vira
 * `quiz-oferta.functions.ts`, no padrão dos outros server functions do app).
 * A gravação precisa ser via server function com service role — nunca abrir
 * insert público numa tabela. A tela e o wizard não mudam: só consomem
 * `lerRespostas` / `gravarRespostas`.
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
