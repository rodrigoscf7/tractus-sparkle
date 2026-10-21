// Imagens do checkout da Hubla (banner, lateral, rodapé, selo) e a capa do
// produto prevIA VIRAL. A Hubla não publica as medidas: as proporções aqui
// são as usuais, e trocar o tamanho é só mudar a Composition no Root.
//
// Tudo o que está escrito é o que o produto faz e o que os Termos prometem
// (cancelamento a qualquer momento, reembolso integral em 7 dias).

import type React from "react";
import { CalendarRange, Check, FileText, Images, ShieldCheck, Video } from "lucide-react";
import { AbsoluteFill, Img, staticFile, useVideoConfig } from "remotion";
import { cor, fonte } from "../marca";

const base: React.CSSProperties = {
  background: cor.background,
  color: cor.foreground,
  fontFamily: fonte.sans,
  WebkitFontSmoothing: "antialiased",
};

const display: React.CSSProperties = {
  fontFamily: fonte.display,
  fontWeight: 600,
  letterSpacing: "-0.02em",
  lineHeight: 1.08,
  margin: 0,
};

const eyebrow: React.CSSProperties = {
  fontFamily: fonte.mono,
  letterSpacing: "0.1em",
  textTransform: "uppercase",
  color: cor.muted,
};

const BENEFICIOS = [
  {
    icone: CalendarRange,
    titulo: "Plano da semana todo domingo",
    texto: "Um vídeo para cada dia que você escolheu postar, com o gancho já escrito.",
  },
  {
    icone: FileText,
    titulo: "Roteiro completo de cada vídeo",
    texto: "Escrito no seu tom de voz, a partir do que mais performou nas suas referências.",
  },
  {
    icone: Video,
    titulo: "Modo gravação",
    texto: "O roteiro rola na tela enquanto você grava.",
  },
  {
    icone: Images,
    titulo: "Carrossel pronto",
    texto: "Gerado a partir do roteiro, para postar no mesmo dia.",
  },
];

const Logo: React.FC<{ altura: number }> = ({ altura }) => (
  <Img
    src={staticFile("logo-fundo-claro.png")}
    style={{ height: altura, width: "auto", alignSelf: "flex-start", flexShrink: 0 }}
  />
);

/** Banner do topo do checkout. Desktop 4:1, mobile 2:1. */
export const Banner: React.FC = () => {
  const { width, height } = useVideoConfig();
  const mobile = width / height < 3;
  const u = width / (mobile ? 1080 : 2400);

  return (
    <AbsoluteFill
      style={{
        ...base,
        padding: mobile ? `${56 * u}px ${64 * u}px` : `${80 * u}px ${140 * u}px`,
        display: "flex",
        flexDirection: mobile ? "column" : "row",
        justifyContent: mobile ? "center" : "space-between",
        alignItems: mobile ? "flex-start" : "center",
        gap: 40 * u,
        borderBottom: `${4 * u}px solid ${cor.primary}`,
      }}
    >
      <div style={{ maxWidth: mobile ? "100%" : 1400 * u }}>
        <div style={{ display: "flex", alignItems: "center", gap: 24 * u }}>
          <Logo altura={(mobile ? 44 : 56) * u} />
          <span style={{ ...eyebrow, fontSize: (mobile ? 22 : 26) * u }}>VIRAL · assinatura mensal</span>
        </div>
        <h1 style={{ ...display, fontSize: (mobile ? 60 : 96) * u, marginTop: (mobile ? 28 : 36) * u }}>
          Toda semana, o que gravar e o roteiro pronto.
        </h1>
        <p
          style={{
            margin: `${(mobile ? 18 : 24) * u}px 0 0`,
            fontSize: (mobile ? 30 : 40) * u,
            lineHeight: 1.35,
            color: cor.muted,
          }}
        >
          A partir dos vídeos que mais performaram nos perfis que você acompanha.
        </p>
      </div>
      {!mobile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 22 * u, flexShrink: 0 }}>
          {["Plano da semana", "Roteiro no seu tom", "Modo gravação", "Carrossel pronto"].map((t) => (
            <div key={t} style={{ display: "flex", alignItems: "center", gap: 18 * u, fontSize: 34 * u, fontWeight: 500 }}>
              <Check size={38 * u} strokeWidth={2.6} color={cor.oliva} />
              {t}
            </div>
          ))}
        </div>
      )}
    </AbsoluteFill>
  );
};

