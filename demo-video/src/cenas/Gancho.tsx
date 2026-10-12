// Cena 0: o problema (a semana em branco) e a marca.

import type React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "remotion";
import { cor, fonte } from "../marca";
import { progresso } from "../ui/anim";
import { Narracao } from "../ui/Narracao";
import { Som } from "../ui/Som";
import { Palco } from "../ui/Palco";
import { duracaoDaCena, falasDaCena } from "../voz/narracao";

const FALAS = falasDaCena("gancho");
const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// O logo entra quando termina "Toda semana." e fica até a próxima cena, que abre
// com "Com a prevIA, ...".
const MARCA = FALAS[1].de + FALAS[1].duracao - 6;

export const DURACAO_GANCHO = duracaoDaCena("gancho", MARCA + 48, 0);

export const Gancho: React.FC = () => {
  const frame = useCurrentFrame();
  const duvida = FALAS[1].de;
  const marca = MARCA;
  const saiSemana = progresso(frame, marca - 6, 16);
  const logo = interpolate(frame, [marca, marca + 24], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.bezier(0.34, 1.4, 0.64, 1),
  });

  return (
    <AbsoluteFill
      style={{ background: cor.background, fontFamily: fonte.sans }}
    >
      <Narracao falas={FALAS} />
      {/* Um "pop" baixinho a cada "?" e o brilho do logo. */}
      {DIAS.map((d, i) => (
        <Som key={d} nome="pop" em={duvida + 6 + i * 5} volume={0.7} />
      ))}
      <Som nome="marca" em={marca - 4} />
      <Palco topo={260}>
        {/* A semana em branco: cada dia ganha um "?" quando entra a dúvida. */}
        <div
          style={{
            position: "absolute",
            left: 80,
            right: 80,
            top: 780,
            display: "flex",
            gap: 14,
            opacity: 1 - saiSemana,
            translate: `0px ${saiSemana * 60}px`,
          }}
        >
          {DIAS.map((d, i) => {
            const aparece = progresso(frame, 8 + i * 4, 14);
            const pergunta = progresso(frame, duvida + 6 + i * 5, 12);
            return (
              <div
                key={d}
                style={{
                  flex: 1,
                  height: 300,
                  borderRadius: 14,
                  border: `2px dashed ${cor.border}`,
                  background: cor.surface,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  paddingTop: 26,
                  opacity: aparece,
                  translate: `0px ${(1 - aparece) * 30}px`,
                }}
              >
                <span
                  style={{
                    fontFamily: fonte.mono,
                    fontSize: 24,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    color: cor.muted,
                  }}
                >
                  {d}
                </span>
                <span
                  style={{
                    marginTop: 50,
                    fontFamily: fonte.display,
                    fontWeight: 700,
                    fontSize: 104,
                    lineHeight: 1,
                    color: cor.subtle,
                    opacity: pergunta,
                    scale: String(0.6 + pergunta * 0.4),
                  }}
                >
                  ?
                </span>
              </div>
            );
          })}
        </div>

        {/* A marca. */}
        {frame >= marca && (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              top: 780,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 36,
            }}
          >
            <Img
              src={staticFile("logo-fundo-claro.png")}
              style={{
                width: 660,
                opacity: logo > 0 ? 1 : 0,
                scale: String(0.7 + logo * 0.3),
              }}
            />
            <span
              style={{
                fontFamily: fonte.mono,
                fontSize: 30,
                letterSpacing: "0.14em",
                textTransform: "uppercase",
                color: cor.muted,
                opacity: progresso(frame, marca + 14, 16),
              }}
            >
              Conteúdo para advogados
            </span>
          </div>
        )}
      </Palco>
    </AbsoluteFill>
  );
};
