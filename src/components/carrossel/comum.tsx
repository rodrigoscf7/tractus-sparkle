import type { CSSProperties } from "react";
import type { CarrosselSlideData, TemplateCarrossel } from "@/lib/carrossel-template";

export const WIDTH = 1080;
export const HEIGHT = 1350;

/** O que todo modelo recebe. O slide já vem no tamanho real (1080×1350); a escala é do CarrosselSlide. */
export type ModeloProps = {
  slide: CarrosselSlideData;
  template: TemplateCarrossel;
  fotoDataUrl: string;
  index: number;
  total: number;
};

export function ehCapa(slide: CarrosselSlideData, index: number) {
  return index === 0 || slide.tipo === "capa" || slide.tipo === "hook";
}

/** Quebra o texto em partes, aplicando `estilo` ao trecho de destaque. */
export function renderTexto(texto: string, destaque: string | undefined, estilo: CSSProperties) {
  const d = (destaque ?? "").trim();
  if (!d) return <>{texto}</>;
  const idx = texto.toLowerCase().indexOf(d.toLowerCase());
  if (idx < 0) return <>{texto}</>;
  return (
    <>
      {texto.slice(0, idx)}
      <span style={estilo}>{texto.slice(idx, idx + d.length)}</span>
      {texto.slice(idx + d.length)}
    </>
  );
}

/**
 * Tamanhos em px no slide de 1080 de largura. O título cresce quando está
 * sozinho (capa ou slide de respiro) e encolhe quando divide espaço com o corpo.
 */
export function tamanhos(slide: CarrosselSlideData, capa: boolean) {
  const t = slide.titulo?.length ?? 0;
  const c = slide.corpo?.length ?? 0;
  if (!slide.corpo) {
    const titulo = capa ? (t < 45 ? 104 : t < 80 ? 88 : 74) : t < 50 ? 92 : t < 90 ? 76 : 64;
    return { titulo, corpo: 0 };
  }
  if (!slide.titulo) {
    return { titulo: 0, corpo: c < 70 ? 80 : c < 130 ? 64 : c < 190 ? 54 : 46 };
  }
  return {
    titulo: capa ? (t < 45 ? 96 : t < 80 ? 80 : 68) : t < 40 ? 68 : t < 70 ? 60 : 52,
    corpo: capa ? 42 : c < 120 ? 46 : c < 200 ? 40 : 36,
  };
}

/** Preto ou branco, o que ler melhor sobre `hex` (luminância relativa do WCAG). */
export function corLegivelSobre(hex: string) {
  const m = hex.replace("#", "").match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return "#0F172A";
  const [r, g, b] = m.slice(1).map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  // Ponto em que o contraste com preto e com branco se igualam.
  return lum > 0.179 ? "#0F172A" : "#FFFFFF";
}

export function doisDigitos(n: number) {
  return String(n).padStart(2, "0");
}
