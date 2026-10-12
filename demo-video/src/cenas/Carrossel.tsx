// Cena 5: o roteiro vira carrossel. Os slides são desenhados pelo próprio
// componente do app (src/components/CarrosselSlide.tsx), então saem iguais ao
// PNG que o app exporta.

import type React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { loadFont as carregarDmSans } from "@remotion/google-fonts/DMSans";
import { loadFont as carregarDmSerif } from "@remotion/google-fonts/DMSerifDisplay";
import { loadFont as carregarBaskerville } from "@remotion/google-fonts/LibreBaskerville";
import { Download, Images, Loader2 } from "lucide-react";
import { CarrosselSlide } from "@/components/CarrosselSlide";
import type { TemplateCarrossel } from "@/lib/carrossel-template";
import { persona, plano, slidesCarrossel } from "../dados";
import { cor, fonte } from "../marca";
import { entrada, mix, progresso } from "../ui/anim";
import { Botao, Card, INICIO_CONTEUDO, Rotulo, TopoApp } from "../ui/app";
import { Celular } from "../ui/Celular";
import { Toque } from "../ui/efeitos";
import { Narracao } from "../ui/Narracao";
import { Som } from "../ui/Som";
import { Palco } from "../ui/Palco";
import { duracaoDaCena, falasDaCena } from "../voz/narracao";

const latim = { subsets: ["latin", "latin-ext"] as ("latin" | "latin-ext")[] };
carregarBaskerville("normal", { weights: ["400", "700"], ...latim });
carregarDmSerif("normal", { weights: ["400"], ...latim });
carregarDmSans("normal", { weights: ["400", "700"], ...latim });

const FALAS = falasDaCena("carrossel");

const T = {
  toqueGerar: 14,
  slides: 44,
  modelos: FALAS[1].de - 10,
  leque: FALAS[2].de - 6,
};

export const DURACAO_CARROSSEL = duracaoDaCena("carrossel", T.leque + 90);

const base = {
  arroba: persona.arroba,
  nome_exibicao: "Dra. Marina Albuquerque",
  foto_path: "",
  verificado: true,
};

const MODELOS: { nome: string; template: TemplateCarrossel }[] = [
  {
    nome: "Editorial",
    template: {
      ...base,
      modelo: "editorial",
      cor_fundo: "#13233F",
      cor_texto: "#F6F3EC",
      cor_destaque: "#D9B26A",
      fonte_titulo: "libre-baskerville",
      fonte_texto: "inter",
    },
  },
  {
    nome: "Marca-texto",
    template: {
      ...base,
      modelo: "marca-texto",
      cor_fundo: "#F6F1E7",
      cor_texto: "#1B1B1B",
      cor_destaque: "#F2C94C",
      fonte_titulo: "dm-serif",
      fonte_texto: "dm-sans",
    },
  },
  {
    nome: "Tweet",
    template: {
      ...base,
      modelo: "tweet",
      cor_fundo: "#FFFFFF",
      cor_texto: "#0F1419",
      cor_destaque: "#F4DB0B",
      fonte_titulo: "inter",
      fonte_texto: "inter",
    },
  },
];

