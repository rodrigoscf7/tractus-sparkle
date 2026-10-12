// Cena 4: dia de postar, "Gravar agora" e o modo gravação rolando sozinho.
// Visual de roteiro/ModoGravacao.tsx (tema escuro, linha amarela de leitura).

import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import {
  ArrowRight,
  Copy,
  Minus,
  Pause,
  Play,
  Plus,
  Video,
  X,
} from "lucide-react";
import { plano, roteiro } from "../dados";
import { cor, fonte } from "../marca";
import { progresso } from "../ui/anim";
import {
  BarraInferior,
  Botao,
  Card,
  INICIO_CONTEUDO,
  Rotulo,
  TituloPagina,
  TopoApp,
} from "../ui/app";
import { Celular } from "../ui/Celular";
import { NotificacaoPush, Toque } from "../ui/efeitos";
import { Narracao } from "../ui/Narracao";
import { Som } from "../ui/Som";
import { Palco } from "../ui/Palco";
import { duracaoDaCena, falasDaCena } from "../voz/narracao";

const FALAS = falasDaCena("teleprompter");

const T = {
  push: 4,
  toqueGravar: 46,
  modo: 54,
  toqueComecar: FALAS[1].de - 26,
  rolagem: FALAS[1].de + 34,
  zoom: FALAS[2].de - 4,
};

export const DURACAO_TELEPROMPTER = duracaoDaCena("teleprompter", T.zoom + 80);

const ALTURA_STATUS = 50;
const ALTURA_CABECALHO = 56;
const ALTURA_RODAPE = 150;
const LINHA_LEITURA = 104;
/** px de celular por segundo; perto da velocidade 3 do app. */
const VELOCIDADE = 46;

export const Teleprompter: React.FC = () => {
  const frame = useCurrentFrame();
  const noModo = frame >= T.modo;
  const zoom = progresso(frame, T.zoom, 30);

  return (
    <AbsoluteFill
      style={{ background: cor.escuro.background, fontFamily: fonte.sans }}
    >
      <Narracao falas={FALAS} rotulo="Sexta · Dia de postar" escuro />
      {/* A contagem 3-2-1: o "3" já tem o som do toque em "Começar". */}
      <Som nome="toque" em={T.toqueComecar + 20} volume={0.6} />
      <Som nome="toque" em={T.toqueComecar + 40} volume={0.6} />
      <Palco>
        <Celular
          escuro={noModo}
          style={{
            top: 560,
            scale: String(0.74 + zoom * 0.22),
            transformOrigin: "50% 12%",
          }}
          sobreposicao={
            <>
              <NotificacaoPush
                em={T.push}
                ate={T.toqueGravar - 12}
                texto="Marina, hoje é dia de postar — e já tem conteúdo pronto esperando você."
              />
              <Toque x={88} y={386} em={T.toqueGravar} />
              <Toque x={195} y={730} em={T.toqueComecar} />
            </>
          }
        >
          {!noModo && (
            <>
              <TopoApp />
              <TelaHoje />
              <BarraInferior ativa="hoje" />
            </>
          )}
          {noModo && <ModoGravacao frame={frame} />}
        </Celular>
      </Palco>
    </AbsoluteFill>
  );
};

const TelaHoje: React.FC = () => (
  <div
    style={{ position: "absolute", insetInline: 16, top: INICIO_CONTEUDO + 24 }}
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
        <Video size={16} /> Grave hoje
      </Rotulo>
      <h2
        style={{
          margin: 0,
          fontFamily: fonte.display,
          fontWeight: 700,
          fontSize: 20,
          lineHeight: 1.25,
        }}
      >
        {plano[0].tema}
      </h2>
      <p
        style={{
          margin: "8px 0 0",
          fontSize: 14,
          color: cor.muted,
          lineHeight: 1.5,
        }}
      >
        {plano[0].angulo}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 20 }}>
        <Botao icone={<Video size={16} />}>Gravar agora</Botao>
        <Botao variante="outline">
          Ver o roteiro <ArrowRight size={16} />
        </Botao>
        <Botao variante="ghost" icone={<Copy size={16} />}>
          Copiar a fala
        </Botao>
      </div>
    </Card>
  </div>
);

