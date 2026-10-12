import type React from "react";
import { BatteryFull, Signal, Wifi } from "lucide-react";
import { cor, ESCALA_UI, fonte, LARGURA_TELA } from "../marca";

export const ALTURA_TELA = 844;
const BORDA = 12;

/** Largura e altura do aparelho no vídeo, em px do vídeo. */
export const TAMANHO_CELULAR = {
  width: (LARGURA_TELA + BORDA * 2) * ESCALA_UI,
  height: (ALTURA_TELA + BORDA * 2) * ESCALA_UI,
};

type Props = {
  readonly children: React.ReactNode;
  /** Por cima da tela (notificação, toque), fora da rolagem. */
  readonly sobreposicao?: React.ReactNode;
  readonly escuro?: boolean;
  readonly style?: React.CSSProperties;
};

/**
 * Um aparelho com a tela do app. Tudo dentro é desenhado em px de celular
 * (390 de largura) e ampliado por ESCALA_UI.
 */
export const Celular: React.FC<Props> = ({
  children,
  sobreposicao,
  escuro = false,
  style,
}) => {
  const fundo = escuro ? cor.escuro.background : cor.background;
  const texto = escuro ? cor.escuro.foreground : cor.foreground;

  return (
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 0,
        width: TAMANHO_CELULAR.width,
        height: TAMANHO_CELULAR.height,
        marginLeft: -TAMANHO_CELULAR.width / 2,
        ...style,
      }}
    >
      <div
        style={{
          width: LARGURA_TELA + BORDA * 2,
          height: ALTURA_TELA + BORDA * 2,
          scale: String(ESCALA_UI),
          transformOrigin: "top left",
          padding: BORDA,
          borderRadius: 58,
          background: "#0D0D0F",
          boxShadow:
            "0 30px 60px rgba(13, 13, 15, 0.18), 0 8px 18px rgba(13, 13, 15, 0.10)",
        }}
      >
        <div
          style={{
            position: "relative",
            width: LARGURA_TELA,
            height: ALTURA_TELA,
            borderRadius: 46,
            overflow: "hidden",
            background: fundo,
            color: texto,
            fontFamily: fonte.sans,
            fontSize: 16,
            lineHeight: 1.5,
            WebkitFontSmoothing: "antialiased",
          }}
        >
          {children}
          <BarraDeStatus cor={texto} />
          {sobreposicao}
        </div>
      </div>
    </div>
  );
};

const BarraDeStatus: React.FC<{ cor: string }> = ({ cor: c }) => (
  <div
    style={{
      position: "absolute",
      insetInline: 0,
      top: 0,
      height: 50,
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      padding: "6px 30px 0",
      color: c,
      fontWeight: 600,
      fontSize: 16,
      zIndex: 50,
      pointerEvents: "none",
    }}
  >
    <span style={{ fontVariantNumeric: "tabular-nums" }}>12:00</span>
    <div
      style={{
        position: "absolute",
        left: "50%",
        top: 11,
        width: 120,
        height: 34,
        marginLeft: -60,
        borderRadius: 20,
        background: "#000",
      }}
    />
    <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
      <Signal size={16} strokeWidth={2.5} />
      <Wifi size={16} strokeWidth={2.5} />
      <BatteryFull size={22} strokeWidth={2} />
    </span>
  </div>
);
