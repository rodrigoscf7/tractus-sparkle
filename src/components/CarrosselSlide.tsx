import { forwardRef, type ComponentType } from "react";
import { familiaCss } from "@/lib/carrossel-fontes";
import type {
  CarrosselSlideData,
  ModeloCarrosselId,
  TemplateCarrossel,
} from "@/lib/carrossel-template";
import { HEIGHT, WIDTH, type ModeloProps } from "@/components/carrossel/comum";
import { ModeloTweet } from "@/components/carrossel/ModeloTweet";
import { ModeloEditorial } from "@/components/carrossel/ModeloEditorial";
import { ModeloMarcaTexto } from "@/components/carrossel/ModeloMarcaTexto";

const MODELOS: Record<ModeloCarrosselId, ComponentType<ModeloProps>> = {
  tweet: ModeloTweet,
  editorial: ModeloEditorial,
  "marca-texto": ModeloMarcaTexto,
};

type Props = {
  slide: CarrosselSlideData;
  template: TemplateCarrossel;
  fotoDataUrl: string;
  index: number;
  total: number;
  scale?: number;
};

/**
 * Slide 1080×1350 (4:5) no modelo do template. O `ref` aponta para o slide em
 * tamanho real, que é o nó exportado como PNG; `scale` só afeta a prévia.
 */
export const CarrosselSlide = forwardRef<HTMLDivElement, Props>(function CarrosselSlide(
  { slide, template, fotoDataUrl, index, total, scale = 1 },
  ref,
) {
  const Modelo = MODELOS[template.modelo] ?? ModeloTweet;

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
          fontFamily: familiaCss(template.fonte_texto),
          overflow: "hidden",
          boxSizing: "border-box",
        }}
      >
        <Modelo
          slide={slide}
          template={template}
          fotoDataUrl={fotoDataUrl}
          index={index}
          total={total}
        />
      </div>
    </div>
  );
});