/** Imagem lateral (desktop): o que a assinatura entrega. 1:2. */
export const Lateral: React.FC = () => (
  <AbsoluteFill style={{ ...base, padding: "88px 72px", display: "flex", flexDirection: "column" }}>
    <Logo altura={48} />
    <div style={{ ...eyebrow, fontSize: 24, marginTop: 64 }}>O que você recebe</div>
    <div style={{ marginTop: 36, display: "flex", flexDirection: "column", gap: 52 }}>
      {BENEFICIOS.map(({ icone: Icone, titulo, texto }) => (
        <div key={titulo} style={{ display: "flex", gap: 26 }}>
          <div
            style={{
              width: 76,
              height: 76,
              flexShrink: 0,
              borderRadius: 18,
              background: cor.surface,
              border: `2px solid ${cor.border}`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Icone size={38} strokeWidth={2} />
          </div>
          <div>
            <div style={{ ...display, fontSize: 38, lineHeight: 1.15 }}>{titulo}</div>
            <p style={{ margin: "10px 0 0", fontSize: 28, lineHeight: 1.4, color: cor.muted }}>{texto}</p>
          </div>
        </div>
      ))}
    </div>
    <div style={{ flex: 1 }} />
    <div style={{ borderTop: `2px solid ${cor.divider}`, paddingTop: 36 }}>
      <div style={{ ...display, fontSize: 34 }}>Até 30 roteiros e 30 carrosséis por mês</div>
      <p style={{ margin: "10px 0 0", fontSize: 26, color: cor.muted }}>
        Até 5 perfis de referência monitorados.
      </p>
    </div>
  </AbsoluteFill>
);

/** Rodapé: as garantias, numa linha (desktop) ou empilhadas (mobile). */
export const Rodape: React.FC = () => {
  const { width, height } = useVideoConfig();
  const mobile = width / height < 4;
  const itens = [
    "Cancele quando quiser",
    "Reembolso integral em até 7 dias",
    "Pagamento seguro pela Hubla",
  ];
  return (
    <AbsoluteFill
      style={{
        ...base,
        background: cor.surface,
        borderTop: `2px solid ${cor.border}`,
        display: "flex",
        flexDirection: mobile ? "column" : "row",
        alignItems: mobile ? "flex-start" : "center",
        justifyContent: "center",
        gap: mobile ? 22 : 96,
        padding: mobile ? "0 64px" : 0,
      }}
    >
      {itens.map((t) => (
        <div
          key={t}
          style={{ display: "flex", alignItems: "center", gap: 18, fontSize: mobile ? 34 : 40, fontWeight: 500 }}
        >
          <Check size={mobile ? 34 : 42} strokeWidth={2.6} color={cor.oliva} />
          {t}
        </div>
      ))}
    </AbsoluteFill>
  );
};

/** Selo de garantia de 7 dias (o direito de arrependimento dos Termos). */
export const SeloGarantia: React.FC = () => (
  <AbsoluteFill style={{ ...base, background: "transparent", alignItems: "center", justifyContent: "center" }}>
    <div
      style={{
        width: 540,
        height: 540,
        borderRadius: 270,
        background: cor.surface,
        border: `8px solid ${cor.foreground}`,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
      }}
    >
      <ShieldCheck size={84} strokeWidth={2} />
      <div style={{ ...display, fontSize: 150, lineHeight: 1, marginTop: 12 }}>7 dias</div>
      <div style={{ ...eyebrow, fontSize: 28, color: cor.foreground, marginTop: 14 }}>de garantia</div>
      <div style={{ fontSize: 24, color: cor.muted, marginTop: 10, maxWidth: 340 }}>
        Reembolso integral se não for para você
      </div>
    </div>
  </AbsoluteFill>
);

/** Capa do produto na Hubla (área de membros, vitrine). 1:1. */
export const CapaProduto: React.FC = () => (
  <AbsoluteFill
    style={{
      ...base,
      padding: 96,
      display: "flex",
      flexDirection: "column",
      justifyContent: "space-between",
    }}
  >
    <Logo altura={64} />
    <div>
      <div style={{ ...eyebrow, fontSize: 30 }}>Para advogados</div>
      <h1 style={{ ...display, fontSize: 150, marginTop: 20 }}>
        prevIA
        <br />
        <span
          style={{
            background: cor.primary,
            padding: "0 18px",
            borderRadius: 14,
            boxDecorationBreak: "clone",
          }}
        >
          VIRAL
        </span>
      </h1>
      <p style={{ margin: "36px 0 0", fontSize: 44, lineHeight: 1.3, color: cor.muted }}>
        O plano de conteúdo da sua semana, com o roteiro de cada vídeo pronto.
      </p>
    </div>
  </AbsoluteFill>
);
