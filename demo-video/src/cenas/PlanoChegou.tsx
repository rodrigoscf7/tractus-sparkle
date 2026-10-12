// Cena 2: domingo, a prevIA monta o plano, a notificação chega, a pessoa vê
// os vídeos da semana e aprova. Textos e visual de plano.tsx e hoje.tsx.

import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Check, Loader2, PenLine } from "lucide-react";
import { ETAPAS_DO_PLANO, plano, semana, type VideoDoPlano } from "../dados";
import { cor, fonte } from "../marca";
import { entrada, mix, progresso } from "../ui/anim";
import {
  ALTURA_BARRA,
  BarraInferior,
  Botao,
  Card,
  INICIO_CONTEUDO,
  Rotulo,
  TituloPagina,
  TopoApp,
} from "../ui/app";
import { ALTURA_TELA, Celular } from "../ui/Celular";
import { NotificacaoPush, Toque } from "../ui/efeitos";
import { Narracao } from "../ui/Narracao";
import { Som } from "../ui/Som";
import { Palco } from "../ui/Palco";
import { duracaoDaCena, falasDaCena } from "../voz/narracao";

const FALAS = falasDaCena("plano");

// Marcos da cena, em frames (30 fps), presos ao início de cada fala.
const push = FALAS[1].de;
const aprovar = FALAS[3].de + 30;
const T = {
  etapa2: Math.round(push * 0.31),
  etapa3: Math.round(push * 0.64),
  pronto: push - 6,
  push,
  toquePush: push + 48,
  plano: push + 58,
  rolagem: FALAS[2].de,
  aprovar,
  aprovado: aprovar + 12,
};

export const DURACAO_PLANO_CHEGOU = duracaoDaCena("plano", T.aprovado + 46);

export const PlanoChegou: React.FC = () => {
  const frame = useCurrentFrame();

  // Câmera: o celular sobe para mostrar a barra de aprovação no fim.
  const subida = progresso(frame, T.aprovar - 30, 26);
  const zoom =
    progresso(frame, T.rolagem + 6, 30) *
    (1 - progresso(frame, T.aprovar - 30, 24));

  return (
    <AbsoluteFill
      style={{ background: cor.background, fontFamily: fonte.sans }}
    >
      <Narracao falas={FALAS} rotulo="Domingo · 12:00" />
      <Som nome="pop" em={T.etapa2} volume={0.8} />
      <Som nome="pop" em={T.etapa3} volume={0.8} />
      <Som nome="pop" em={T.pronto} volume={0.8} />
      <Som nome="confirmacao" em={T.aprovado} />
      <Palco>
        <Celular
          style={{
            top: mix(600, 160, subida),
            scale: String(1 + zoom * 0.12),
            transformOrigin: "50% 40%",
          }}
          sobreposicao={
            <>
              <NotificacaoPush
                em={T.push}
                ate={T.toquePush + 6}
                texto="Marina, seu plano da semana chegou: os vídeos de cada dia, com o gancho já escrito."
              />
              <Toque x={195} y={110} em={T.toquePush} />
              <Toque
                x={195}
                y={ALTURA_TELA - ALTURA_BARRA - 62}
                em={T.aprovar}
              />
            </>
          }
        >
          <TopoApp />
          {frame < T.plano + 12 && (
            <div style={{ opacity: 1 - progresso(frame, T.plano, 12) }}>
              <TelaMontando frame={frame} />
            </div>
          )}
          {frame >= T.plano && <TelaPlano frame={frame} />}
          <BarraInferior
            ativa={frame >= T.plano ? "plano" : "hoje"}
            pontoNoPlano={frame >= T.push && frame < T.plano}
          />
        </Celular>
      </Palco>
    </AbsoluteFill>
  );
};

