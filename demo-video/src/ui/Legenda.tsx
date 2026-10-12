import type React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { cor, fonte } from "../marca";
import { progresso } from "./anim";
import { PAISAGEM, useFormato } from "./Palco";

export type Fala = {
  /** Frame em que a fala entra; fica até a próxima. */
  readonly de: number;
  readonly texto: string;
  /** Trecho grifado em amarelo (no máximo um por cena). */
  readonly destaque?: string;
};

export const ALTURA_FAIXA = 560;

/**
 * A fala da cena em letra grande: no vertical, uma faixa no topo com o celular
 * passando por baixo; no horizontal, uma coluna à esquerda. Funciona sem som,
 * que é como o vídeo começa no WhatsApp.
 */
export const Legenda: React.FC<{
  readonly falas: readonly Fala[];
  readonly rotulo?: string;
  readonly escuro?: boolean;
}> = ({ falas, rotulo, escuro = false }) => {
  const frame = useCurrentFrame();
  const fundo = escuro ? cor.escuro.background : cor.background;
  const texto = escuro ? cor.escuro.foreground : cor.foreground;
  const apoio = escuro ? cor.escuro.muted : cor.muted;

  const atual = falas.reduce(
    (achada, f, i) => (frame >= f.de ? i : achada),
    -1,
  );
  const { paisagem } = useFormato();
  const esquerda = paisagem ? PAISAGEM.margemTexto : 80;
  const largura = paisagem ? PAISAGEM.larguraTexto : undefined;
  const topoRotulo = paisagem ? 330 : 120;
  const topoTexto = paisagem ? (rotulo ? 390 : 360) : rotulo ? 180 : 140;

  return (
    <div
      style={{
        position: "absolute",
        insetInline: 0,
        top: 0,
        height: paisagem ? "100%" : ALTURA_FAIXA,
        zIndex: 10,
        background: paisagem
          ? "transparent"
          : `linear-gradient(to bottom, ${fundo} 82%, ${fundo}00)`,
        pointerEvents: "none",
      }}
    >
      {rotulo && (
        <div
          style={{
            position: "absolute",
            left: esquerda,
            top: topoRotulo,
            fontFamily: fonte.mono,
            fontSize: 30,
            letterSpacing: "0.12em",
            textTransform: "uppercase",
            color: apoio,
            opacity: progresso(frame, 0, 15),
          }}
        >
          {rotulo}
        </div>
      )}
      {falas.map((f, i) => {
        if (i !== atual && i !== atual - 1) return null;
        // A anterior sai em 6 frames; a nova só entra depois, sem as duas se misturarem.
        const entrando = progresso(frame, f.de + (i > 0 ? 6 : 0), 14);
        const proxima = falas[i + 1];
        const saindo = proxima
          ? interpolate(frame, [proxima.de, proxima.de + 6], [0, 1], {
              extrapolateLeft: "clamp",
              extrapolateRight: "clamp",
            })
          : 0;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: esquerda,
              right: paisagem ? undefined : 80,
              width: largura,
              top: topoTexto,
              fontFamily: fonte.display,
              fontWeight: 700,
              fontSize: paisagem ? 84 : 82,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: texto,
              opacity: entrando * (1 - saindo),
              translate: `0px ${(1 - entrando) * 30 - saindo * 20}px`,
            }}
          >
            <TextoComDestaque
              texto={f.texto}
              destaque={f.destaque}
              progresso={progresso(frame, f.de + 16, 14)}
            />
          </div>
        );
      })}
    </div>
  );
};

/** O trecho de destaque ganha o marca-texto amarelo, que se desenha da esquerda. */
const TextoComDestaque: React.FC<{
  texto: string;
  destaque?: string;
  progresso: number;
}> = ({ texto, destaque, progresso: p }) => {
  const idx = destaque ? texto.indexOf(destaque) : -1;
  if (!destaque || idx < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, idx)}
      <span
        style={{
          backgroundImage: `linear-gradient(${cor.primary}, ${cor.primary})`,
          backgroundRepeat: "no-repeat",
          backgroundSize: `${p * 100}% 100%`,
          color: cor.foreground,
          boxDecorationBreak: "clone",
          WebkitBoxDecorationBreak: "clone",
          padding: "0 8px",
          margin: "0 -8px",
        }}
      >
        {destaque}
      </span>
      {texto.slice(idx + destaque.length)}
    </>
  );
};
