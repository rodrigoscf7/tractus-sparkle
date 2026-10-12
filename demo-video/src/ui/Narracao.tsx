import type React from "react";
import { Audio } from "@remotion/media";
import { staticFile, useVideoConfig } from "remotion";
import type { FalaNaCena } from "../voz/narracao";
import { Legenda } from "./Legenda";

/** A voz da cena e a mesma fala escrita no topo, no mesmo tempo. */
export const Narracao: React.FC<{
  readonly falas: readonly FalaNaCena[];
  readonly rotulo?: string;
  readonly escuro?: boolean;
  /** Só a voz: a cena desenha o texto do seu jeito. */
  readonly semTexto?: boolean;
}> = ({ falas, rotulo, escuro, semTexto = false }) => {
  const { fps } = useVideoConfig();
  return (
    <>
      {!semTexto && <Legenda falas={falas} rotulo={rotulo} escuro={escuro} />}
      {falas.map(
        (f) =>
          f.audio && (
            <Audio
              key={f.id}
              name={f.id}
              src={staticFile(f.audio.src)}
              from={f.de}
              trimBefore={f.audio.trimBefore}
              trimAfter={f.audio.trimAfter}
              // Folga para os efeitos sonoros somarem sem estourar.
              volume={0.85}
              premountFor={fps}
            />
          ),
      )}
    </>
  );
};
