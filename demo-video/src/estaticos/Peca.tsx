// Moldura comum dos criativos estáticos: logo, título, conteúdo e CTA.
// Feed 4:5 (1080×1350) e Stories 9:16 (1080×1920). No 9:16 o topo e o pé
// ficam livres: é onde o Instagram desenha o perfil, a barra e o botão.

import type React from "react";
import { ArrowRight } from "lucide-react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { cor, fonte } from "../marca";

export type Variante = "A" | "B";

export function useStories(): boolean {
  const { height } = useVideoConfig();
  return height > 1500;
}

type Props = {
  readonly titulo: React.ReactNode;
  readonly apoio?: React.ReactNode;
  readonly cta: string;
  readonly micro: string;
  readonly children: React.ReactNode;
  /** Conteúdo encosta no pé da peça (o celular sangra para baixo). */
  readonly sangrar?: boolean;
};

export const Peca: React.FC<Props> = ({
  titulo,
  apoio,
  cta,
  micro,
  children,
  sangrar = false,
}) => {
  const stories = useStories();
  const topo = stories ? 250 : 72;
  const pe = stories ? 330 : 72;

  return (
    <AbsoluteFill
      style={{
        background: cor.background,
        color: cor.foreground,
        fontFamily: fonte.sans,
        WebkitFontSmoothing: "antialiased",
        paddingTop: topo,
        paddingBottom: sangrar ? 0 : pe,
        paddingInline: 80,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <Img
        src={staticFile("logo-fundo-claro.png")}
        style={{ height: stories ? 60 : 52, width: "auto", alignSelf: "flex-start" }}
      />

      <h1
        style={{
          margin: `${stories ? 56 : 40}px 0 0`,
          fontFamily: fonte.display,
          fontWeight: 600,
          fontSize: stories ? 80 : 72,
          lineHeight: 1.06,
          letterSpacing: "-0.02em",
          textWrap: "balance",
        }}
      >
        {titulo}
      </h1>
      {apoio && (
        <p
          style={{
            margin: "20px 0 0",
            fontSize: stories ? 38 : 34,
            lineHeight: 1.35,
            color: cor.muted,
          }}
        >
          {apoio}
        </p>
      )}

      <div
        style={{
          flex: 1,
          minHeight: 0,
          position: "relative",
          marginTop: stories ? 56 : 40,
          display: "flex",
          flexDirection: "column",
          justifyContent: sangrar ? "flex-start" : "center",
        }}
      >
        {children}
      </div>

      <div
        style={
          sangrar
            ? {
                position: "absolute",
                insetInline: 0,
                bottom: 0,
                paddingInline: 80,
                paddingBottom: pe,
                paddingTop: 160,
                background: `linear-gradient(to bottom, rgba(244,244,242,0) 0%, ${cor.background} 28%)`,
              }
            : { marginTop: stories ? 56 : 40 }
        }
      >
        <Cta texto={cta} micro={micro} />
      </div>
    </AbsoluteFill>
  );
};

/** Botão primário do manual: fundo amarelo, texto grafite. */
const Cta: React.FC<{ texto: string; micro: string }> = ({ texto, micro }) => {
  const stories = useStories();
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
      <div
        style={{
          width: "100%",
          height: stories ? 124 : 112,
          borderRadius: 18,
          background: cor.primary,
          color: cor.foreground,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontSize: stories ? 42 : 38,
          fontWeight: 600,
        }}
      >
        {texto}
        <ArrowRight size={stories ? 42 : 38} strokeWidth={2.4} />
      </div>
      <div
        style={{
          fontFamily: fonte.mono,
          fontSize: stories ? 26 : 24,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: cor.muted,
        }}
      >
        {micro}
      </div>
    </div>
  );
};

/** Rótulo de seção do manual: mono, maiúsculas, espaçado. */
export const Eyebrow: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({
  children,
  style,
}) => (
  <div
    style={{
      fontFamily: fonte.mono,
      fontSize: 24,
      letterSpacing: "0.1em",
      textTransform: "uppercase",
      color: cor.muted,
      ...style,
    }}
  >
    {children}
  </div>
);
