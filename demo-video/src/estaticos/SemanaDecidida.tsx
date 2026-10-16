// Criativo 4: o plano da semana já pronto, uma versão por área. Mostra a
// assinatura funcionando; o CTA continua levando ao diagnóstico gratuito.

import type React from "react";
import { cor, fonte } from "../marca";
import { AREAS, type Area } from "./areas";
import { Eyebrow, Peca, useStories } from "./Peca";

export const SemanaDecidida: React.FC<{ area: Area }> = ({ area }) => {
  const stories = useStories();
  const dados = AREAS[area];
  const primeira = dados.plano[0]!.data;
  const ultima = dados.plano[dados.plano.length - 1]!.data;

  return (
    <Peca
      titulo="Sua semana de conteúdo, decidida antes de segunda-feira"
      cta="Fazer o diagnóstico gratuito"
      micro="Comece pelo diagnóstico · 2 minutos"
    >
      <div
        style={{
          background: cor.surface,
          border: `2px solid ${cor.border}`,
          borderRadius: 28,
          padding: stories ? "44px 44px 20px" : "34px 38px 12px",
          boxShadow: "0 2px 6px rgba(13, 13, 15, 0.04)",
        }}
      >
        <Eyebrow>
          Plano da semana · {primeira} a {ultima}
        </Eyebrow>
        <div style={{ marginTop: 6, fontSize: 26, color: cor.muted }}>{dados.rotulo}</div>

        <div style={{ marginTop: 12 }}>
          {dados.plano.map((p, i) => (
            <div
              key={p.dia}
              style={{
                display: "flex",
                gap: 28,
                padding: stories ? "32px 0" : "24px 0",
                borderTop: i === 0 ? "none" : `2px solid ${cor.divider}`,
              }}
            >
              <div style={{ width: 86, flexShrink: 0 }}>
                <div
                  style={{
                    fontFamily: fonte.display,
                    fontWeight: 600,
                    fontSize: 36,
                    textTransform: "uppercase",
                  }}
                >
                  {p.dia}
                </div>
                <div
                  style={{
                    fontFamily: fonte.mono,
                    fontSize: 20,
                    color: cor.muted,
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {p.data}
                </div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: stories ? 34 : 31, lineHeight: 1.25 }}>
                  {p.tema}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    paddingLeft: 16,
                    borderLeft: `5px solid ${cor.primary}`,
                    fontSize: stories ? 29 : 26,
                    lineHeight: 1.35,
                    color: cor.muted,
                  }}
                >
                  “{p.gancho}”
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Peca>
  );
};
