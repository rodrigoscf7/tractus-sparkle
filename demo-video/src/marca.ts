// Tokens do manual de marca (docs/manual-de-marca-previa.md), tema claro.
// Amarelo só em ação ou IA: nunca texto, nunca alerta, nunca decoração.

import { loadFont as carregarGeistMono } from "@remotion/google-fonts/GeistMono";
import { loadFont as carregarInter } from "@remotion/google-fonts/Inter";
import { loadFont as carregarSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";

const latim = { subsets: ["latin", "latin-ext"] as ("latin" | "latin-ext")[] };

export const fonte = {
  sans: carregarInter("normal", { weights: ["400", "500", "600"], ...latim })
    .fontFamily,
  display: carregarSpaceGrotesk("normal", {
    weights: ["500", "600", "700"],
    ...latim,
  }).fontFamily,
  mono: carregarGeistMono("normal", { weights: ["400", "500"], ...latim })
    .fontFamily,
};

export const cor = {
  background: "#F4F4F2",
  surface: "#FFFFFF",
  surfaceElevated: "#F7F7F5",
  foreground: "#0D0D0F",
  muted: "#6E6E76",
  subtle: "#8A8A92",
  primary: "#F4DB0B",
  /** primary a 20%: faixa de resumo e item ativo. */
  primarySoft: "rgba(244, 219, 11, 0.2)",
  secondary: "#EDEDE9",
  border: "#E4E4E0",
  divider: "#EDEDE9",
  terracota: "#B4451F",
  oliva: "#4A7A2E",
  aiSoft: "#FFF8CC",
  // Tema escuro (teleprompter).
  escuro: {
    background: "#1A1A1E",
    surface: "#26262B",
    foreground: "#F7F7F5",
    muted: "#A8A8B0",
    border: "#3F3F47",
  },
};

export const raio = { superficie: 12, controle: 8 };

/** O vídeo é 1080×1920, a 30 fps. */
export const VIDEO = { width: 1080, height: 1920, fps: 30 };

/**
 * A interface do app é desenhada em px de celular (390 de largura) e ampliada
 * por este fator dentro da moldura do aparelho.
 */
export const ESCALA_UI = 2.1;
export const LARGURA_TELA = 390;
