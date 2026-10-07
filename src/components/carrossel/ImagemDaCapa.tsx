import type { CSSProperties } from "react";
import type { ImagemCapa } from "@/lib/carrossel-template";

/** A imagem da capa ocupando o espaço do pai, com o enquadramento escolhido. */
export function ImagemDaCapa({ imagem, style }: { imagem: ImagemCapa; style?: CSSProperties }) {
  return (
    <img
      src={imagem.dataUrl}
      alt=""
      style={{
        width: "100%",
        height: "100%",
        objectFit: "cover",
        objectPosition: `50% ${imagem.foco}%`,
        display: "block",
        ...style,
      }}
    />
  );
}
