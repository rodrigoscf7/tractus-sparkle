// Formato 1: a pergunta do quiz como anúncio. Pergunta e opções são as do quiz
// real (src/lib/quiz-oferta.ts, pergunta 5 de 11): quem clica encontra a mesma
// tela do outro lado.

import type React from "react";
import { Check } from "lucide-react";
import { cor, fonte } from "../marca";
import { Eyebrow, Peca, useStories, type Variante } from "./Peca";

const PERGUNTA = "O que acontece hoje quando você senta pra gravar?";

const OPCOES = [
  "Não sei o que postar",
  "Tenho ideias, mas não sei transformar em roteiro",
  "Falta tempo para produzir",
  "Gravo, mas não tenho constância",
];

export const Quiz: React.FC<{ variante: Variante }> = ({ variante }) => {
  const stories = useStories();
  const a = variante === "A";

  return (
    <Peca
      titulo={a ? PERGUNTA : "Qual dessas trava o seu Instagram hoje?"}
      cta={a ? "Fazer meu diagnóstico" : "Descobrir o meu diagnóstico"}
      micro="Gratuito · 11 perguntas · resultado na hora"
    >
      {a && <Progresso />}
      <div style={{ display: "flex", flexDirection: "column", gap: stories ? 24 : 20 }}>
        {OPCOES.map((texto, i) => (
          <Opcao key={texto} texto={texto} marcada={a && i === 1} />
        ))}
      </div>
    </Peca>
  );
};

const Progresso: React.FC = () => (
  <div style={{ marginBottom: 36 }}>
    <Eyebrow style={{ marginBottom: 14 }}>Pergunta 5 de 11</Eyebrow>
    <div style={{ height: 8, borderRadius: 4, background: cor.divider, overflow: "hidden" }}>
      <div style={{ width: `${(5 / 11) * 100}%`, height: "100%", background: cor.primary }} />
    </div>
  </div>
);

/** Card de escolha do manual: ativo com borda grafite e quadrado amarelo. */
const Opcao: React.FC<{ texto: string; marcada: boolean }> = ({ texto, marcada }) => {
  const stories = useStories();
  return (
    <div
      style={{
        position: "relative",
        background: cor.surface,
        border: `${marcada ? 3 : 2}px solid ${marcada ? cor.foreground : cor.border}`,
        borderRadius: 24,
        padding: stories ? "38px 40px" : "30px 36px",
        fontSize: stories ? 40 : 36,
        lineHeight: 1.25,
        fontWeight: marcada ? 600 : 500,
        display: "flex",
        alignItems: "center",
        gap: 26,
        boxShadow: "0 2px 6px rgba(13, 13, 15, 0.04)",
      }}
    >
      <div
        style={{
          width: 30,
          height: 30,
          flexShrink: 0,
          borderRadius: 6,
          border: `2px solid ${marcada ? cor.foreground : cor.subtle}`,
          background: marcada ? cor.foreground : cor.surface,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {marcada && <Check size={22} strokeWidth={3.5} color={cor.surface} />}
      </div>
      <span style={{ fontFamily: fonte.sans }}>{texto}</span>
      {marcada && (
        <div
          style={{
            position: "absolute",
            top: 18,
            right: 18,
            width: 22,
            height: 22,
            borderRadius: 4,
            background: cor.primary,
          }}
        />
      )}
    </div>
  );
};
