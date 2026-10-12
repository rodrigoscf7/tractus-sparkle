// Pílulas para o WhatsApp: uma funcionalidade por vídeo, sempre fechando com o
// convite. A primeira abre com o gancho, para quem vê a série do começo.

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
import { DURACAO_ROTEIRO, Roteiro } from "./cenas/Roteiro";
import { DURACAO_TELEPROMPTER, Teleprompter } from "./cenas/Teleprompter";
import { TRANSICAO } from "./Mestre";

export type CenaPilula =
  | "configuracao"
  | "plano"
  | "roteiro"
  | "teleprompter"
  | "carrossel";

const CENA: Record<
  CenaPilula,
  { nome: string; Componente: React.FC; duracao: number }
> = {
  configuracao: {
    nome: "Configuração",
    Componente: Configuracao,
    duracao: DURACAO_CONFIGURACAO,
  },
  plano: {
    nome: "Plano chegou",
    Componente: PlanoChegou,
    duracao: DURACAO_PLANO_CHEGOU,
  },
  roteiro: { nome: "Roteiro", Componente: Roteiro, duracao: DURACAO_ROTEIRO },
  teleprompter: {
    nome: "Teleprompter",
    Componente: Teleprompter,
    duracao: DURACAO_TELEPROMPTER,
  },
  carrossel: {
    nome: "Carrossel",
    Componente: Carrossel,
    duracao: DURACAO_CARROSSEL,
  },
};

const comGancho = (cena: CenaPilula) => cena === "configuracao";

export function duracaoPilula(cena: CenaPilula) {
  const gancho = comGancho(cena) ? DURACAO_GANCHO - TRANSICAO : 0;
  return gancho + CENA[cena].duracao + DURACAO_OFERTA - TRANSICAO;
}

export const Pilula: React.FC<{ readonly cena: CenaPilula }> = ({ cena }) => {
  const { fps } = useVideoConfig();
  const { nome, Componente, duracao } = CENA[cena];
  const transicao = (
    <TransitionSeries.Transition
      presentation={fade()}
      timing={linearTiming({ durationInFrames: TRANSICAO })}
    />
  );

  const duracoes = [
    ...(comGancho(cena) ? [DURACAO_GANCHO] : []),
    duracao,
    DURACAO_OFERTA,
  ];

  return (
    <>
      <SonsDasTransicoes duracoes={duracoes} transicao={TRANSICAO} />
      <TransitionSeries>
        {comGancho(cena) && (
          <TransitionSeries.Sequence
            name="Gancho"
            durationInFrames={DURACAO_GANCHO}
            premountFor={fps}
          >
            <Gancho />
          </TransitionSeries.Sequence>
        )}
        {comGancho(cena) && transicao}
        <TransitionSeries.Sequence
          name={nome}
          durationInFrames={duracao}
          premountFor={fps}
        >
          <Componente />
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
