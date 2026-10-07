import { familiaCss } from "@/lib/carrossel-fontes";
import { ehCapa, hexComAlfa, renderTexto, tamanhos, type ModeloProps } from "./comum";
import { ImagemDaCapa } from "./ImagemDaCapa";

function VerifiedBadge({ color }: { color: string }) {
  return (
    <svg width={34} height={34} viewBox="0 0 24 24" fill={color} aria-hidden="true">
      <path d="M22.25 12c0-1.43-.88-2.67-2.19-3.34.46-1.39.2-2.9-.81-3.91s-2.52-1.27-3.91-.81C14.67 2.63 13.43 1.75 12 1.75S9.33 2.63 8.66 3.94c-1.39-.46-2.9-.2-3.91.81s-1.27 2.52-.81 3.91C2.63 9.33 1.75 10.57 1.75 12s.88 2.67 2.19 3.34c-.46 1.39-.2 2.9.81 3.91s2.52 1.27 3.91.81c.67 1.31 1.91 2.19 3.34 2.19s2.67-.88 3.34-2.19c1.39.46 2.9.2 3.91-.81s1.27-2.52.81-3.91c1.31-.67 2.19-1.91 2.19-3.34zm-11.71 4.2L6.8 12.46l1.41-1.42 2.26 2.26 4.8-5.23 1.47 1.36-6.2 6.77z" />
    </svg>
  );
}

/** Estilo "post de rede social": avatar, nome, arroba, selo, título e corpo. */
export function ModeloTweet({
  slide,
  template,
  fotoDataUrl,
  index,
  total,
  imagemCapa,
}: ModeloProps) {
  const capa = ehCapa(slide, index);
  // Com foto anexada, o texto da capa encolhe para os dois caberem.
  const comImagem = capa && Boolean(imagemCapa);
  const tam = tamanhos(slide, capa, comImagem ? 0.8 : 1);

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "96px 88px",
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
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: comImagem ? 28 : 36,
          paddingTop: comImagem ? 48 : 72,
          paddingBottom: comImagem ? 48 : 72,
        }}
      >
        {slide.titulo && (
          <div
            style={{
              fontFamily: familiaCss(template.fonte_titulo),
              fontSize: tam.titulo,
              fontWeight: 700,
              lineHeight: 1.12,
              letterSpacing: "-0.025em",
              whiteSpace: "pre-wrap",
            }}
          >
            {slide.titulo}
          </div>
        )}
        {slide.corpo && (
          <div
            style={{
              fontSize: tam.corpo,
              fontWeight: 400,
              lineHeight: 1.34,
              letterSpacing: "-0.01em",
              opacity: slide.titulo ? 0.9 : 1,
              whiteSpace: "pre-wrap",
            }}
          >
            {renderTexto(slide.corpo, slide.destaque, { fontWeight: 700 })}
          </div>
        )}
        {/* Como num post com foto: a imagem vem anexada abaixo do texto. */}
        {comImagem && imagemCapa && (
          <div
            style={{
              height: 480,
              marginTop: 8,
              borderRadius: 28,
              overflow: "hidden",
              border: `2px solid ${hexComAlfa(template.cor_texto, 0.14)}`,
              flexShrink: 0,
            }}
          >
            <ImagemDaCapa imagem={imagemCapa} />
          </div>
        )}
      </div>

      <div
        style={{ display: "flex", justifyContent: "space-between", fontSize: 30, opacity: 0.45 }}
      >
        <span>
          {index + 1} / {total}
        </span>
        <span>{index + 1 < total ? "arraste →" : ""}</span>
      </div>
    </div>
  );
}
