import { familiaCss } from "@/lib/carrossel-fontes";
import { corLegivelSobre, ehCapa, renderTexto, tamanhos, type ModeloProps } from "./comum";

/**
 * Texto limpo com o trecho de destaque grifado na cor de acento, como marca-texto.
 * A identidade fica no rodapé (foto pequena e arroba) para o texto ocupar o slide.
 */
export function ModeloMarcaTexto({ slide, template, fotoDataUrl, index, total }: ModeloProps) {
  const capa = ehCapa(slide, index);
  const tam = tamanhos(slide, capa);
  const grifo = {
    background: template.cor_destaque,
    color: corLegivelSobre(template.cor_destaque),
    fontWeight: 700,
    padding: "0 0.14em",
    borderRadius: 8,
    // O grifo acompanha cada linha quando o trecho quebra.
    boxDecorationBreak: "clone" as const,
    WebkitBoxDecorationBreak: "clone" as const,
  };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "96px 88px 88px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          gap: 40,
          paddingBottom: 64,
        }}
      >
        {slide.titulo && (
          <div
            style={{
              fontFamily: familiaCss(template.fonte_titulo),
              fontSize: tam.titulo,
              fontWeight: 700,
              lineHeight: 1.18,
              letterSpacing: "-0.025em",
              whiteSpace: "pre-wrap",
            }}
          >
            {/* Sem corpo, o destaque só pode estar no título. */}
            {slide.corpo ? slide.titulo : renderTexto(slide.titulo, slide.destaque, grifo)}
          </div>
        )}
        {slide.corpo && (
          <div
            style={{
              fontSize: tam.corpo,
              fontWeight: 400,
              lineHeight: 1.42,
              letterSpacing: "-0.01em",
              opacity: capa && slide.titulo ? 0.8 : 1,
              whiteSpace: "pre-wrap",
            }}
          >
            {renderTexto(slide.corpo, slide.destaque, grifo)}
          </div>
        )}
      </div>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 24,
          fontSize: 30,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 20, minWidth: 0 }}>
          {fotoDataUrl && (
            <img
              src={fotoDataUrl}
              alt=""
              style={{
                width: 76,
                height: 76,
                borderRadius: "50%",
                objectFit: "cover",
                flexShrink: 0,
              }}
            />
          )}
          <span style={{ fontWeight: 700 }}>@{template.arroba || "seuperfil"}</span>
        </div>
        {capa && index + 1 < total ? (
          <span style={{ ...grifo, padding: "8px 22px", fontSize: 28 }}>arraste →</span>
        ) : (
          <span style={{ opacity: 0.5 }}>
            {index + 1} / {total}
          </span>
        )}
      </div>
    </div>
  );
}
