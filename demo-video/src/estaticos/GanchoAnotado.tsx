// Criativo 2: um gancho real (roteiro curado "Quebra de mito", src/lib/
// dna-viral.ts) dividido em três partes, cada uma com o porquê. As notas
// descrevem a frase, nunca garantem conformidade com a OAB.

import type React from "react";
import { cor, fonte } from "../marca";
import { Eyebrow, Peca, useStories, type Variante } from "./Peca";

const PARTES = [
  {
    trecho: "O maior mito sobre isso",
    nota: "Abre com uma crença que o seu cliente tem.",
  },
  {
    trecho: " é achar que basta estar com a razão.",
    nota: "Contraria o senso comum. É o que segura os três primeiros segundos.",
  },
  {
    trecho: " Estar certo é só metade do caminho.",
    nota: "Cria curiosidade sem prometer resultado, como pede o Provimento 205.",
  },
];

export const GanchoAnotado: React.FC<{ variante: Variante }> = ({ variante }) => {
  const stories = useStories();
  return (
    <Peca
      titulo={
        variante === "A"
          ? "Por que esse gancho prende e não fere o Provimento 205"
          : "Três segundos de gancho, explicados parte por parte"
      }
      cta="Receber 3 roteiros pro meu nicho"
      micro="Diagnóstico gratuito · 2 minutos"
    >
      <div
        style={{
          background: cor.surface,
          border: `2px solid ${cor.border}`,
          borderRadius: 28,
          padding: "40px 44px",
          boxShadow: "0 2px 6px rgba(13, 13, 15, 0.04)",
        }}
      >
        <Eyebrow>Gancho · Roteiro de quebra de mito</Eyebrow>
        <p
          style={{
            margin: "18px 0 0",
            fontFamily: fonte.display,
            fontWeight: 500,
            fontSize: 44,
            lineHeight: 1.4,
          }}
        >
          “
          {PARTES.map((p, i) => (
            <span key={p.trecho}>
              <span
                style={{
                  background: cor.aiSoft,
                  borderBottom: `4px solid ${cor.primary}`,
                  padding: "0 2px",
                  boxDecorationBreak: "clone",
                  WebkitBoxDecorationBreak: "clone",
                }}
              >
                {p.trecho}
              </span>
              <Numero n={i + 1} />
            </span>
          ))}
          ”
        </p>

        <div
          style={{
            marginTop: 36,
            paddingTop: 30,
            borderTop: `2px solid ${cor.divider}`,
            display: "flex",
            flexDirection: "column",
            gap: stories ? 26 : 22,
          }}
        >
          {PARTES.map((p, i) => (
            <div key={p.nota} style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <Numero n={i + 1} grande />
              <span style={{ fontSize: stories ? 34 : 32, lineHeight: 1.35 }}>{p.nota}</span>
            </div>
          ))}
        </div>
      </div>
    </Peca>
  );
};

const Numero: React.FC<{ n: number; grande?: boolean }> = ({ n, grande = false }) => (
  <span
    style={{
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      flexShrink: 0,
      width: grande ? 46 : 34,
      height: grande ? 46 : 34,
      marginLeft: grande ? 0 : 6,
      marginTop: grande ? 0 : 0,
      verticalAlign: "super",
      borderRadius: 23,
      background: cor.foreground,
      color: cor.surface,
      fontFamily: fonte.mono,
      fontSize: grande ? 24 : 18,
      fontWeight: 500,
      lineHeight: 1,
    }}
  >
    {n}
  </span>
);
