// Criativo 1: dois perfis de escritório lado a lado, um parado e um que
// responde dúvidas. Perfis fictícios ("Perfil A" e "Perfil B"), sem nome nem
// foto de ninguém.

import type React from "react";
import { Play } from "lucide-react";
import { cor, fonte } from "../marca";
import { Eyebrow, Peca, useStories, type Variante } from "./Peca";

const PARADO = [
  "Feliz Dia do Advogado",
  "Bom fim de semana",
  "Novo endereço",
  "Equipe reunida",
  "Feliz Natal",
  "Seja bem-vindo",
];

const ATIVO = [
  "Ele parou de pagar a pensão. E agora?",
  "Guarda compartilhada à distância",
  "Divórcio sem processo?",
  "Pensão depois dos 18 anos",
  "O que entra na partilha",
  "Posso mudar de cidade com meu filho?",
];

export const DoisPerfis: React.FC<{ variante: Variante }> = ({ variante }) => (
  <Peca
    titulo={
      variante === "A"
        ? "Qual desses dois escritórios o cliente chama primeiro?"
        : "O cliente abriu os dois perfis. Em qual ele manda mensagem?"
    }
    cta="Ver o diagnóstico do meu perfil"
    micro="Gratuito · resultado na hora"
  >
    <div style={{ display: "flex", gap: 24 }}>
      <Perfil letra="A" legenda="Último post há 4 meses" tiles={PARADO} ativo={false} />
      <Perfil letra="B" legenda="3 vídeos esta semana" tiles={ATIVO} ativo />
    </div>
  </Peca>
);

const Perfil: React.FC<{
  letra: string;
  legenda: string;
  tiles: string[];
  ativo: boolean;
}> = ({ letra, legenda, tiles, ativo }) => {
  const stories = useStories();
  const lado = 140;
  return (
    <div
      style={{
        flex: 1,
        background: cor.surface,
        border: `2px solid ${cor.border}`,
        borderRadius: 24,
        padding: 20,
        boxShadow: "0 2px 6px rgba(13, 13, 15, 0.04)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            background: ativo ? cor.foreground : cor.secondary,
            color: ativo ? cor.surface : cor.muted,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: fonte.display,
            fontWeight: 600,
            fontSize: 30,
          }}
        >
          {letra}
        </div>
        <div>
          <div style={{ fontWeight: 600, fontSize: 28 }}>Perfil {letra}</div>
          <div style={{ fontSize: 20, color: cor.muted }}>Advocacia de Família</div>
        </div>
      </div>

      <Eyebrow style={{ marginTop: 18, fontSize: 18, color: ativo ? cor.foreground : cor.muted }}>
        {legenda}
      </Eyebrow>

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
          gap: 4,
        }}
      >
        {tiles.map((t) => (
          <div
            key={t}
            style={{
              position: "relative",
              height: stories ? lado * 1.5 : lado * 1.25,
              background: ativo ? cor.foreground : cor.secondary,
              color: ativo ? cor.surface : cor.subtle,
              borderRadius: 4,
              padding: 10,
              display: "flex",
              alignItems: "flex-end",
              fontFamily: ativo ? fonte.display : fonte.sans,
              fontWeight: ativo ? 600 : 400,
              fontSize: ativo ? 19 : 17,
              lineHeight: 1.15,
              opacity: ativo ? 1 : 0.75,
            }}
          >
            {ativo && (
              <Play
                size={18}
                fill={cor.surface}
                strokeWidth={0}
                style={{ position: "absolute", top: 10, right: 10 }}
              />
            )}
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};
