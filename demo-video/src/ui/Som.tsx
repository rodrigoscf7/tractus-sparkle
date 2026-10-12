// Efeitos sonoros (public/sfx, gerados por gerar-sfx.mts). Só marcam o ritmo:
// ficam uns 15 dB abaixo da voz. O volume de cada um já compensa o quanto o
// arquivo saiu alto ou baixo na geração (medido em RMS).

import type React from "react";
import { Audio } from "@remotion/media";
import { staticFile, useVideoConfig } from "remotion";

const SONS = {
  toque: 0.5,
  transicao: 0.45,
  notificacao: 1,
  digitacao: 0.8,
  confirmacao: 0.18,
  marca: 0.32,
  cartas: 0.6,
  pop: 0.22,
} as const;

export type NomeSom = keyof typeof SONS;

/** Toca o efeito `nome` a partir do frame `em` da cena. `volume` multiplica o padrão. */
export const Som: React.FC<{
  readonly nome: NomeSom;
  readonly em: number;
  readonly volume?: number;
}> = ({ nome, em, volume = 1 }) => {
  const { fps } = useVideoConfig();
  return (
    <Audio
      name={`sfx: ${nome}`}
      src={staticFile(`sfx/${nome}.mp3`)}
      from={Math.round(em)}
      volume={SONS[nome] * volume}
      premountFor={fps}
    />
  );
};

/**
 * Um sopro leve em cada troca de cena de uma TransitionSeries: a cena k começa
 * na soma das anteriores menos as sobreposições das transições.
 */
export const SonsDasTransicoes: React.FC<{
  readonly duracoes: readonly number[];
  readonly transicao: number;
}> = ({ duracoes, transicao }) => {
  const inicios = duracoes
    .slice(1)
    .map(
      (_, k) =>
        duracoes.slice(0, k + 1).reduce((a, b) => a + b, 0) -
        (k + 1) * transicao,
    );
  return (
    <>
      {inicios.map((inicio) => (
        <Som key={inicio} nome="transicao" em={inicio - 4} />
      ))}
    </>
  );
};
