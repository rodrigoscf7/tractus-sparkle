// Cena 1: o onboarding (área, referências, dias) e o DNA viral que sai dele.
// Textos de onboarding.index.tsx, onboarding/campos.tsx e dna.tsx.

import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { ArrowLeft, ArrowRight, Download, X } from "lucide-react";
import { persona } from "../dados";
import { cor, fonte } from "../marca";
import { entrada, mix, progresso } from "../ui/anim";
import { Botao, INICIO_CONTEUDO, Rotulo, TopoApp } from "../ui/app";
import { ALTURA_TELA, Celular } from "../ui/Celular";
import { Toque } from "../ui/efeitos";
import { Narracao } from "../ui/Narracao";
import { Som } from "../ui/Som";
import { Palco } from "../ui/Palco";
import { duracaoDaCena, falasDaCena } from "../voz/narracao";

const FALAS = falasDaCena("configuracao");

const T = {
  toqueArea: 34,
  toqueContinuar1: FALAS[1].de - 14,
  referencias: FALAS[1].de - 4,
  dias: FALAS[2].de - 4,
  toqueManual: FALAS[3].de - 16,
  dna: FALAS[3].de - 4,
};

export const DURACAO_CONFIGURACAO = duracaoDaCena("configuracao", T.dna + 110);

const ALTURA_STATUS = 50;
const Y_CONTINUAR = ALTURA_TELA - 58;

export const Configuracao: React.FC = () => {
  const frame = useCurrentFrame();
  const naDna = frame >= T.dna;

  return (
    <AbsoluteFill
      style={{ background: cor.background, fontFamily: fonte.sans }}
    >
      <Narracao falas={FALAS} rotulo="Primeiro acesso" />
      <Som nome="digitacao" em={T.referencias + 4} />
      {persona.referencias.map((h, i) => (
        <Som key={h} nome="pop" em={T.referencias + 24 + i * 5} />
      ))}
      <Som nome="confirmacao" em={T.dna + 2} />
      <Palco>
        <Celular
          style={{ top: 600 }}
          sobreposicao={
            <>
              <Toque x={195} y={244} em={T.toqueArea} />
              <Toque x={300} y={Y_CONTINUAR} em={T.toqueContinuar1} />
              <Toque x={60} y={267} em={T.dias + 10} />
              <Toque x={240} y={267} em={T.dias + 20} />
              <Toque x={60} y={329} em={T.dias + 30} />
              <Toque x={290} y={Y_CONTINUAR} em={T.toqueManual} />
            </>
          }
        >
          {!naDna && <Wizard frame={frame} />}
          {naDna && <TelaDna frame={frame} />}
        </Celular>
      </Palco>
    </AbsoluteFill>
  );
};

const PASSOS = [
  { titulo: "Você", resumo: "Quem fala e sobre o que" },
  { titulo: "Suas referências", resumo: "Onde buscar repertório" },
  { titulo: "Seu ritmo", resumo: "Com o que você se compromete" },
];