const ModoGravacao: React.FC<{ frame: number }> = ({ frame }) => {
  const e = cor.escuro;
  const aparece = progresso(frame, T.modo, 10);
  const segundos = Math.max(0, (frame - T.rolagem) / 30);
  const rolagem =
    -segundos *
    VELOCIDADE *
    interpolate(segundos, [0, 0.6], [0.4, 1], { extrapolateRight: "clamp" });
  const contando = frame >= T.toqueComecar && frame < T.rolagem;
  const contagem = 3 - Math.floor((frame - T.toqueComecar) / 20);
  const rolando = frame >= T.rolagem;
  const paragrafos = roteiro.desenvolvimento.split(/(?<=\.) (?=[A-ZÉ])/);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: e.background,
        color: e.foreground,
        opacity: aparece,
      }}
    >
      <header
        style={{
          position: "absolute",
          insetInline: 0,
          top: ALTURA_STATUS,
          height: ALTURA_CABECALHO,
          display: "flex",
          alignItems: "center",
          gap: 12,
          paddingInline: 16,
          borderBottom: `1px solid ${e.border}`,
          background: e.background,
          zIndex: 20,
        }}
      >
        <Rotulo style={{ color: e.muted }}>Modo gravação</Rotulo>
        <span
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: 14,
            color: e.muted,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
          }}
        >
          {plano[0].tema}
        </span>
        <X size={20} />
      </header>

      {/* Área do texto, entre o cabeçalho e o rodapé. */}
      <div
        style={{
          position: "absolute",
          insetInline: 0,
          top: ALTURA_STATUS + ALTURA_CABECALHO,
          bottom: ALTURA_RODAPE,
          overflow: "hidden",
        }}
      >
        <span
          style={{
            position: "absolute",
            left: 10,
            top: LINHA_LEITURA + 4,
            width: 4,
            height: 40,
            borderRadius: 99,
            background: cor.primary,
            zIndex: 10,
          }}
        />
        <div
          style={{
            paddingInline: 24,
            paddingTop: LINHA_LEITURA,
            fontSize: 30,
            lineHeight: 1.45,
            translate: `0px ${rolagem}px`,
          }}
        >
          <p style={{ margin: 0, fontFamily: fonte.display, fontWeight: 600 }}>
            {roteiro.gancho}
          </p>
          {paragrafos.map((p) => (
            <p key={p} style={{ margin: "1.1em 0 0" }}>
              {p}
            </p>
          ))}
          <p
            style={{
              margin: "1.1em 0 0",
              fontFamily: fonte.display,
              fontWeight: 600,
            }}
          >
            {roteiro.cta}
          </p>
        </div>
        <div
          style={{
            position: "absolute",
            insetInline: 0,
            top: 0,
            height: 48,
            background: `linear-gradient(${e.background}, ${e.background}00)`,
          }}
        />

        {contando && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              background: "rgba(26, 26, 30, 0.8)",
              zIndex: 20,
            }}
          >
            <span
              style={{
                fontFamily: fonte.display,
                fontWeight: 700,
                fontSize: 112,
                lineHeight: 1,
                scale: String(
                  interpolate(
                    (frame - T.toqueComecar) % 20,
                    [0, 6],
                    [1.25, 1],
                    { extrapolateRight: "clamp" },
                  ),
                ),
              }}
            >
              {contagem}
            </span>
          </div>
        )}
      </div>

      <footer
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: 0,
          height: ALTURA_RODAPE,
          borderTop: `1px solid ${e.border}`,
          padding: "12px 16px 28px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          background: e.background,
        }}
      >
        <Botao
          grande
          icone={
            rolando ? <Pause size={20} /> : contando ? null : <Play size={20} />
          }
          style={{ width: "100%" }}
        >
          {rolando ? "Pausar" : contando ? "Cancelar" : "Começar"}
        </Botao>
        <div style={{ display: "flex", justifyContent: "center", gap: 36 }}>
          <Ajuste rotulo="Velocidade" valor={3} />
          <Ajuste rotulo="Letra" valor={2} />
        </div>
      </footer>
    </div>
  );
};

const Ajuste: React.FC<{ rotulo: string; valor: number }> = ({
  rotulo,
  valor,
}) => {
  const e = cor.escuro;
  const botao: React.CSSProperties = {
    width: 28,
    height: 28,
    borderRadius: 8,
    border: `1px solid ${e.border}`,
    display: "grid",
    placeItems: "center",
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <Rotulo style={{ color: e.muted }}>{rotulo}</Rotulo>
      <span style={botao}>
        <Minus size={14} />
      </span>
      <span style={{ fontSize: 14, fontVariantNumeric: "tabular-nums" }}>
        {valor}
      </span>
      <span style={botao}>
        <Plus size={14} />
      </span>
    </div>
  );
};
