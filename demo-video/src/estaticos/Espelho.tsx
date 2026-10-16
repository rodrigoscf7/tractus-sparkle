// Criativo 5: o espelho. A frase de um arquétipo em destaque e os 6 perfis
// que o diagnóstico pode dar, com o da peça marcado. Nomes e frases vêm do
// próprio app (ARQUETIPOS_DO_QUIZ): o anúncio promete o que o relatório entrega.

import type React from "react";
import { ARQUETIPOS_DO_QUIZ } from "@/lib/dna-viral";
import { cor, fonte } from "../marca";
import { Eyebrow, Peca, useStories } from "./Peca";

export const Espelho: React.FC<{ situacao: string }> = ({ situacao }) => {
  const stories = useStories();
  const atual = ARQUETIPOS_DO_QUIZ.find((a) => a.situacao === situacao) ?? ARQUETIPOS_DO_QUIZ[0]!;

  return (
    <Peca
      titulo={atual.uma_linha}
      cta="Descobrir o meu perfil"
      micro="Diagnóstico gratuito · 11 perguntas"
    >
      <Eyebrow style={{ marginBottom: stories ? 22 : 18 }}>
        Os {ARQUETIPOS_DO_QUIZ.length} perfis do diagnóstico · qual é o seu?
      </Eyebrow>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
          gap: stories ? 18 : 14,
        }}
      >
        {ARQUETIPOS_DO_QUIZ.map((a) => {
          const marcado = a.situacao === atual.situacao;
          return (
            <div
              key={a.situacao}
              style={{
                position: "relative",
                background: cor.surface,
                border: `${marcado ? 3 : 2}px solid ${marcado ? cor.foreground : cor.border}`,
                borderRadius: 20,
                padding: stories ? "30px 28px" : "24px 26px",
                fontFamily: fonte.display,
                fontWeight: marcado ? 600 : 500,
                fontSize: stories ? 32 : 29,
                lineHeight: 1.2,
                color: marcado ? cor.foreground : cor.muted,
              }}
            >
              {marcado && (
                <div
                  style={{
                    position: "absolute",
                    top: 14,
                    right: 14,
                    width: 18,
                    height: 18,
                    borderRadius: 4,
                    background: cor.primary,
                  }}
                />
              )}
              {a.nome}
            </div>
          );
        })}
      </div>
    </Peca>
  );
};