const Wizard: React.FC<{ frame: number }> = ({ frame }) => {
  const passo = frame >= T.dias ? 2 : frame >= T.referencias ? 1 : 0;
  const numero = [1, 4, 5][passo];
  const inicioDoPasso = [0, T.referencias, T.dias][passo];
  const ultimo = passo === 2;

  return (
    <>
      {/* Trilho de progresso e cabeçalho do passo. */}
      <div
        style={{
          position: "absolute",
          insetInline: 0,
          top: ALTURA_STATUS,
          zIndex: 20,
          background: cor.background,
        }}
      >
        <div style={{ height: 3, background: cor.divider }}>
          <div
            style={{
              height: "100%",
              background: cor.primary,
              width: `${
                interpolate(
                  frame,
                  [inicioDoPasso, inicioDoPasso + 15],
                  [numero - 1, numero],
                  {
                    extrapolateLeft: "clamp",
                    extrapolateRight: "clamp",
                  },
                ) * 20
              }%`,
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 20px",
          }}
        >
          <div>
            <div
              style={{
                fontFamily: fonte.display,
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              {PASSOS[passo].titulo}
            </div>
            <div style={{ fontSize: 14, color: cor.muted }}>
              {PASSOS[passo].resumo}
            </div>
          </div>
          <div
            style={{
              fontSize: 14,
              color: cor.muted,
              fontVariantNumeric: "tabular-nums",
            }}
          >
            Passo {numero} de 5
          </div>
        </div>
      </div>

      <div
        key={passo}
        style={{
          position: "absolute",
          insetInline: 20,
          top: ALTURA_STATUS + 96,
          ...entrada(frame, inicioDoPasso, 14, 12),
        }}
      >
        {passo === 0 && <PassoArea frame={frame} />}
        {passo === 1 && <PassoReferencias frame={frame} />}
        {passo === 2 && <PassoDias frame={frame} />}
      </div>

      {/* Barra de navegação do wizard. */}
      <div
        style={{
          position: "absolute",
          insetInline: 0,
          bottom: 0,
          height: 92,
          paddingBottom: 26,
          borderTop: `1px solid ${cor.border}`,
          background: cor.background,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          paddingInline: 20,
          zIndex: 20,
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            color: cor.muted,
          }}
        >
          <ArrowLeft size={16} /> Voltar
        </span>
        <Botao grande icone={null} style={{ paddingInline: 22 }}>
          {ultimo ? "Montar meu manual" : "Continuar"} <ArrowRight size={16} />
        </Botao>
      </div>
    </>
  );
};

const Pergunta: React.FC<{
  titulo: string;
  apoio?: string;
  children: React.ReactNode;
}> = ({ titulo, apoio, children }) => (
  <section>
    <h2
      style={{
        margin: 0,
        fontFamily: fonte.display,
        fontWeight: 600,
        fontSize: 21,
        lineHeight: 1.3,
        letterSpacing: "-0.01em",
      }}
    >
      {titulo}
    </h2>
    {apoio && (
      <p
        style={{
          margin: "6px 0 0",
          fontSize: 15,
          color: cor.muted,
          lineHeight: 1.5,
        }}
      >
        {apoio}
      </p>
    )}
    <div style={{ marginTop: 16 }}>{children}</div>
  </section>
);

const Opcao: React.FC<{
  ativa: boolean;
  children: React.ReactNode;
  style?: React.CSSProperties;
}> = ({ ativa, children, style }) => (
  <div
    style={{
      position: "relative",
      borderRadius: 8,
      border: `1px solid ${ativa ? cor.foreground : cor.border}`,
      background: cor.surface,
      padding: 14,
      fontSize: 16,
      ...style,
    }}
  >
    {ativa && (
      <span
        style={{
          position: "absolute",
          top: 10,
          right: 10,
          width: 10,
          height: 10,
          borderRadius: 2,
          background: cor.primary,
        }}
      />
    )}
    {children}
  </div>
);

const PassoArea: React.FC<{ frame: number }> = ({ frame }) => (
  <Pergunta titulo="Qual é a sua principal área de atuação?">
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {[
        "Previdenciário",
        "Trabalhista",
        "Família",
        "Criminal",
        "Empresarial",
        "Tributário",
      ].map((a, i) => (
        <Opcao key={a} ativa={i === 0 && frame >= T.toqueArea}>
          {a}
        </Opcao>
      ))}
    </div>
  </Pergunta>
);

const PassoReferencias: React.FC<{ frame: number }> = ({ frame }) => {
  const digitado = persona.referencias[0];
  const letras = Math.floor(
    interpolate(
      frame,
      [T.referencias + 4, T.referencias + 20],
      [0, digitado.length],
      {
        extrapolateLeft: "clamp",
        extrapolateRight: "clamp",
      },
    ),
  );
  const adicionados = persona.referencias.filter(
    (_, i) => frame >= T.referencias + 24 + i * 5,
  );
  const rascunho = adicionados.length ? "" : digitado.slice(0, letras);

  return (
    <Pergunta
      titulo="Quais criadores você gosta de acompanhar?"
      apoio="A prevIA lê o que esses perfis publicam e traz o que der para adaptar ao seu posicionamento."
    >
      <div style={{ display: "flex", gap: 8 }}>
        <div
          style={{
            flex: 1,
            height: 44,
            borderRadius: 8,
            border: `1px solid ${cor.foreground}`,
            background: cor.surface,
            display: "flex",
            alignItems: "center",
            paddingLeft: 12,
            gap: 2,
            fontSize: 16,
          }}
        >
          <span style={{ color: cor.muted }}>@</span>
          <span>{rascunho}</span>
          {!rascunho && (
            <span style={{ color: cor.subtle }}>perfil.no.instagram</span>
          )}
          {frame % 30 < 16 && (
            <span
              style={{ width: 1.5, height: 20, background: cor.foreground }}
            />
          )}
        </div>
        <Botao variante="outline" style={{ height: 44, fontSize: 16 }}>
          Adicionar
        </Botao>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
        {adicionados.map((h, i) => (
          <span
            key={h}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              borderRadius: 8,
              border: `1px solid ${cor.border}`,
              background: cor.surface,
              padding: "6px 8px 6px 12px",
              fontSize: 16,
              ...entrada(frame, T.referencias + 24 + i * 5, 10, 8),
            }}
          >
            @{h} <X size={14} color={cor.muted} />
          </span>
        ))}
      </div>
    </Pergunta>
  );
};

const DIAS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

const PassoDias: React.FC<{ frame: number }> = ({ frame }) => {
  const marcados = [
    frame >= T.dias + 10 ? "Seg" : null,
    frame >= T.dias + 20 ? "Qua" : null,
    frame >= T.dias + 30 ? "Sex" : null,
  ].filter(Boolean) as string[];
  const total = marcados.length;

  return (
    <Pergunta
      titulo="Em que dias você vai postar?"
      apoio="A prevIA garante que sempre exista conteúdo pronto para estes dias e lembra você neles."
    >
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(4, 1fr)",
          gap: 8,
        }}
      >
        {DIAS.map((d) => (
          <Opcao
            key={d}
            ativa={marcados.includes(d)}
            style={{
              height: 54,
              padding: 0,
              display: "grid",
              placeItems: "center",
              fontWeight: 500,
            }}
          >
            {d}
          </Opcao>
        ))}
      </div>
      <p style={{ margin: "12px 0 0", fontSize: 16, color: cor.muted }}>
        {total === 0
          ? "Escolha ao menos um dia."
          : total === 1
            ? "1 vez por semana."
            : `${total} vezes por semana.`}
      </p>
    </Pergunta>
  );
};

