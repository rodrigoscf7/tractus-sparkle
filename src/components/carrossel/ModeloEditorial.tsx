import { familiaCss } from "@/lib/carrossel-fontes";
import { doisDigitos, ehCapa, hexComAlfa, renderTexto, tamanhos, type ModeloProps } from "./comum";
import { ImagemDaCapa } from "./ImagemDaCapa";

const PADDING_X = 88;
const PADDING_BAIXO = 80;

/**
 * Página de revista: cabeçalho com fio, título grande, fio curto de acento
 * entre título e corpo e o destaque na cor de acento. A capa desce o título
 * para a base da página, com uma barra de acento acima.
 *
 * Com imagem, a capa vira página de abertura de revista: a foto ocupa o
 * fundo e se dissolve na cor do template logo acima da barra, então o título
 * sempre fica sobre fundo sólido.
 */
export function ModeloEditorial({ slide, template, index, total, imagemCapa }: ModeloProps) {
  const capa = ehCapa(slide, index);
  const tam = tamanhos(slide, capa);
  const acento = template.cor_destaque;
  const fundo = template.cor_fundo;
  const estiloDestaque = { color: acento, fontWeight: 700 };
  const fio = { height: 2, background: template.cor_texto, opacity: 0.25 };
  const comImagem = capa && Boolean(imagemCapa);

  const cabecalho = (
    <div style={{ position: "relative", zIndex: 2 }}>
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
  );

  const texto = (
    <>
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
    </>
  );

  const rodape = (
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
  );

  const raiz = {
    position: "relative" as const,
    width: "100%",
    height: "100%",
    display: "flex",
    flexDirection: "column" as const,
    padding: `88px ${PADDING_X}px ${PADDING_BAIXO}px`,
    boxSizing: "border-box" as const,
  };

  if (comImagem && imagemCapa) {
    return (
      <div style={raiz}>
        <div style={{ position: "absolute", inset: 0, zIndex: 0 }}>
          <ImagemDaCapa imagem={imagemCapa} />
        </div>
        {/* Véu no alto: o nome e o arroba continuam legíveis sobre qualquer foto. */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 300,
            zIndex: 1,
            background: `linear-gradient(to bottom, ${hexComAlfa(fundo, 0.86)} 0%, ${hexComAlfa(fundo, 0.6)} 45%, ${hexComAlfa(fundo, 0)} 100%)`,
          }}
        />
        {cabecalho}
        <div style={{ flex: 1 }} />
        {/*
         * O bloco do título tem fundo sólido até as bordas, e o degradê sai do
         * topo dele: a foto some antes da barra com qualquer tamanho de título.
         */}
        <div
          style={{
            position: "relative",
            zIndex: 2,
            margin: `0 -${PADDING_X}px -${PADDING_BAIXO}px`,
            padding: `0 ${PADDING_X}px ${PADDING_BAIXO}px`,
            background: fundo,
          }}
        >
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              // Sobrepõe 2px ao bloco: em escala reduzida, o arredondamento abria uma fresta.
              bottom: "calc(100% - 2px)",
              height: 380,
              background: `linear-gradient(to top, ${fundo} 0%, ${fundo} 10%, ${hexComAlfa(fundo, 0.88)} 32%, ${hexComAlfa(fundo, 0.45)} 64%, ${hexComAlfa(fundo, 0)} 100%)`,
            }}
          />
          <div style={{ paddingBottom: 64 }}>{texto}</div>
          {rodape}
        </div>
      </div>
    );
  }

  return (
    <div style={raiz}>
      {cabecalho}
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
        {texto}
      </div>
      {rodape}
    </div>
  );
}
