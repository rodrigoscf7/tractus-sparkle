// O mesmo vídeo em 9:16 e em 16:9.
//
// As cenas são desenhadas no quadro vertical (1080×1920). No horizontal, a fala
// vai para uma coluna à esquerda (Legenda) e o resto da cena — o celular, os
// slides — entra numa janela à direita: o trecho do quadro vertical abaixo da
// faixa da fala, reduzido. Enquadramentos e movimentos de câmera ficam iguais.

import type React from "react";
import { useVideoConfig } from "remotion";

export function useFormato() {
  const { width, height } = useVideoConfig();
  return { paisagem: width > height };
}

/** Trecho do quadro vertical que aparece no horizontal (de y = TOPO até o fim). */
const TOPO = 500;
const ALTURA_VERTICAL = 1920;
const LARGURA_VERTICAL = 1080;
/** Margem direita da janela no quadro horizontal. */
const MARGEM = 90;

/** Onde começa a coluna da fala, à esquerda da janela. */
export const PAISAGEM = { margemTexto: 120, larguraTexto: 860 };

export const Palco: React.FC<{
  readonly children: React.ReactNode;
  /** Onde a janela começa no quadro vertical; cenas sem celular centralizam o conteúdo. */
  readonly topo?: number;
}> = ({ children, topo = TOPO }) => {
  const { paisagem } = useFormato();
  const { width, height } = useVideoConfig();
  if (!paisagem) return <>{children}</>;

  const escala = height / (ALTURA_VERTICAL - TOPO);
  const largura = LARGURA_VERTICAL * escala;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: width - largura - MARGEM,
        width: largura,
        height,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: -topo * escala,
          width: LARGURA_VERTICAL,
          height: ALTURA_VERTICAL,
          scale: String(escala),
          transformOrigin: "top left",
        }}
      >
        {children}
      </div>
    </div>
  );
};
