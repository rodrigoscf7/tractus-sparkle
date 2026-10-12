import type React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { cor, fonte } from "../marca";
import { progresso } from "./anim";
import { Som } from "./Som";

/**
 * Um toque de dedo na tela, em px de celular: um círculo que encolhe ao
 * apertar e se abre ao soltar, com o clique macio do efeito "toque".
 */
export const Toque: React.FC<{ x: number; y: number; em: number }> = ({
  x,
  y,
  em,
}) => (
  <>
    <Som nome="toque" em={em} />
    <CirculoDoToque x={x} y={y} em={em} />
  </>
);

const CirculoDoToque: React.FC<{ x: number; y: number; em: number }> = ({
  x,
  y,
  em,
}) => {
  const frame = useCurrentFrame();
  const t = frame - em;
  if (t < -8 || t > 22) return null;
  const chegada = interpolate(t, [-8, 0], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const aperto = interpolate(t, [0, 4, 10], [1, 0.82, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const onda = interpolate(t, [2, 22], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const saida = interpolate(t, [12, 22], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        zIndex: 60,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          left: -22,
          top: -22,
          borderRadius: 99,
          background: "rgba(13, 13, 15, 0.22)",
          border: "2px solid rgba(255, 255, 255, 0.9)",
          opacity: chegada * saida,
          scale: String(aperto),
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 44,
          height: 44,
          left: -22,
          top: -22,
          borderRadius: 99,
          border: "2px solid rgba(13, 13, 15, 0.35)",
          opacity: (1 - onda) * (t > 2 ? 1 : 0),
          scale: String(1 + onda * 1.4),
        }}
      />
    </div>
  );
};

/** Notificação do sistema descendo do topo do celular (textos de push-agent), com o aviso sonoro. */
export const NotificacaoPush: React.FC<{
  texto: string;
  em: number;
  ate?: number;
}> = (props) => (
  <>
    <Som nome="notificacao" em={props.em} />
    <BalaoDaNotificacao {...props} />
  </>
);

const BalaoDaNotificacao: React.FC<{
  texto: string;
  em: number;
  ate?: number;
}> = ({ texto, em, ate }) => {
  const frame = useCurrentFrame();
  const desce = progresso(frame, em, 18);
  const sobe = ate === undefined ? 0 : progresso(frame, ate, 14);
  if (frame < em) return null;

  return (
    <div
      style={{
        position: "absolute",
        left: 10,
        right: 10,
        top: 54,
        zIndex: 55,
        translate: `0px ${(1 - desce) * -140 + sobe * -160}px`,
        borderRadius: 22,
        padding: "12px 14px",
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        background: "rgba(250, 250, 248, 0.92)",
        boxShadow: "0 10px 30px rgba(13, 13, 15, 0.18)",
        border: "1px solid rgba(13, 13, 15, 0.06)",
        fontFamily: fonte.sans,
        color: cor.foreground,
      }}
    >
      <Img
        src={staticFile("icon-192.png")}
        style={{ width: 38, height: 38, borderRadius: 9, flexShrink: 0 }}
      />
      <div style={{ minWidth: 0, flex: 1 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: 13,
            color: cor.muted,
          }}
        >
          <span style={{ fontWeight: 600, color: cor.foreground }}>prevIA</span>
          <span>agora</span>
        </div>
        <div style={{ fontSize: 15, lineHeight: 1.35, marginTop: 1 }}>
          {texto}
        </div>
      </div>
    </div>
  );
};