/** Tela Hoje enquanto o plano é montado (cartão "Em andamento" e as 3 etapas). */
const TelaMontando: React.FC<{ frame: number }> = ({ frame }) => {
  const atual =
    frame >= T.pronto ? 3 : frame >= T.etapa3 ? 2 : frame >= T.etapa2 ? 1 : 0;
  return (
    <div
      style={{
        position: "absolute",
        insetInline: 16,
        top: INICIO_CONTEUDO + 24,
      }}
    >
      <TituloPagina subtitulo="A próxima ação do seu dia.">Hoje</TituloPagina>
      <Card
        style={{
          marginTop: 20,
          padding: 20,
          borderColor: "rgba(244, 219, 11, 0.5)",
        }}
      >
        <Rotulo
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 12,
          }}
        >
          <Loader2 size={16} style={{ rotate: `${frame * 12}deg` }} />
          Montando seu plano
        </Rotulo>
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {ETAPAS_DO_PLANO.map((etapa, i) => (
            <div
              key={etapa}
              style={{ display: "flex", gap: 12, alignItems: "flex-start" }}
            >
              <MarcaEtapa
                estado={i < atual ? "feita" : i === atual ? "atual" : "proxima"}
                n={i + 1}
              />
              <span
                style={{
                  fontSize: 15,
                  lineHeight: 1.4,
                  fontWeight: i === atual ? 500 : 400,
                  color: i === atual ? cor.foreground : cor.muted,
                }}
              >
                {etapa}
              </span>
            </div>
          ))}
        </div>
        <p
          style={{
            margin: "20px 0 0",
            fontSize: 14,
            color: cor.muted,
            lineHeight: 1.45,
          }}
        >
          Leva uns 5 minutos. Pode sair desta tela: você é avisado quando ficar
          pronto.
        </p>
      </Card>
    </div>
  );
};

const MarcaEtapa: React.FC<{
  estado: "feita" | "atual" | "proxima";
  n: number;
}> = ({ estado, n }) => (
  <span
    style={{
      marginTop: 1,
      width: 24,
      height: 24,
      flexShrink: 0,
      borderRadius: 99,
      display: "grid",
      placeItems: "center",
      fontFamily: fonte.mono,
      fontSize: 12,
      background: estado === "feita" ? cor.primary : "transparent",
      border:
        estado === "feita"
          ? "none"
          : estado === "atual"
            ? `2px solid ${cor.primary}`
            : `1px solid ${cor.border}`,
      color: estado === "proxima" ? cor.muted : cor.foreground,
    }}
  >
    {estado === "feita" ? <Check size={14} strokeWidth={2.5} /> : n}
  </span>
);

/** Tela Plano da semana: resumo, os 3 vídeos e a barra "Aprovar". */
const TelaPlano: React.FC<{ frame: number }> = ({ frame }) => {
  const rolagem = interpolate(frame, [T.rolagem, T.rolagem + 70], [0, -250], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: (t) => 1 - Math.pow(1 - t, 3),
  });
  const aprovado = frame >= T.aprovado;

  return (
    <>
      <div
        style={{
          position: "absolute",
          insetInline: 16,
          top: INICIO_CONTEUDO + 24,
          translate: `0px ${rolagem}px`,
          display: "flex",
          flexDirection: "column",
          gap: 20,
        }}
      >
        <div style={entrada(frame, T.plano, 16)}>
          <TituloPagina>Plano da semana</TituloPagina>
        </div>
        <section
          style={{
            borderRadius: 12,
            background: cor.primarySoft,
            padding: 18,
            ...entrada(frame, T.plano + 6, 16),
          }}
        >
          <Rotulo style={{ marginBottom: 8 }}>{semana.intervalo}</Rotulo>
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5 }}>
            {semana.resumo}
          </p>
        </section>
        {aprovado && (
          <div style={entrada(frame, T.aprovado + 4, 14, 12)}>
            <Card style={{ padding: 16 }}>
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.5 }}>
                <strong>Plano aprovado.</strong> A prevIA escreve os roteiros um
                de cada vez e avisa quando cada um fica pronto.
              </p>
            </Card>
          </div>
        )}
        {plano.map((v, i) => (
          <div key={v.dia} style={entrada(frame, T.plano + 14 + i * 8, 18)}>
            <CartaoVideo
              video={v}
              escrevendo={aprovado && frame >= T.aprovado + 8 + i * 6}
            />
          </div>
        ))}
      </div>

      <BarraAprovar frame={frame} />
    </>
  );
};

