// O vídeo inteiro: a semana de uma advogada com a prevIA, do problema ao convite.

import type React from "react";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { useVideoConfig } from "remotion";
import { SonsDasTransicoes } from "./ui/Som";
import { Carrossel, DURACAO_CARROSSEL } from "./cenas/Carrossel";
import { Configuracao, DURACAO_CONFIGURACAO } from "./cenas/Configuracao";
import { DURACAO_GANCHO, Gancho } from "./cenas/Gancho";
import { DURACAO_OFERTA, Oferta } from "./cenas/Oferta";
import { DURACAO_PLANO_CHEGOU, PlanoChegou } from "./cenas/PlanoChegou";
import { DURACAO_RITMO, Ritmo } from "./cenas/Ritmo";
import { DURACAO_ROTEIRO, Roteiro } from "./cenas/Roteiro";
import { DURACAO_TELEPROMPTER, Teleprompter } from "./cenas/Teleprompter";

/** Duração de cada transição, em frames. */
export const TRANSICAO = 12;

const CENAS = [
  DURACAO_GANCHO,
  DURACAO_CONFIGURACAO,
  DURACAO_PLANO_CHEGOU,
  DURACAO_ROTEIRO,
  DURACAO_TELEPROMPTER,
  DURACAO_CARROSSEL,
  DURACAO_RITMO,
  DURACAO_OFERTA,
];

export const DURACAO_MESTRE =
  CENAS.reduce((a, b) => a + b, 0) - (CENAS.length - 1) * TRANSICAO;

const transicao = (
  <TransitionSeries.Transition
    presentation={fade()}
    timing={linearTiming({ durationInFrames: TRANSICAO })}
  />
);

export const Mestre: React.FC = () => {
  const { fps } = useVideoConfig();
  return (
    <>
      <SonsDasTransicoes duracoes={CENAS} transicao={TRANSICAO} />
      <TransitionSeries>
        <TransitionSeries.Sequence
          name="Gancho"
          durationInFrames={DURACAO_GANCHO}
          premountFor={fps}
        >
          <Gancho />
        </TransitionSeries.Sequence>
        {transicao}
        <TransitionSeries.Sequence
          name="Configuração"
          durationInFrames={DURACAO_CONFIGURACAO}
          premountFor={fps}
        >
          <Configuracao />
        </TransitionSeries.Sequence>
        {transicao}
        <TransitionSeries.Sequence
          name="Plano chegou"
          durationInFrames={DURACAO_PLANO_CHEGOU}
          premountFor={fps}
        >
          <PlanoChegou />
        </TransitionSeries.Sequence>
        {transicao}
        <TransitionSeries.Sequence
          name="Roteiro"
          durationInFrames={DURACAO_ROTEIRO}
          premountFor={fps}
        >
          <Roteiro />
        </TransitionSeries.Sequence>
        {transicao}
        <TransitionSeries.Sequence
          name="Teleprompter"
          durationInFrames={DURACAO_TELEPROMPTER}
          premountFor={fps}
        >
          <Teleprompter />
        </TransitionSeries.Sequence>
        {transicao}
        <TransitionSeries.Sequence
          name="Carrossel"
          durationInFrames={DURACAO_CARROSSEL}
          premountFor={fps}
        >
          <Carrossel />
        </TransitionSeries.Sequence>
        {transicao}
        <TransitionSeries.Sequence
          name="Ritmo"
          durationInFrames={DURACAO_RITMO}
          premountFor={fps}
        >
          <Ritmo />
        </TransitionSeries.Sequence>
        {transicao}
        <TransitionSeries.Sequence
          name="Oferta"
          durationInFrames={DURACAO_OFERTA}
          premountFor={fps}
        >
          <Oferta />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </>
  );
};
