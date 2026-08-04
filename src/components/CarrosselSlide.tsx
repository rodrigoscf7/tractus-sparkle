import { forwardRef } from "react";
import type { CarrosselSlideData, TemplateCarrossel } from "@/lib/carrossel-template";

const WIDTH = 1080;
const HEIGHT = 1350;

/** Quebra o texto em partes, marcando o trecho de destaque em negrito. */
function renderTexto(texto: string, destaque?: string) {
  const d = (destaque ?? "").trim();
  if (!d) return <>{texto}</>;
  const idx = texto.toLowerCase().indexOf(d.toLowerCase());
  if (idx < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, idx)}
      <strong style={{ fontWeight: 700 }}>{texto.slice(idx, idx + d.length)}</strong>
      {texto.slice(idx + d.length)}
    </>
  );
}

function VerifiedBadge({ color }: { color: string }) {
  return (
    <svg width={34} height={34} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75S9.33 2.63 8.66 3.94c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
    </svg>
  );
}

type Props = {
  slide: CarrosselSlideData;
  template: TemplateCarrossel;
  fotoDataUrl: string;
  index: number;
  total: number;
  scale?: number;
};

/** Slide 1080×1350 (4:5) no estilo "post de rede social": fundo sólido, avatar, arroba, selo e texto. */
export const CarrosselSlide = forwardRef<HTMLDivElement, Props>(function CarrosselSlide(
  { slide, template, fotoDataUrl, index, total, scale = 1 },
  ref,
) {
  const len = slide.texto.length;
  const fontSize = len < 70 ? 92 : len < 130 ? 74 : len < 190 ? 60 : 52;
  const paddingX = 88;
  const paddingY = 96;

  return (
    <div
      style={{
        width: WIDTH * scale,
        height: HEIGHT * scale,
        overflow: "hidden",
        borderRadius: 16 * scale,
        flexShrink: 0,
      }}
    >
      <div
        ref={ref}
        style={{
          width: WIDTH,
          height: HEIGHT,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          background: template.cor_fundo,
          color: template.cor_texto,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: `${paddingY}px ${paddingX}px`,
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif",
          boxSizing: "border-box",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <div
            style={{
              width: 112,
              height: 112,
              borderRadius: "50%",
              overflow: "hidden",
              background: "rgba(127,127,127,0.35)",
              flexShrink: 0,
            }}
          >
            {fotoDataUrl ? (
              <img
                src={fotoDataUrl}
                alt=""
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : null}
          </div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 40, fontWeight: 700, letterSpacing: "-0.02em" }}>
                {template.nome_exibicao || template.arroba || "Nome do perfil"}
              </span>
              {template.verificado && <VerifiedBadge color={template.cor_texto} />}
            </div>
            <div style={{ fontSize: 34, opacity: 0.6, marginTop: 4 }}>
              @{template.arroba || "seuperfil"}
            </div>
          </div>
        </div>

        <div
          style={{
            fontSize,
            lineHeight: 1.28,
            letterSpacing: "-0.02em",
            fontWeight: 400,
            flex: 1,
            display: "flex",
            alignItems: "center",
            paddingTop: 72,
            paddingBottom: 72,
            whiteSpace: "pre-wrap",
          }}
        >
          <span>{renderTexto(slide.texto, slide.destaque)}</span>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 30, opacity: 0.45 }}>
          <span>{index + 1} / {total}</span>
          <span>{index + 1 < total ? "arraste →" : ""}</span>
        </div>
      </div>
    </div>
  );
});
