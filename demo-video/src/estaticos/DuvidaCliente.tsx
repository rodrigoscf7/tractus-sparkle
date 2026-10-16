// Criativo 3: as dúvidas que o cliente deixa nos comentários antes de
// contratar, uma versão por área. Comentários fictícios; a peça diz isso.

import type React from "react";
import { Heart } from "lucide-react";
import { cor, fonte } from "../marca";
import { AREAS, type Area } from "./areas";
import { Eyebrow, Peca, useStories } from "./Peca";

export const DuvidaCliente: React.FC<{ area: Area }> = ({ area }) => {
  const stories = useStories();
  const dados = AREAS[area];

  return (
    <Peca
      titulo="Seu cliente faz essa pergunta antes de te contratar"
      apoio="Ela já está respondida no seu Instagram?"
      cta="Receber 3 roteiros pra minha área"
      micro="Diagnóstico gratuito · 2 minutos"
    >
      <div
        style={{
          background: cor.surface,
          border: `2px solid ${cor.border}`,
          borderRadius: 28,
          padding: stories ? "40px 40px 16px" : "32px 36px 8px",
          boxShadow: "0 2px 6px rgba(13, 13, 15, 0.04)",
        }}
      >
        <Eyebrow>Comentários · {dados.rotulo}</Eyebrow>
        <div style={{ marginTop: 10 }}>
          {dados.comentarios.slice(0, 2).map((c, i) => (
            <div
              key={c.usuario}
              style={{
                display: "flex",
                gap: 20,
                padding: stories ? "28px 0" : "24px 0",
                borderTop: i === 0 ? "none" : `2px solid ${cor.divider}`,
              }}
            >
              <div
                style={{
                  width: 60,
                  height: 60,
                  flexShrink: 0,
                  borderRadius: 30,
                  background: cor.secondary,
                  color: cor.muted,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontWeight: 600,
                  fontSize: 26,
                }}
              >
                {c.usuario[0]!.toUpperCase()}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 24, color: cor.muted }}>
                  <span style={{ fontWeight: 600, color: cor.foreground }}>{c.usuario}</span> · {c.tempo}
                </div>
                <div
                  style={{
                    marginTop: 6,
                    fontSize: stories ? 35 : 33,
                    lineHeight: 1.3,
                    fontWeight: i === 0 ? 600 : 400,
                  }}
                >
                  {c.texto}
                </div>
                <div
                  style={{
                    marginTop: 10,
                    fontSize: 22,
                    fontWeight: 600,
                    color: cor.subtle,
                    fontFamily: fonte.sans,
                  }}
                >
                  Responder
                </div>
              </div>
              <Heart size={26} color={cor.subtle} strokeWidth={2} style={{ marginTop: 34 }} />
            </div>
          ))}
        </div>
      </div>
      <Eyebrow style={{ marginTop: 18, fontSize: 20, textAlign: "center" }}>
        Comentários ilustrativos
      </Eyebrow>
    </Peca>
  );
};
