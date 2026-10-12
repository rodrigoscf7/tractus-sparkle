// Cena 3: o roteiro fica pronto, a pessoa lê e decide. Textos de
// aprovacao.$pautaId.tsx (RoteiroView e "Você aprova?") e hoje.tsx.

import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ArrowLeft, ArrowRight, Check, Copy, Video, X } from "lucide-react";
import { plano, roteiro } from "../dados";
import { cor, fonte } from "../marca";
import { entrada, progresso } from "../ui/anim";
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

const FALAS = falasDaCena("roteiro");

const T = {
  push: 6,
  toqueLer: 44,
  roteiro: 54,
  leitura: FALAS[1].de,
  decisao: FALAS[2].de,
  toqueRejeitar: FALAS[2].de + 30,
  toqueAprovar: FALAS[3].de + 4,
  toqueConfirmar: FALAS[3].de + 30,
  aviso: FALAS[3].de + 38,
};

export const DURACAO_ROTEIRO = duracaoDaCena("roteiro", T.aviso + 45);

// Posições dos botões na tela, em px de celular (conferidas nos quadros).
const Y_LER = 390;
const Y_DECISAO = 214;
const Y_CONFIRMAR = 375;

export const Roteiro: React.FC = () => {
  const frame = useCurrentFrame();
  const naTela = frame >= T.roteiro;

  return (
    <AbsoluteFill
      style={{ background: cor.background, fontFamily: fonte.sans }}
    >
      <Narracao falas={FALAS} rotulo="Segunda · Roteiro" />
      <Som nome="confirmacao" em={T.aviso} />
      <Palco>
        <Celular
          style={{ top: 600 }}
          sobreposicao={
            <>
              <NotificacaoPush
                em={T.push}
                ate={T.toqueLer - 10}
                texto="Marina, 1 roteiro novo está esperando sua aprovação."
              />
              <Toque x={104} y={Y_LER} em={T.toqueLer} />
              <Toque x={202} y={Y_DECISAO} em={T.toqueRejeitar} />
              <Toque x={90} y={Y_DECISAO} em={T.toqueAprovar} />
              <Toque x={195} y={Y_CONFIRMAR} em={T.toqueConfirmar} />
              <Aviso frame={frame} />
            </>
          }
        >
          <TopoApp />
          {!naTela && <TelaHoje frame={frame} />}
          {naTela && <TelaRoteiro frame={frame} />}
          <BarraInferior
            ativa={naTela ? "roteiros" : "hoje"}
            roteirosParaLer={frame < T.toqueConfirmar ? 1 : 0}
          />
        </Celular>
      </Palco>
    </AbsoluteFill>
  );
};

