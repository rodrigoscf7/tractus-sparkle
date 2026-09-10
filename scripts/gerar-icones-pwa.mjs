// Gera os ícones do manifest a partir de src/assets/pwa/icon-source.png.
// Roda uma vez (ou sempre que o ícone-fonte mudar) — não faz parte do build.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const origem = path.resolve(__dirname, "../src/assets/pwa/icon-source.png");
const destino = path.resolve(__dirname, "../public");

const tamanhos = [
  { nome: "icon-192.png", tamanho: 192 },
  { nome: "icon-512.png", tamanho: 512 },
];

for (const { nome, tamanho } of tamanhos) {
  await sharp(origem).resize(tamanho, tamanho).png().toFile(path.join(destino, nome));
  console.log(`Gerado ${nome}`);
}

// Maskable: 80% de área segura no centro (o SO pode recortar em círculo/squircle),
// preenchendo a margem com o mesmo amarelo do ícone-fonte.
await sharp(origem)
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: "#F4DB0B" })
  .png()
  .toFile(path.join(destino, "icon-maskable-512.png"));
console.log("Gerado icon-maskable-512.png");
