import { Easing, interpolate } from "remotion";

const suave = Easing.bezier(0.16, 1, 0.3, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 0 → 1 entre `inicio` e `inicio + duracao`, com saída suave. */
export function progresso(frame: number, inicio: number, duracao: number) {
  return interpolate(frame, [inicio, inicio + duracao], [0, 1], {
    ...clamp,
    easing: suave,
  });
}

/** Entrada padrão: sobe `distancia` px e aparece. */
export function entrada(
  frame: number,
  inicio: number,
  duracao = 18,
  distancia = 24,
) {
  const p = progresso(frame, inicio, duracao);
  return { opacity: p, translate: `0px ${(1 - p) * distancia}px` };
}

/** Mistura linear entre dois números por um progresso 0..1. */
export function mix(de: number, para: number, p: number) {
  return de + (para - de) * p;
}