/** Tela Hoje com o cartão "Esperando você". */
const TelaHoje: React.FC<{ frame: number }> = ({ frame }) => (
  <div
    style={{
      position: "absolute",
      insetInline: 16,
      top: INICIO_CONTEUDO + 24,
      opacity: 1 - progresso(frame, T.roteiro - 6, 6),
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
      <Rotulo style={{ marginBottom: 12 }}>Esperando você</Rotulo>
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
        O roteiro está pronto. Leia e aprove antes de gravar.
      </p>
      <Botao style={{ marginTop: 20 }}>
        Ler e aprovar <ArrowRight size={16} />
      </Botao>
    </Card>
  </div>
);

const TelaRoteiro: React.FC<{ frame: number }> = ({ frame }) => {
  const rolagem =
    interpolate(frame, [T.leitura + 10, T.leitura + 80], [0, -200], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 3),
    }) +
    interpolate(frame, [T.decisao, T.decisao + 26], [0, -650], {
      extrapolateLeft: "clamp",
      extrapolateRight: "clamp",
      easing: (t) => 1 - Math.pow(1 - t, 3),
    });

  const escolha =
    frame >= T.toqueAprovar
      ? "aprovar"
      : frame >= T.toqueRejeitar
        ? "rejeitar"
        : null;

  return (
    <div
      style={{
        position: "absolute",
        insetInline: 16,
        top: INICIO_CONTEUDO + 16,
        translate: `0px ${rolagem}px`,
      }}
    >
      <div style={entrada(frame, T.roteiro, 14)}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            color: cor.muted,
          }}
        >
          <ArrowLeft size={16} /> Roteiros
        </div>
        <div
          style={{ display: "flex", gap: 6, marginTop: 14, flexWrap: "wrap" }}
        >
          <Etiqueta fundo={cor.secondary}>Marina</Etiqueta>
          <Etiqueta borda>Reel falado</Etiqueta>
          <Etiqueta fundo="rgba(244, 219, 11, 0.25)">
            {frame >= T.aviso ? "Pronto para gravar" : "Esperando você"}
          </Etiqueta>
        </div>
        <h1
          style={{
            margin: "12px 0 0",
            fontFamily: fonte.display,
            fontWeight: 700,
            fontSize: 24,
            lineHeight: 1.2,
            letterSpacing: "-0.02em",
          }}
        >
          {plano[0].tema}
        </h1>
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 14,
            color: cor.muted,
            lineHeight: 1.45,
          }}
        >
          {plano[0].angulo}
        </p>
      </div>

      <Card
        style={{
          marginTop: 20,
          padding: 18,
          ...entrada(frame, T.roteiro + 8, 16),
        }}
      >
        <Rotulo style={{ marginBottom: 14, fontSize: 12 }}>Roteiro</Rotulo>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <Rotulo>Roteiro para gravar</Rotulo>
          <div style={{ display: "flex", gap: 10, fontSize: 12 }}>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Video size={12} /> Gravar
            </span>
            <span
              style={{ display: "inline-flex", alignItems: "center", gap: 4 }}
            >
              <Copy size={12} /> Copiar fala
            </span>
          </div>
        </div>
        <Bloco rotulo="Gancho (0-3s)" destaque>
          <p
            style={{
              margin: 0,
              fontSize: 16,
              fontWeight: 500,
              lineHeight: 1.35,
            }}
          >
            {roteiro.gancho}
          </p>
        </Bloco>
        <Bloco rotulo="Desenvolvimento">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {roteiro.desenvolvimento}
          </p>
        </Bloco>
        <Bloco rotulo="Fechamento (CTA)">
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {roteiro.cta}
          </p>
        </Bloco>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            margin: "16px 0 6px",
          }}
        >
          <Rotulo>Legenda sugerida</Rotulo>
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              fontSize: 12,
            }}
          >
            <Copy size={12} /> Copiar
          </span>
        </div>
        <Bloco>
          <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6 }}>
            {roteiro.legenda}
          </p>
        </Bloco>
      </Card>

      <Card style={{ marginTop: 20, padding: 20 }}>
        <Rotulo style={{ marginBottom: 16, fontSize: 12 }}>Você aprova?</Rotulo>
        <div style={{ display: "flex", gap: 12 }}>
          <Botao
            variante={escolha === "aprovar" ? "primario" : "outline"}
            icone={<Check size={16} />}
            style={
              escolha === "aprovar"
                ? { background: cor.oliva, color: cor.background }
                : undefined
            }
          >
            Aprovar
          </Botao>
          <Botao
            variante={escolha === "rejeitar" ? "primario" : "outline"}
            icone={<X size={16} />}
            style={
              escolha === "rejeitar"
                ? { background: cor.terracota, color: "#fff" }
                : undefined
            }
          >
            Rejeitar
          </Botao>
        </div>

        {escolha === "rejeitar" && (
          <div
            style={{
              marginTop: 20,
              paddingLeft: 14,
              borderLeft: "2px solid rgba(180, 69, 31, 0.4)",
              ...entrada(frame, T.toqueRejeitar, 10, 8),
            }}
          >
            <Rotulo>Motivo (obrigatório)</Rotulo>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px 14px",
                marginTop: 10,
                fontSize: 15,
              }}
            >
              {["Tom", "Tema", "Formato", "Gancho", "Outro"].map((m) => (
                <span
                  key={m}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      borderRadius: 99,
                      border: `1.5px solid ${cor.foreground}`,
                    }}
                  />
                  {m}
                </span>
              ))}
            </div>
          </div>
        )}

        {escolha && (
          <div style={{ marginTop: 18 }}>
            <Rotulo>
              Comentário{" "}
              {escolha === "rejeitar"
                ? "(opcional, mas recomendado)"
                : "(opcional)"}
            </Rotulo>
            <div
              style={{
                marginTop: 8,
                height: 70,
                borderRadius: 8,
                border: `1px solid ${cor.border}`,
                background: cor.surface,
                padding: 10,
                fontSize: 14,
                color: cor.subtle,
              }}
            >
              O que a prevIA deve aprender com essa decisão?
            </div>
            <Botao style={{ width: "100%", marginTop: 14 }}>
              Confirmar decisão
            </Botao>
          </div>
        )}
      </Card>
    </div>
  );
};

const Etiqueta: React.FC<{
  children: React.ReactNode;
  fundo?: string;
  borda?: boolean;
}> = ({ children, fundo, borda }) => (
  <span
    style={{
      fontFamily: fonte.mono,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.04em",
      padding: "3px 8px",
      borderRadius: 6,
      background: fundo ?? "transparent",
      border: borda ? `1px solid ${cor.border}` : "none",
      fontWeight: 500,
    }}
  >
    {children}
  </span>
);

const Bloco: React.FC<{
  rotulo?: string;
  destaque?: boolean;
  children: React.ReactNode;
}> = ({ rotulo, destaque, children }) => (
  <div
    style={{
      marginTop: 10,
      padding: 12,
      borderRadius: 6,
      border: `1px solid ${destaque ? "rgba(244, 219, 11, 0.6)" : cor.border}`,
      background: destaque ? "rgba(244, 219, 11, 0.08)" : cor.background,
    }}
  >
    {rotulo && (
      <Rotulo
        style={{
          marginBottom: 4,
          color: destaque ? cor.foreground : cor.muted,
          letterSpacing: "0.06em",
        }}
      >
        {rotulo}
      </Rotulo>
    )}
    {children}
  </div>
);

/** O aviso (toast) depois de confirmar. */
const Aviso: React.FC<{ frame: number }> = ({ frame }) => {
  if (frame < T.aviso) return null;
  const p = progresso(frame, T.aviso, 14);
  return (
    <div
      style={{
        position: "absolute",
        left: 16,
        right: 16,
        top: 62,
        zIndex: 58,
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "14px 16px",
        borderRadius: 10,
        background: cor.surface,
        border: `1px solid ${cor.border}`,
        boxShadow: "0 10px 30px rgba(13, 13, 15, 0.14)",
        fontSize: 15,
        fontWeight: 500,
        opacity: p,
        translate: `0px ${(1 - p) * -30}px`,
      }}
    >
      <span
        style={{
          width: 22,
          height: 22,
          borderRadius: 99,
          background: cor.oliva,
          color: "#fff",
          display: "grid",
          placeItems: "center",
        }}
      >
        <Check size={14} strokeWidth={3} />
      </span>
      Aprovado — já pode gravar.
    </div>
  );
};
