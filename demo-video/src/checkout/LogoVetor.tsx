// O logo da prevIA redesenhado em vetor (texto + caixa), para sair nítido em
// qualquer tamanho. Proporções tiradas de public/logo-fundo-claro.png
// (600×216): "prev" em Poppins regular, "IA" em Poppins negrito na caixa amarela.

import type React from "react";
import { AbsoluteFill } from "remotion";
import { loadFont } from "@remotion/google-fonts/Poppins";

const { fontFamily: POPPINS } = loadFont("normal", { weights: ["400", "700"], subsets: ["latin"] });

/** Amarelo do arquivo original do logo (um pouco mais vivo que o token da UI). */
const AMARELO = "#FFE000";
const GRAFITE = "#0D0D0F";

/** O logo com `largura` px. Altura = largura × 0,315. */
export const LogoVetor: React.FC<{ largura: number }> = ({ largura }) => {
  const u = largura / 560;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 30 * u, fontFamily: POPPINS, color: GRAFITE }}>
      <span
        style={{
          fontSize: 158 * u,
          fontWeight: 400,
          lineHeight: 1,
          letterSpacing: "-0.01em",
          position: "relative",
          top: -8 * u,
        }}
      >
        prev
      </span>
      <span
        style={{
          width: 215 * u,
          height: 176 * u,
          borderRadius: 34 * u,
          background: AMARELO,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 128 * u,
          fontWeight: 700,
          lineHeight: 1,
          paddingTop: 6 * u,
          boxSizing: "border-box",
        }}
      >
        IA
      </span>
    </div>
  );
};

/** Capa do produto na Hubla: o logo centralizado com folga para enquadrar. */
export const CapaLogo: React.FC = () => (
  <AbsoluteFill style={{ background: "#FFFFFF", alignItems: "center", justifyContent: "center" }}>
    <LogoVetor largura={900} />
  </AbsoluteFill>
);

/** Só o logo, fundo transparente, em alta resolução, com margem em volta. */
export const LogoAlta: React.FC = () => (
  <AbsoluteFill style={{ background: "transparent", alignItems: "center", justifyContent: "center" }}>
    <LogoVetor largura={2000} />
  </AbsoluteFill>
);