const CartaoVideo: React.FC<{ video: VideoDoPlano; escrevendo: boolean }> = ({
  video,
  escrevendo,
}) => (
  <Card style={{ overflow: "hidden" }}>
    <div
      style={{
        background: cor.foreground,
        color: cor.background,
        padding: "8px 16px",
        display: "flex",
        alignItems: "baseline",
        gap: 8,
      }}
    >
      <span style={{ fontFamily: fonte.display, fontWeight: 700 }}>
        {video.dia}
      </span>
      <span style={{ fontFamily: fonte.mono, fontSize: 12, opacity: 0.75 }}>
        {video.data}
      </span>
    </div>
    <div style={{ padding: 16 }}>
      {escrevendo && (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            marginBottom: 10,
            borderRadius: 6,
            padding: "2px 8px",
            fontSize: 12,
            background: cor.secondary,
            color: cor.muted,
          }}
        >
          <PenLine size={14} /> Escrevendo
        </span>
      )}
      <h3
        style={{
          margin: 0,
          fontFamily: fonte.display,
          fontWeight: 600,
          fontSize: 18,
          lineHeight: 1.3,
        }}
      >
        {video.tema}
      </h3>
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 14,
          color: cor.muted,
          lineHeight: 1.45,
        }}
      >
        {video.angulo}
      </p>
      <blockquote
        style={{
          margin: "12px 0 0",
          borderRadius: 8,
          background: cor.secondary,
          padding: "12px 16px",
        }}
      >
        <Rotulo style={{ marginBottom: 4 }}>Primeiros 3 segundos</Rotulo>
        <span
          style={{
            fontFamily: fonte.display,
            fontWeight: 600,
            lineHeight: 1.35,
          }}
        >
          “{video.gancho}”
        </span>
      </blockquote>
      <p
        style={{
          margin: "10px 0 0",
          fontSize: 12,
          color: cor.muted,
          fontFamily: fonte.mono,
        }}
      >
        Modelado em {video.origem} ·{" "}
        <span
          style={{
            background: cor.primary,
            color: cor.foreground,
            borderRadius: 4,
            padding: "1px 5px",
          }}
        >
          {video.acimaDoNormal}
        </span>{" "}
        acima do normal
      </p>
    </div>
  </Card>
);

/** Barra fixa acima da navegação, como no celular. Some depois de aprovar. */
const BarraAprovar: React.FC<{ frame: number }> = ({ frame }) => {
  const aparece = progresso(frame, T.plano + 30, 16);
  const some = progresso(frame, T.aprovado + 2, 12);
  const apertado = frame >= T.aprovar && frame < T.aprovado;
  return (
    <div
      style={{
        position: "absolute",
        insetInline: 0,
        bottom: ALTURA_BARRA,
        padding: "12px 16px",
        background: cor.background,
        borderTop: `1px solid ${cor.border}`,
        zIndex: 35,
        opacity: aparece * (1 - some),
        translate: `0px ${(1 - aparece) * 40 + some * 30}px`,
      }}
    >
      <Botao
        grande
        icone={
          apertado ? (
            <Loader2 size={18} style={{ rotate: `${frame * 12}deg` }} />
          ) : (
            <Check size={18} />
          )
        }
        style={{ width: "100%" }}
      >
        Aprovar 3 vídeos
      </Botao>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 12,
          color: cor.muted,
          lineHeight: 1.4,
        }}
      >
        Cada vídeo aprovado vira um roteiro completo. Você lê cada roteiro antes
        de gravar.
      </p>
    </div>
  );
};
