// Gera os efeitos sonoros com o ElevenLabs (text-to-sound) em public/sfx/<nome>.mp3.
// A ideia é que quase não se perceba: sons curtos, macios, sem grave pesado,
// que só marcam o ritmo (toque, troca de cena, notificação, confirmação).
//
// Uso (precisa de ELEVENLABS_API_KEY no .env):
//   npm run sfx                  gera os que faltam
//   npm run sfx -- --forcar      gera todos de novo
//   npm run sfx -- --so toque    só esse (gere de novo o que não agradar)

import { existsSync, mkdirSync, writeFileSync } from "node:fs";

const CHAVE = process.env.ELEVENLABS_API_KEY;
if (!CHAVE) {
  console.error("Falta ELEVENLABS_API_KEY no .env.");
  process.exit(1);
}

const ESTILO =
  "minimal, soft, clean, elegant, modern premium app interface sound, no music, no reverb tail, no bass boom";

const SONS: Record<string, { texto: string; segundos: number }> = {
  toque: {
    texto: `a single very soft muted tap on a glass smartphone screen, ${ESTILO}`,
    segundos: 0.5,
  },
  transicao: {
    texto: `a very subtle airy whoosh, gentle soft swipe of air between two scenes, ${ESTILO}`,
    segundos: 0.8,
  },
  notificacao: {
    texto: `a gentle smartphone notification chime, two soft warm glassy tones, ${ESTILO}`,
    segundos: 1.2,
  },
  digitacao: {
    texto: `a few quiet light taps typing on a smartphone glass keyboard, ${ESTILO}`,
    segundos: 1.0,
  },
  confirmacao: {
    texto: `a soft satisfying confirmation tone, one warm rounded marimba note, ${ESTILO}`,
    segundos: 0.8,
  },
  marca: {
    texto: `a soft elegant shimmer swell, light airy sparkle rising gently, for a logo reveal, ${ESTILO}`,
    segundos: 1.6,
  },
  cartas: {
    texto: `soft quick swoosh of paper cards fanned out on a table, ${ESTILO}`,
    segundos: 0.9,
  },
  pop: {
    texto: `one short clear soft bubble pop, close and present, ${ESTILO}`,
    segundos: 0.5,
  },
};

const args = process.argv.slice(2);
const so = args.includes("--so") ? args[args.indexOf("--so") + 1] : undefined;
const forcar = args.includes("--forcar");
mkdirSync("public/sfx", { recursive: true });

for (const [nome, som] of Object.entries(SONS)) {
  const arquivo = `public/sfx/${nome}.mp3`;
  if (so ? nome !== so : !forcar && existsSync(arquivo)) continue;
  const res = await fetch(
    "https://api.elevenlabs.io/v1/sound-generation?output_format=mp3_44100_128",
    {
      method: "POST",
      headers: { "xi-api-key": CHAVE, "Content-Type": "application/json" },
      body: JSON.stringify({
        text: som.texto,
        duration_seconds: som.segundos,
        prompt_influence: 0.6,
      }),
    },
  );
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  writeFileSync(arquivo, Buffer.from(await res.arrayBuffer()));
  console.log(arquivo);
}
