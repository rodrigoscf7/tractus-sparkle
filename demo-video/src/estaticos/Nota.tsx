// Formato 2: a nota do perfil. Mesmas quatro dimensões, faixas (<40, <70, 70+)
// e cores do painel do relatório (src/lib/dna-viral-score.ts e
// src/routes/dna-viral.$token.tsx): terracota até 69, oliva a partir de 70.
// Os valores são de exemplo, e a peça diz isso.

import type React from "react";
import { cor, fonte } from "../marca";
import { Eyebrow, Peca, useStories, type Variante } from "./Peca";

const DIMENSOES = [
  { rotulo: "Clareza", valor: 34 },
  { rotulo: "Frequência", valor: 22 },
  { rotulo: "Potencial Viral", valor: 58 },
  { rotulo: "Conexão com o Público", valor: 76 },
];

const corDaFaixa = (v: number) => (v >= 70 ? cor.oliva : cor.terracota);

export const Nota: React.FC<{ variante: Variante }> = ({ variante }) => {
  const stories = useStories();
  const a = variante === "A";

  return (
    <Peca
      titulo={
        a ? "Em qual dessas o seu perfil está no vermelho?" : "Seu Instagram tem uma nota. Você sabe qual é?"
      }
      cta="Ver a nota do meu perfil"
      micro="Gratuito · resultado em 2 minutos"
    >
      <div
        style={{
          background: cor.surface,
          border: `2px solid ${cor.border}`,
          borderRadius: 28,
          padding: stories ? "56px 52px" : "44px 48px",
          boxShadow: "0 2px 6px rgba(13, 13, 15, 0.04)",
        }}
      >
        <Eyebrow>Status atual do seu perfil</Eyebrow>
        <div
          style={{
            marginTop: 14,
            fontFamily: fonte.display,
            fontWeight: 600,
            fontSize: stories ? 44 : 40,
            lineHeight: 1.15,
            letterSpacing: "-0.01em",
          }}
        >
          Eficiência Comprometida por Frequência Baixa
        </div>

        <div style={{ marginTop: stories ? 52 : 40, display: "flex", flexDirection: "column", gap: stories ? 40 : 32 }}>
          {DIMENSOES.map((d) => (
            <div key={d.rotulo}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "baseline",
                  marginBottom: 14,
                  fontSize: stories ? 36 : 33,
                }}
              >
                <span>{d.rotulo}</span>
                <span
                  style={{
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    color: corDaFaixa(d.valor),
                  }}
                >
                  {d.valor}%
                </span>
              </div>
              <div style={{ height: 16, borderRadius: 8, background: cor.border, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${d.valor}%`,
                    height: "100%",
                    borderRadius: 8,
                    background: corDaFaixa(d.valor),
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
      <Eyebrow style={{ marginTop: 18, marginBottom: 8, fontSize: 20, textAlign: "center" }}>
        Exemplo de diagnóstico
      </Eyebrow>
    </Peca>
  );
};
