// Cena 6: a semana cumprida na tela Hoje (hoje/PautaDaSemana.tsx) e a
// sequência de semanas no ritmo.

import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Check, Circle } from "lucide-react";
import { plano } from "../dados";
import { cor, fonte } from "../marca";
import { entrada, progresso } from "../ui/anim";
import {
  BarraInferior,
  Card,
  INICIO_CONTEUDO,
  Rotulo,
  TituloPagina,
  TopoApp,
} from "../ui/app";
import { Celular } from "../ui/Celular";
import { Narracao } from "../ui/Narracao";
import { Som } from "../ui/Som";
import { Palco } from "../ui/Palco";
import { duracaoDaCena, falasDaCena } from "../voz/narracao";

const FALAS = falasDaCena("ritmo");

const T = { postou: 34, sequencia: 58 };

export const DURACAO_RITMO = duracaoDaCena("ritmo", 130);

const DIAS = [
  { dia: "Seg 12", tema: plano[0].tema },
  { dia: "Qua 14", tema: plano[1].tema },
  { dia: "Sex 16", tema: plano[2].tema },
];

export const Ritmo: React.FC = () => {
  const frame = useCurrentFrame();
  const sextaPostada = frame >= T.postou;
  const semanas = frame >= T.sequencia ? 4 : 3;
  const pulo = interpolate(
    frame,
    [T.sequencia, T.sequencia + 5, T.sequencia + 14],
    [1, 1.35, 1],
    {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
    },
  );

  return (
    <AbsoluteFill
      style={{ background: cor.background, fontFamily: fonte.sans }}
    >
      <Narracao falas={FALAS} rotulo="Sexta · 18:40" />
      <Som nome="confirmacao" em={T.postou} />
      <Som nome="pop" em={T.sequencia} />
      <Palco>
        <Celular style={{ top: 600 }}>
          <TopoApp />
          <div
            style={{
              position: "absolute",
              insetInline: 16,
              top: INICIO_CONTEUDO + 24,
            }}
          >
            <TituloPagina subtitulo="A próxima ação do seu dia.">
              Hoje
            </TituloPagina>
            <Card
              style={{
                marginTop: 20,
                overflow: "hidden",
                ...entrada(frame, 0, 14),
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexWrap: "wrap",
                  justifyContent: "space-between",
                  gap: "4px 16px",
                  padding: "18px 16px 12px",
                }}
              >
                <Rotulo>Semana de 12 a 18 de outubro</Rotulo>
                <Rotulo>Seg · Qua · Sex</Rotulo>
              </div>
              {DIAS.map((d, i) => {
                const ehHoje = i === 2 && !sextaPostada;
                const postado = i < 2 || sextaPostada;
                const virou = i === 2 ? progresso(frame, T.postou, 10) : 1;
                return (
                  <div
                    key={d.dia}
                    style={{
                      position: "relative",
                      display: "grid",
                      gridTemplateColumns: "60px 18px 1fr",
                      alignItems: "baseline",
                      columnGap: 12,
                      padding: "12px 16px",
                      borderTop: `1px solid ${cor.divider}`,
                      background: ehHoje
                        ? "rgba(244, 219, 11, 0.15)"
                        : "transparent",
                    }}
                  >
                    {ehHoje && (
                      <span
                        style={{
                          position: "absolute",
                          left: 0,
                          top: 8,
                          bottom: 8,
                          width: 3,
                          borderRadius: 99,
                          background: cor.primary,
                        }}
                      />
                    )}
                    <span
                      style={{
                        fontFamily: fonte.mono,
                        fontSize: 12,
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        color: cor.muted,
                      }}
                    >
                      {d.dia}
                    </span>
                    <span style={{ alignSelf: "center", display: "flex" }}>
                      {postado ? (
                        <Check
                          size={15}
                          strokeWidth={3}
                          color={cor.oliva}
                          style={{ scale: String(0.5 + virou * 0.5) }}
                        />
                      ) : (
                        <Circle size={14} color={cor.foreground} />
                      )}
                    </span>
                    <span
                      style={{
                        fontSize: 14,
                        lineHeight: 1.4,
                        fontWeight: ehHoje ? 500 : 400,
                      }}
                    >
                      {d.tema}
                    </span>
                  </div>
                );
              })}
              <div
                style={{
                  padding: "12px 16px",
                  borderTop: `1px solid ${cor.border}`,
                  background: cor.surfaceElevated,
                  fontSize: 14,
                  color: cor.muted,
                }}
              >
                <strong
                  style={{
                    display: "inline-block",
                    color: cor.foreground,
                    fontWeight: 600,
                    fontVariantNumeric: "tabular-nums",
                    scale: String(pulo),
                  }}
                >
                  {semanas}
                </strong>{" "}
                semanas seguidas no ritmo
              </div>
            </Card>
          </div>
          <BarraInferior ativa="hoje" />
        </Celular>
      </Palco>
    </AbsoluteFill>
  );
};