/** Foto de perfil fictícia: um monograma, já que a persona não existe. */
const FOTO = `data:image/svg+xml;utf8,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><rect width="100" height="100" fill="#13233F"/><text x="50" y="62" font-family="Georgia, serif" font-size="40" fill="#D9B26A" text-anchor="middle">MA</text></svg>`,
)}`;

const TEMPLATE_PRINCIPAL = MODELOS[0].template;

export const Carrossel: React.FC = () => {
  const frame = useCurrentFrame();
  const saiCelular = progresso(frame, T.modelos, 18);

  return (
    <AbsoluteFill
      style={{ background: cor.background, fontFamily: fonte.sans }}
    >
      <Narracao falas={FALAS} rotulo="Segunda · Carrossel" />
      <Som nome="confirmacao" em={T.slides} />
      <Som nome="pop" em={T.modelos + 8 + 22} />
      <Som nome="pop" em={T.modelos + 8 + 44} />
      <Som nome="cartas" em={T.leque + 2} />
      <Som nome="toque" em={T.leque + 56} />
      <Palco topo={380}>
        {saiCelular < 1 && (
          <Celular
            style={{ top: mix(600, 1100, saiCelular), opacity: 1 - saiCelular }}
            sobreposicao={
              <Toque x={290} y={INICIO_CONTEUDO + 82} em={T.toqueGerar} />
            }
          >
            <TopoApp />
            <TelaCarrossel frame={frame} />
          </Celular>
        )}

        {frame >= T.modelos && frame < T.leque + 10 && (
          <Modelos frame={frame} />
        )}
        {frame >= T.leque && <Leque frame={frame} />}
      </Palco>
    </AbsoluteFill>
  );
};

/** A seção Carrossel da tela do roteiro: gerar, esperar, ver os slides. */
const TelaCarrossel: React.FC<{ frame: number }> = ({ frame }) => {
  const gerando = frame >= T.toqueGerar && frame < T.slides;
  const pronto = frame >= T.slides;
  return (
    <div
      style={{
        position: "absolute",
        insetInline: 16,
        top: INICIO_CONTEUDO + 24,
      }}
    >
      <Card style={{ padding: 18 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Rotulo style={{ fontSize: 12 }}>Carrossel</Rotulo>
          <div style={{ display: "flex", gap: 8 }}>
            {pronto && (
              <Botao
                variante="outline"
                icone={<Download size={14} />}
                style={{ height: 32, fontSize: 13 }}
              >
                Baixar todos
              </Botao>
            )}
            <Botao
              icone={
                gerando ? (
                  <Loader2 size={14} style={{ rotate: `${frame * 12}deg` }} />
                ) : (
                  <Images size={14} />
                )
              }
              style={{ height: 32, fontSize: 13 }}
            >
              {gerando ? "Gerando..." : pronto ? "Regerar" : "Gerar carrossel"}
            </Botao>
          </div>
        </div>
        {!pronto && (
          <p
            style={{
              margin: "16px 0 0",
              fontSize: 14,
              color: cor.muted,
              fontStyle: "italic",
              lineHeight: 1.5,
            }}
          >
            Nenhum carrossel gerado. A prevIA parte da tese do roteiro e escreve
            um carrossel próprio para leitura: capa que prende, uma ideia por
            slide e um fechamento que vale salvar.
          </p>
        )}
        {pronto && (
          <>
            <p
              style={{
                margin: "16px 0 12px",
                fontSize: 14,
                color: cor.muted,
                lineHeight: 1.5,
                ...entrada(frame, T.slides, 12, 8),
              }}
            >
              <span style={{ fontWeight: 500, color: cor.foreground }}>
                Passo a passo.
              </span>{" "}
              Do susto do “indeferido” ao que conferir antes do próximo passo.
            </p>
            <div style={{ display: "flex", gap: 12 }}>
              {slidesCarrossel.slice(0, 3).map((s, i) => (
                <div
                  key={i}
                  style={{
                    flexShrink: 0,
                    ...entrada(frame, T.slides + 4 + i * 5, 14, 16),
                  }}
                >
                  <div
                    style={{
                      fontFamily: fonte.mono,
                      fontSize: 10,
                      textTransform: "uppercase",
                      color: cor.muted,
                      marginBottom: 6,
                    }}
                  >
                    {s.tipo}
                  </div>
                  <CarrosselSlide
                    slide={s}
                    template={TEMPLATE_PRINCIPAL}
                    fotoDataUrl={FOTO}
                    index={i}
                    total={slidesCarrossel.length}
                    scale={0.2}
                  />
                </div>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

/** A capa em tamanho grande, trocando de modelo: a identidade é de quem posta. */
const Modelos: React.FC<{ frame: number }> = ({ frame }) => {
  const passo = 22;
  const atual = Math.min(
    MODELOS.length - 1,
    Math.max(0, Math.floor((frame - T.modelos - 8) / passo)),
  );
  const aparece = progresso(frame, T.modelos + 4, 18);
  const sai = progresso(frame, T.leque - 4, 12);
  const escala = 0.62;

  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        top: 640,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        opacity: aparece * (1 - sai),
        scale: String(mix(0.9, 1, aparece)),
      }}
    >
      <div
        style={{
          position: "relative",
          width: 1080 * escala,
          height: 1350 * escala,
          boxShadow: "0 30px 60px rgba(13,13,15,0.18)",
          borderRadius: 16 * escala,
        }}
      >
        {MODELOS.map((m, i) => {
          const entra =
            i === 0 ? 1 : progresso(frame, T.modelos + 8 + i * passo, 10);
          if (i > atual + 1) return null;
          return (
            <div
              key={m.nome}
              style={{ position: "absolute", inset: 0, opacity: entra }}
            >
              <CarrosselSlide
                slide={slidesCarrossel[0]}
                template={m.template}
                fotoDataUrl={FOTO}
                index={0}
                total={slidesCarrossel.length}
                scale={escala}
              />
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 40 }}>
        {MODELOS.map((m, i) => (
          <span
            key={m.nome}
            style={{
              fontFamily: fonte.mono,
              fontSize: 28,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              padding: "10px 20px",
              borderRadius: 10,
              background: i === atual ? cor.foreground : "transparent",
              color: i === atual ? cor.background : cor.muted,
              border: `2px solid ${i === atual ? cor.foreground : cor.border}`,
            }}
          >
            {m.nome}
          </span>
        ))}
      </div>
    </div>
  );
};

/** Os 5 slides abertos em leque e o "Baixar todos". */
const Leque: React.FC<{ frame: number }> = ({ frame }) => {
  const escala = 0.34;
  const n = slidesCarrossel.length;
  return (
    <>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 760,
          height: 1350 * escala,
        }}
      >
        {slidesCarrossel.map((s, i) => {
          const p = progresso(frame, T.leque + 4 + i * 3, 22);
          // A capa fica no meio, na frente; os outros slides se abrem atrás dela.
          const pos = [0, -1, 1, -2, 2][i] ?? 0;
          return (
            <div
              key={i}
              style={{
                position: "absolute",
                left: "50%",
                top: 0,
                marginLeft: (-1080 * escala) / 2,
                translate: `${pos * 150 * p}px ${Math.abs(pos) * 24 * p}px`,
                rotate: `${pos * 5 * p}deg`,
                zIndex: 10 - Math.abs(pos),
                boxShadow: "0 20px 40px rgba(13,13,15,0.2)",
                borderRadius: 16 * escala,
              }}
            >
              <CarrosselSlide
                slide={s}
                template={TEMPLATE_PRINCIPAL}
                fotoDataUrl={FOTO}
                index={i}
                total={n}
                scale={escala}
              />
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 1360,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          ...entrada(frame, T.leque + 26, 16),
        }}
      >
        <Botao
          grande
          icone={<Download size={44} />}
          style={{
            height: 120,
            paddingInline: 56,
            fontSize: 48,
            borderRadius: 18,
            gap: 18,
            scale: String(
              interpolate(
                frame,
                [T.leque + 56, T.leque + 60, T.leque + 66],
                [1, 0.94, 1],
                { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
              ),
            ),
          }}
        >
          Baixar todos
        </Botao>
        <span
          style={{
            fontFamily: fonte.mono,
            fontSize: 28,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: cor.muted,
          }}
        >
          {n} slides · PNG 1080×1350 · {plano[0].dia} {plano[0].data}
        </span>
      </div>
    </>
  );
};
