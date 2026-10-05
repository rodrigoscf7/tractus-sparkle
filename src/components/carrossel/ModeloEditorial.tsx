import { familiaCss } from "@/lib/carrossel-fontes";
import { doisDigitos, ehCapa, renderTexto, tamanhos, type ModeloProps } from "./comum";

/**
 * Página de revista: cabeçalho com fio, título grande, fio curto de acento
 * entre título e corpo e o destaque na cor de acento. A capa desce o título
 * para a base da página, com uma barra de acento acima.
 */
export function ModeloEditorial({ slide, template, index, total }: ModeloProps) {
  const capa = ehCapa(slide, index);
  const tam = tamanhos(slide, capa);
  const acento = template.cor_destaque;
  const estiloDestaque = { color: acento, fontWeight: 700 };
  const fio = { height: 2, background: template.cor_texto, opacity: 0.25 };

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        padding: "88px 88px 80px",
        boxSizing: "border-box",
      }}
    >
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "baseline",
            gap: 24,
            fontSize: 26,
          }}
        >
          <span style={{ fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase" }}>
            {template.nome_exibicao || template.arroba || "Nome do perfil"}
          </span>
          <span style={{ opacity: 0.6 }}>@{template.arroba || "seuperfil"}</span>
        </div>
        <div style={{ ...fio, marginTop: 24 }} />
      </div>

      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: capa ? "flex-end" : "center",
          paddingTop: 64,
          paddingBottom: 64,
        }}
      >
        {capa && <div style={{ width: 140, height: 12, background: acento, marginBottom: 48 }} />}
        {slide.titulo && (
          <div
            style={{
              fontFamily: familiaCss(template.fonte_titulo),
              fontSize: capa ? Math.round(tam.titulo * 1.1) : tam.titulo,
              fontWeight: 700,
              lineHeight: capa ? 1.04 : 1.1,
              letterSpacing: "-0.03em",
              whiteSpace: "pre-wrap",
            }}
          >
            {/* Sem corpo, o destaque só pode estar no título. */}
            {slide.corpo ? slide.titulo : renderTexto(slide.titulo, slide.destaque, estiloDestaque)}
          </div>
        )}
        {slide.titulo && slide.corpo && !capa && (
          <div style={{ width: 96, height: 6, background: acento, margin: "44px 0" }} />
        )}
        {slide.corpo && (
          <div
            style={{
              fontSize: tam.corpo,
              fontWeight: 400,
              lineHeight: 1.36,
              letterSpacing: "-0.01em",
              opacity: capa ? 0.75 : 1,
              marginTop: capa && slide.titulo ? 40 : 0,
              whiteSpace: "pre-wrap",
            }}
          >
            {renderTexto(slide.corpo, slide.destaque, estiloDestaque)}
          </div>
        )}
      </div>

      <div>
        <div style={fio} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 24,
            fontSize: 28,
          }}
        >
          <span>
            <span style={{ color: acento, fontWeight: 700 }}>{doisDigitos(index + 1)}</span>
            <span style={{ opacity: 0.5 }}> / {doisDigitos(total)}</span>
          </span>
          <span style={{ opacity: 0.5 }}>{index + 1 < total ? "arraste →" : ""}</span>
        </div>
      </div>
    </div>
  );
}
