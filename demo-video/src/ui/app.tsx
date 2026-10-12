// Peças da interface do app, recriadas a partir das telas reais
// (src/routes/_authenticated/route.tsx, plano.tsx). Medidas em px de celular.

import type React from "react";
import {
  CalendarDays,
  CalendarRange,
  FileText,
  Images,
  Menu,
} from "lucide-react";
import { Img, staticFile } from "remotion";
import { cor, fonte, raio } from "../marca";

const ALTURA_STATUS = 50;
const ALTURA_TOPO = 56;
export const ALTURA_BARRA = 84;
/** Onde o conteúdo da tela começa, abaixo da barra de status e do topo. */
export const INICIO_CONTEUDO = ALTURA_STATUS + ALTURA_TOPO;

/** Topo do celular: só a marca. */
export const TopoApp: React.FC = () => (
  <header
    style={{
      position: "absolute",
      insetInline: 0,
      top: 0,
      height: INICIO_CONTEUDO,
      paddingTop: ALTURA_STATUS,
      display: "flex",
      alignItems: "center",
      gap: 12,
      paddingInline: 16,
      borderBottom: `1px solid ${cor.border}`,
      background: cor.background,
      zIndex: 30,
    }}
  >
    <Img
      src={staticFile("icon-192.png")}
      style={{ height: 24, width: 24, borderRadius: 6 }}
    />
    <div
      style={{
        fontFamily: fonte.display,
        fontSize: 16,
        fontWeight: 600,
        letterSpacing: "-0.01em",
      }}
    >
      prevIA <span style={{ color: cor.muted }}>- CONTENT</span>
    </div>
  </header>
);

export type Aba = "hoje" | "plano" | "roteiros" | "carrosseis";

/** Barra inferior do celular, com o item ativo marcado em amarelo no topo. */
export const BarraInferior: React.FC<{
  ativa: Aba;
  pontoNoPlano?: boolean;
  roteirosParaLer?: number;
}> = ({ ativa, pontoNoPlano = false, roteirosParaLer = 0 }) => {
  const itens: { id: Aba | "mais"; rotulo: string; icone: React.ReactNode }[] =
    [
      { id: "hoje", rotulo: "Hoje", icone: <CalendarDays size={20} /> },
      { id: "plano", rotulo: "Plano", icone: <CalendarRange size={20} /> },
      { id: "roteiros", rotulo: "Roteiros", icone: <FileText size={20} /> },
      { id: "carrosseis", rotulo: "Carrosséis", icone: <Images size={20} /> },
      { id: "mais", rotulo: "Mais", icone: <Menu size={20} /> },
    ];

  return (
    <nav
      style={{
        position: "absolute",
        insetInline: 0,
        bottom: 0,
        height: ALTURA_BARRA,
        paddingBottom: 28,
        display: "flex",
        borderTop: `1px solid ${cor.border}`,
        background: cor.surface,
        zIndex: 40,
      }}
    >
      {itens.map((i) => {
        const ehAtiva = i.id === ativa;
        return (
          <div
            key={i.id}
            style={{
              position: "relative",
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              gap: 4,
              fontSize: 11,
              fontWeight: ehAtiva ? 600 : 500,
              color: ehAtiva ? cor.foreground : cor.muted,
            }}
          >
            {ehAtiva && (
              <span
                style={{
                  position: "absolute",
                  top: 0,
                  left: "50%",
                  width: 32,
                  height: 3,
                  marginLeft: -16,
                  borderRadius: "0 0 999px 999px",
                  background: cor.primary,
                }}
              />
            )}
            <span style={{ position: "relative", display: "flex" }}>
              {i.icone}
              {i.id === "plano" && pontoNoPlano && <Ponto />}
              {i.id === "roteiros" && roteirosParaLer > 0 && (
                <Contador n={roteirosParaLer} />
              )}
            </span>
            {i.rotulo}
          </div>
        );
      })}
    </nav>
  );
};

const Ponto: React.FC = () => (
  <span
    style={{
      position: "absolute",
      top: -2,
      right: -2,
      width: 9,
      height: 9,
      borderRadius: 99,
      background: cor.primary,
      border: `1.5px solid ${cor.surface}`,
    }}
  />
);

const Contador: React.FC<{ n: number }> = ({ n }) => (
  <span
    style={{
      position: "absolute",
      top: -6,
      right: -14,
      minWidth: 18,
      height: 18,
      paddingInline: 5,
      borderRadius: 99,
      background: cor.primary,
      color: cor.foreground,
      fontFamily: fonte.mono,
      fontSize: 11,
      lineHeight: "18px",
      textAlign: "center",
    }}
  >
    {n}
  </span>
);

/** Rótulo de seção: mono, 11px, caixa alta. */
export const Rotulo: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      fontFamily: fonte.mono,
      fontSize: 11,
      textTransform: "uppercase",
      letterSpacing: "0.1em",
      color: cor.muted,
      ...style,
    }}
  >
    {children}
  </div>
);

export const Card: React.FC<{
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ children, style }) => (
  <div
    style={{
      background: cor.surface,
      border: `1px solid ${cor.border}`,
      borderRadius: raio.superficie,
      boxShadow: "0 1px 2px rgba(13, 13, 15, 0.05)",
      ...style,
    }}
  >
    {children}
  </div>
);

type Variante = "primario" | "outline" | "secundario" | "ghost";

export const Botao: React.FC<{
  children: React.ReactNode;
  variante?: Variante;
  icone?: React.ReactNode;
  grande?: boolean;
  style?: React.CSSProperties;
}> = ({ children, variante = "primario", icone, grande = false, style }) => {
  const visual: Record<Variante, React.CSSProperties> = {
    primario: { background: cor.primary, color: cor.foreground },
    secundario: { background: cor.secondary, color: cor.foreground },
    outline: {
      background: cor.surface,
      color: cor.foreground,
      border: `1px solid ${cor.border}`,
    },
    ghost: { background: "transparent", color: cor.muted },
  };
  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        height: grande ? 48 : 36,
        paddingInline: grande ? 20 : 12,
        borderRadius: raio.controle,
        fontSize: grande ? 16 : 14,
        fontWeight: 500,
        whiteSpace: "nowrap",
        ...visual[variante],
        ...style,
      }}
    >
      {icone}
      {children}
    </div>
  );
};

/** Título de página: Space Grotesk, como o h1 das telas. */
export const TituloPagina: React.FC<{
  children: React.ReactNode;
  subtitulo?: string;
}> = ({ children, subtitulo }) => (
  <div>
    <h1
      style={{
        margin: 0,
        fontFamily: fonte.display,
        fontWeight: 700,
        fontSize: 24,
        letterSpacing: "-0.02em",
        lineHeight: 1.2,
      }}
    >
      {children}
    </h1>
    {subtitulo && (
      <p
        style={{
          margin: "4px 0 0",
          fontSize: 14,
          color: cor.muted,
          lineHeight: 1.45,
        }}
      >
        {subtitulo}
      </p>
    )}
  </div>
);
