/** Lado maior da imagem guardada. A capa tem 1080px de largura: 1600 sobra para o enquadramento. */
const LADO_MAXIMO = 1600;
const QUALIDADE_JPEG = 0.85;

/**
 * Reduz a foto no navegador antes de subir: uma foto de celular tem 4–8 MB e
 * o slide usa no máximo 1080px. Sai um JPEG de ~200–400 KB, que também deixa a
 * exportação dos slides leve. A orientação EXIF é aplicada (foto de celular
 * em pé não sai deitada).
 */
export async function prepararImagem(arquivo: File): Promise<Blob> {
  if (!arquivo.type.startsWith("image/")) {
    throw new Error("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
  }

  let origem: ImageBitmap;
  try {
    origem = await createImageBitmap(arquivo, { imageOrientation: "from-image" });
  } catch {
    throw new Error(
      "Não consegui abrir essa imagem. Se for do iPhone (HEIC), tente exportar como JPG.",
    );
  }

  const escala = Math.min(1, LADO_MAXIMO / Math.max(origem.width, origem.height));
  const largura = Math.round(origem.width * escala);
  const altura = Math.round(origem.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("O navegador não conseguiu preparar a imagem.");
  // PNG com transparência vira JPEG: o fundo branco evita áreas pretas.
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, largura, altura);
  ctx.drawImage(origem, 0, 0, largura, altura);
  origem.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALIDADE_JPEG),
  );
  if (!blob) throw new Error("O navegador não conseguiu preparar a imagem.");
  return blob;
}
