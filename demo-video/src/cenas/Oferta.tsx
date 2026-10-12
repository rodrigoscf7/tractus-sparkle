// Cena 7: o convite, com o QR code que leva ao mês grátis. No vertical tudo
// empilhado; no horizontal, o convite à esquerda e o QR à direita.

import type React from "react";
import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { Check, ScanLine } from "lucide-react";
import { LINK_CONVITE, LINK_PROVISORIO } from "../dados";
import { cor, fonte } from "../marca";
import { entrada, progresso } from "../ui/anim";
import { Narracao } from "../ui/Narracao";
import { Som } from "../ui/Som";
import { PAISAGEM, useFormato } from "../ui/Palco";
import { QrCode } from "../ui/QrCode";
import { duracaoDaCena, falasDaCena } from "../voz/narracao";

const FALAS = falasDaCena("oferta");

// O QR fica na tela tempo bastante para alguém apontar a câmera.
export const DURACAO_OFERTA = duracaoDaCena("oferta", FALAS[1].de + 120, 60);

const INCLUSO = [
  "Plano da semana todo domingo",
  "Roteiros na sua voz",
  "Modo gravação",
  "Carrosséis com a sua identidade",
];

export const Oferta: React.FC = () => {
  const frame = useCurrentFrame();
  const { paisagem } = useFormato();
  const qr = FALAS[1].de - 10;

  return (
    <AbsoluteFill
      style={{
        background: cor.background,
        fontFamily: fonte.sans,
        color: cor.foreground,
      }}
    >
      <Narracao falas={FALAS} semTexto />
      <Som nome="marca" em={qr} volume={0.7} />

      {paisagem ? (
        <>
          <div
            style={{
              position: "absolute",
              left: PAISAGEM.margemTexto,
              top: 120,
              width: 900,
            }}
          >
            <Img
              src={staticFile("logo-fundo-claro.png")}
              style={{ width: 260, ...entrada(frame, 0, 16) }}
            />
            <div style={{ marginTop: 70 }}>
              <Convite frame={frame} tamanho={150} />
            </div>
            <Incluso frame={frame} fonte={36} />
          </div>
          <div
            style={{
              position: "absolute",
              right: 120,
              top: 150,
              width: 640,
              ...entrada(frame, qr, 18, 40),
            }}
          >
            <CartaoQr frame={frame} qr={qr} coluna />
          </div>
        </>
      ) : (
        <>
          <Img
            src={staticFile("logo-fundo-claro.png")}
            style={{
              position: "absolute",
              left: 80,
              top: 130,
              width: 330,
              ...entrada(frame, 0, 16),
            }}
          />
          <div style={{ position: "absolute", left: 80, right: 80, top: 380 }}>
            <Convite frame={frame} tamanho={172} />
            <Incluso frame={frame} fonte={42} />
          </div>
          <div
            style={{
              position: "absolute",
              left: 80,
              right: 80,
              top: 1250,
              ...entrada(frame, qr, 18, 40),
            }}
          >
            <CartaoQr frame={frame} qr={qr} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

const Convite: React.FC<{ frame: number; tamanho: number }> = ({
  frame,
  tamanho,
}) => {
  const grifo = progresso(frame, 16, 18);
  return (
    <>
      <div
        style={{
          fontFamily: fonte.mono,
          fontSize: 34,
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          color: cor.muted,
          ...entrada(frame, 4, 16),
        }}
      >
        Você ganhou
      </div>
      <div
        style={{
          marginTop: 16,
          fontFamily: fonte.display,
          fontWeight: 700,
          fontSize: tamanho,
          lineHeight: 1,
          letterSpacing: "-0.04em",
          ...entrada(frame, 8, 18, 40),
        }}
      >
        1 mês{" "}
        <span
          style={{
            backgroundImage: `linear-gradient(${cor.primary}, ${cor.primary})`,
            backgroundRepeat: "no-repeat",
            backgroundSize: `${grifo * 100}% 100%`,
            padding: "0 14px",
            margin: "0 -14px",
          }}
        >
          grátis
        </span>
      </div>
      <div
        style={{
          marginTop: 24,
          fontSize: tamanho * 0.3,
          lineHeight: 1.25,
          color: cor.muted,
          ...entrada(frame, 18, 16),
        }}
      >
        da prevIA, com tudo liberado.
      </div>
    </>
  );
};

const Incluso: React.FC<{ frame: number; fonte: number }> = ({
  frame,
  fonte: tamanho,
}) => (
  <div
    style={{
      marginTop: tamanho * 1.4,
      display: "flex",
      flexDirection: "column",
      gap: tamanho * 0.5,
    }}
  >
    {INCLUSO.map((item, i) => (
      <div
        key={item}
        style={{
          display: "flex",
          alignItems: "center",
          gap: tamanho * 0.5,
          fontSize: tamanho,
          ...entrada(frame, 30 + i * 6, 14),
        }}
      >
        <span
          style={{
            width: tamanho * 1.15,
            height: tamanho * 1.15,
            borderRadius: 10,
            background: cor.foreground,
            color: cor.background,
            display: "grid",
            placeItems: "center",
            flexShrink: 0,
          }}
        >
          <Check size={tamanho * 0.7} strokeWidth={3} />
        </span>
        {item}
      </div>
    ))}
  </div>
);

/** O QR e a chamada; `coluna` empilha (horizontal), senão lado a lado (vertical). */
const CartaoQr: React.FC<{ frame: number; qr: number; coluna?: boolean }> = ({
  frame,
  qr,
  coluna = false,
}) => {
  const pulso = interpolate(frame, [qr + 20, qr + 26, qr + 34], [1, 1.04, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return (
    <div
      style={{
        display: "flex",
        flexDirection: coluna ? "column" : "row",
        alignItems: "center",
        gap: coluna ? 32 : 44,
        padding: 36,
        borderRadius: 28,
        background: cor.surface,
        border: `2px solid ${cor.border}`,
        boxShadow: "0 20px 50px rgba(13, 13, 15, 0.10)",
        textAlign: coluna ? "center" : "left",
      }}
    >
      <div
        style={{
          position: "relative",
          flexShrink: 0,
          scale: String(pulso),
          padding: 10,
          borderRadius: 16,
          border: `6px solid ${cor.primary}`,
        }}
      >
        <QrCode texto={LINK_CONVITE} tamanho={coluna ? 400 : 360} />
        {LINK_CONVITE === LINK_PROVISORIO && (
          <div
            style={{
              position: "absolute",
              inset: 10,
              display: "grid",
              placeItems: "center",
              background: "rgba(180, 69, 31, 0.82)",
              color: "#fff",
              fontFamily: fonte.mono,
              fontSize: 30,
              textAlign: "center",
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              lineHeight: 1.3,
            }}
          >
            Link
            <br />
            provisório
          </div>
        )}
      </div>
      <div style={{ minWidth: 0 }}>
        <div
          style={{
            fontFamily: fonte.display,
            fontWeight: 700,
            fontSize: coluna ? 56 : 64,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          Leia o QR code
        </div>
        <div
          style={{
            marginTop: 10,
            fontSize: coluna ? 38 : 44,
            color: cor.muted,
          }}
        >
          e comece hoje.
        </div>
        <div
          style={{
            marginTop: coluna ? 20 : 28,
            display: "flex",
            alignItems: "center",
            justifyContent: coluna ? "center" : "flex-start",
            gap: 12,
            fontFamily: fonte.mono,
            fontSize: 26,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: cor.muted,
          }}
        >
          <ScanLine size={32} /> Aponte a câmera
        </div>
      </div>
    </div>
  );
};
