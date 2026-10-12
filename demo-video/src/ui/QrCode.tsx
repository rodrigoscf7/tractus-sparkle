import type React from "react";
import QRCode from "qrcode";

/** QR code em SVG, desenhado quadrado a quadrado (nítido em qualquer escala). */
export const QrCode: React.FC<{
  texto: string;
  tamanho: number;
  cor?: string;
}> = ({ texto, tamanho, cor = "#0D0D0F" }) => {
  const { modules } = QRCode.create(texto, { errorCorrectionLevel: "M" });
  const n = modules.size;
  const margem = 2;
  const lado = n + margem * 2;
  const quadrados: string[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (modules.get(y, x))
        quadrados.push(`M${x + margem} ${y + margem}h1v1h-1z`);
    }
  }
  return (
    <svg
      width={tamanho}
      height={tamanho}
      viewBox={`0 0 ${lado} ${lado}`}
      shapeRendering="crispEdges"
      style={{ display: "block" }}
    >
      <rect width={lado} height={lado} fill="#FFFFFF" />
      <path d={quadrados.join("")} fill={cor} />
    </svg>
  );
};
