// Um card de carrossel de anúncio, 1080×1350 (4:5). Pouca coisa na tela: logo
// e contador no topo, o texto grande no meio. Amarelo só no botão do último
// card, como manda o manual de marca.

import type React from "react";
import { ArrowRight } from "lucide-react";
import { AbsoluteFill, Img, staticFile } from "remotion";
import { cor, fonte } from "../marca";
import { CARROSSEIS, type Card } from "./textos";

const MARGEM = 96;

/** Texto mais longo, letra menor: o card nunca transborda. */
function tamanhoDo(texto: string): number {
  if (texto.length <= 60) return 84;
  if (texto.length <= 95) return 72;
  return 62;
}

export const CardCarrossel: React.FC<{ carrossel: string; indice: number }> = ({
  carrossel,
  indice,
}) => {
  const c = CARROSSEIS.find((x) => x.id === carrossel)!;
  const card = c.cards[indice]!;
  const total = c.cards.length;

  return (
    <AbsoluteFill
      style={{
        background: cor.background,
        color: cor.foreground,
        fontFamily: fonte.sans,
        WebkitFontSmoothing: "antialiased",
        padding: MARGEM,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Img src={staticFile("logo-fundo-claro.png")} style={{ height: 40, width: "auto" }} />
        <span
          style={{
            fontFamily: fonte.mono,
            fontSize: 26,
            letterSpacing: "0.08em",
            color: cor.subtle,
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {String(indice + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}
        </span>
      </div>

      <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center" }}>
        <Conteudo card={card} />
      </div>

      {card.tipo === "capa" && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            fontFamily: fonte.mono,
            fontSize: 26,
            letterSpacing: "0.1em",
            textTransform: "uppercase",
            color: cor.muted,
          }}
        >
          Arrasta pro lado <ArrowRight size={28} strokeWidth={2.2} />
        </div>
      )}
    </AbsoluteFill>
  );
};

const titulo: React.CSSProperties = {
  margin: 0,
  fontFamily: fonte.display,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  lineHeight: 1.08,
  textWrap: "balance",
};

const rotulo: React.CSSProperties = {
  fontFamily: fonte.mono,
  fontSize: 28,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: cor.muted,
  marginBottom: 32,
};

const Conteudo: React.FC<{ card: Card }> = ({ card }) => {
  if (card.tipo === "capa") {
    return (
      <>
        <h1 style={{ ...titulo, fontSize: card.texto.length <= 45 ? 104 : 88 }}>{card.texto}</h1>
        {card.apoio && (
          <p style={{ margin: "36px 0 0", fontSize: 48, lineHeight: 1.3, color: cor.muted }}>
            {card.apoio}
          </p>
        )}
      </>
    );
  }

  if (card.tipo === "texto") {
    return (
      <>
        {card.rotulo && <div style={rotulo}>{card.rotulo}</div>}
        <p style={{ ...titulo, fontWeight: 500, fontSize: tamanhoDo(card.texto), lineHeight: 1.18 }}>
          {card.texto}
        </p>
      </>
    );
  }

  if (card.tipo === "perfil") {
    return (
      <>
        <div style={rotulo}>{card.rotulo}</div>
        <h2 style={{ ...titulo, fontSize: 92 }}>{card.nome}</h2>
        <p
          style={{
            margin: "44px 0 0",
            paddingLeft: 28,
            borderLeft: `6px solid ${cor.foreground}`,
            fontSize: 50,
            lineHeight: 1.32,
            textWrap: "pretty",
          }}
        >
          {card.frase}
        </p>
        {card.comeco && (
          <div style={{ marginTop: 56 }}>
            <div style={{ ...rotulo, marginBottom: 14 }}>Por onde começar</div>
            <p style={{ margin: 0, fontSize: 40, lineHeight: 1.35, color: cor.muted, textWrap: "pretty" }}>
              {card.comeco}
            </p>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <h2 style={{ ...titulo, fontSize: 88 }}>{card.texto}</h2>
      <p style={{ margin: "32px 0 0", fontSize: 44, lineHeight: 1.35, color: cor.muted }}>
        {card.apoio}
      </p>
      <div
        style={{
          marginTop: 64,
          height: 124,
          borderRadius: 18,
          background: cor.primary,
          color: cor.foreground,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          fontSize: 44,
          fontWeight: 600,
        }}
      >
        {card.botao} <ArrowRight size={44} strokeWidth={2.4} />
      </div>
      <div
        style={{
          marginTop: 22,
          textAlign: "center",
          fontFamily: fonte.mono,
          fontSize: 26,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          color: cor.muted,
        }}
      >
        {card.micro}
      </div>
    </>
  );
};