/** O DNA viral que a prevIA escreve no fim do onboarding (dna.tsx). */
const TelaDna: React.FC<{ frame: number }> = ({ frame }) => {
  const rolagem = mix(0, -210, progresso(frame, T.dna + 50, 50));
  return (
    <>
      <TopoApp />
      <div
        style={{
          position: "absolute",
          insetInline: 20,
          top: INICIO_CONTEUDO + 24,
          translate: `0px ${rolagem}px`,
        }}
      >
        <header
          style={{
            borderBottom: `1px solid ${cor.border}`,
            paddingBottom: 22,
            ...entrada(frame, T.dna, 16),
          }}
        >
          <p style={{ margin: 0, fontSize: 14, color: cor.muted }}>DNA viral</p>
          <h1
            style={{
              margin: "4px 0 0",
              fontFamily: fonte.display,
              fontWeight: 600,
              fontSize: 28,
              lineHeight: 1.15,
              letterSpacing: "-0.02em",
            }}
          >
            {persona.nome}
          </h1>
          <p style={{ margin: "6px 0 0", fontSize: 14, color: cor.muted }}>
            Versão 1 · 11/10/2026
          </p>
          <Botao icone={<Download size={16} />} style={{ marginTop: 14 }}>
            Baixar PDF
          </Botao>
          <p
            style={{
              margin: "18px 0 0",
              fontFamily: fonte.display,
              fontSize: 18,
              lineHeight: 1.5,
            }}
          >
            Previdenciarista que traduz o INSS para quem está perto de se
            aposentar, com clareza e sem juridiquês.
          </p>
        </header>

        <Secao
          numero="01"
          titulo="Seus pilares de conteúdo"
          frame={frame}
          inicio={T.dna + 14}
        >
          <h3
            style={{
              margin: 0,
              fontFamily: fonte.display,
              fontWeight: 600,
              fontSize: 18,
            }}
          >
            Direitos que ninguém te conta
          </h3>
          <p
            style={{
              margin: "4px 0 0",
              fontSize: 15,
              color: cor.muted,
              lineHeight: 1.5,
            }}
          >
            Seu público perde benefício por falta de informação.
          </p>
          {[
            "Tempo rural conta para a aposentadoria?",
            "O que fazer quando o INSS marca perícia",
          ].map((t) => (
            <div
              key={t}
              style={{ display: "flex", gap: 10, marginTop: 8, fontSize: 15 }}
            >
              <span
                style={{
                  marginTop: 9,
                  width: 6,
                  height: 6,
                  borderRadius: 99,
                  background: cor.primary,
                  flexShrink: 0,
                }}
              />
              {t}
            </div>
          ))}
        </Secao>

        <Secao
          numero="02"
          titulo="Suas fórmulas de gancho"
          frame={frame}
          inicio={T.dna + 22}
        >
          <div
            style={{
              borderRadius: 8,
              border: `1px solid ${cor.border}`,
              background: cor.surface,
              padding: 16,
            }}
          >
            <h3
              style={{
                margin: 0,
                fontFamily: fonte.display,
                fontWeight: 600,
                fontSize: 16,
              }}
            >
              A pergunta que incomoda
            </h3>
            <p
              style={{
                margin: "6px 0 0",
                fontSize: 15,
                color: cor.muted,
                lineHeight: 1.5,
              }}
            >
              Uma pergunta direta sobre algo que a pessoa pode estar perdendo.
            </p>
            <p
              style={{
                margin: "10px 0 0",
                fontFamily: fonte.display,
                fontSize: 17,
                lineHeight: 1.35,
              }}
            >
              “Você sabe quanto tempo de contribuição falta no seu extrato?”
            </p>
          </div>
        </Secao>
      </div>
    </>
  );
};

const Secao: React.FC<{
  numero: string;
  titulo: string;
  frame: number;
  inicio: number;
  children: React.ReactNode;
}> = ({ numero, titulo, frame, inicio, children }) => (
  <section style={{ marginTop: 28, ...entrada(frame, inicio, 16) }}>
    <div
      style={{
        display: "flex",
        alignItems: "baseline",
        gap: 10,
        borderBottom: `1px solid ${cor.border}`,
        paddingBottom: 10,
      }}
    >
      <Rotulo style={{ fontSize: 13, letterSpacing: 0 }}>{numero}</Rotulo>
      <h2
        style={{
          margin: 0,
          fontFamily: fonte.display,
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: "-0.01em",
        }}
      >
        {titulo}
      </h2>
    </div>
    <div style={{ marginTop: 14 }}>{children}</div>
  </section>
);
