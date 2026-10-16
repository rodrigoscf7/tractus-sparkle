// Formato 4: o celular com um roteiro do DNA Viral aberto. O texto é o do
// roteiro curado "Quebra de mito" (src/lib/dna-viral.ts), no mesmo card da
// página do relatório (src/routes/dna-viral.$token.tsx).

import type React from "react";
import { Img, staticFile } from "remotion";
import { cor, fonte } from "../marca";
import { Celular, TAMANHO_CELULAR } from "../ui/Celular";
import { Peca, useStories, type Variante } from "./Peca";

const ROTEIRO = {
  formato: "Quebra de mito",
  gancho:
    "O maior mito sobre isso é achar que basta estar com a razão. Estar certo é só metade do caminho.",
  desenvolvimento:
    "Quem vai decidir o seu caso não acompanhou a sua vida. Essa pessoa olha documento, prazo e prova. " +
    "É por isso que duas situações praticamente iguais terminam diferente: uma chegou organizada e a outra chegou no limite.",
  fecho:
    "Se isso fez sentido, compartilha com quem está vivendo essa situação agora.",
};

export const RoteiroCelular: React.FC<{ variante: Variante }> = ({ variante }) => {
  const stories = useStories();
  const a = variante === "A";
  // O aparelho ocupa ~62% da largura da peça e sangra pelo pé.
  const escala = stories ? 0.74 : 0.62;

  return (
    <Peca
      titulo={
        a
          ? "Três roteiros como este, prontos pro seu nicho"
          : "Responda 11 perguntas e grave o primeiro vídeo ainda hoje"
      }
      cta="Receber meus 3 roteiros"
      micro="Gratuito · 11 perguntas · 2 minutos"
      sangrar
    >
      <div style={{ position: "relative", height: TAMANHO_CELULAR.height * escala }}>
        <div
          style={{
            position: "absolute",
            inset: 0,
            height: TAMANHO_CELULAR.height,
            scale: String(escala),
            transformOrigin: "top center",
          }}
        >
          <Celular>
            <TelaRelatorio />
          </Celular>
        </div>
      </div>
    </Peca>
  );
};

/** A seção de roteiros do relatório, em px de celular. */
const TelaRelatorio: React.FC = () => (
  <div style={{ padding: "64px 20px 0" }}>
    <Img src={staticFile("logo-fundo-claro.png")} style={{ height: 18, width: "auto" }} />

    <div style={{ marginTop: 22, borderBottom: `1px solid ${cor.border}`, paddingBottom: 10 }}>
      <div
        style={{
          fontFamily: fonte.display,
          fontWeight: 600,
          fontSize: 20,
          lineHeight: 1.2,
          letterSpacing: "-0.02em",
        }}
      >
        Seus 3 roteiros prontos para gravar hoje
      </div>
    </div>

    <div
      style={{
        marginTop: 16,
        background: cor.surface,
        border: `1px solid ${cor.border}`,
        borderRadius: 8,
        padding: 18,
      }}
    >
      <div
        style={{
          fontFamily: fonte.mono,
          fontSize: 10,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: cor.muted,
        }}
      >
        Roteiro 1 · {ROTEIRO.formato}
      </div>

      <Bloco titulo="Gancho">
        <p
          style={{
            margin: 0,
            fontFamily: fonte.display,
            fontSize: 18,
            lineHeight: 1.3,
            paddingLeft: 10,
            borderLeft: `3px solid ${cor.primary}`,
          }}
        >
          “{ROTEIRO.gancho}”
        </p>
      </Bloco>
      <Bloco titulo="Desenvolvimento">
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: cor.muted }}>
          {ROTEIRO.desenvolvimento}
        </p>
      </Bloco>
      <Bloco titulo="Fecho">
        <p style={{ margin: 0, fontSize: 14, lineHeight: 1.55, color: cor.muted }}>{ROTEIRO.fecho}</p>
      </Bloco>
    </div>
  </div>
);

const Bloco: React.FC<{ titulo: string; children: React.ReactNode }> = ({ titulo, children }) => (
  <div style={{ marginTop: 14 }}>
    <div style={{ fontSize: 12, fontWeight: 500, color: cor.muted, marginBottom: 5 }}>{titulo}</div>
    {children}
  </div>
);
