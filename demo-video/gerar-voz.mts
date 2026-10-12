// Gera a narração com o ElevenLabs. Cada cena é gravada numa tomada só, para a
// entonação correr entre as frases: public/voz/<cena>.mp3. As marcas de tempo
// da resposta dizem onde cada fala começa e termina; vão para
// src/voz/tempos.json, e o vídeo recorta e posiciona cada fala a partir delas.
//
// A voz escolhida é o Paulo (biblioteca do ElevenLabs) no modelo v3; os dois
// são o padrão. --voz e --modelo trocam.
//
// Uso (precisa de ELEVENLABS_API_KEY no .env; a biblioteca exige plano pago):
//   npm run voz                                   gera as cenas que faltam
//   npm run voz -- --forcar                       gera tudo de novo
//   npm run voz -- --cenas plano,roteiro          só essas cenas (o v3 varia: refaça a que soar mal)
//   npm run voz -- --amostra A --cenas gancho,configuracao
//                                                 um MP3 de teste em out/, sem mexer no vídeo
//   npm run voz -- --voz <voice_id> --modelo v2   outra voz ou o modelo anterior
//   npm run voz -- --vozes                        lista vozes femininas em pt-BR

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { NARRACAO, type FalaRoteiro } from "./src/voz/textos.ts";

const API = "https://api.elevenlabs.io/v1";
const CHAVE = process.env.ELEVENLABS_API_KEY;
const ARQUIVO_TEMPOS = "src/voz/tempos.json";
const VOZ_PADRAO = "Qrdut83w0Cr152Yb4Xn3"; // Paulo - Expressive and Confident

const MODELOS = {
  // Mais expressiva que o padrão (style alto, stability mais baixa). O speed
  // deixa o locutor menos arrastado.
  v2: {
    model_id: "eleven_multilingual_v2",
    voice_settings: {
      stability: 0.38,
      similarity_boost: 0.75,
      style: 0.45,
      use_speaker_boost: true,
      speed: 1.1,
    },
  },
  // O v3 lê as etiquetas de emoção entre colchetes ([warmly], [sighs]...).
  v3: { model_id: "eleven_v3", voice_settings: { stability: 0.5 } },
} as const;

if (!CHAVE) {
  console.error("Falta ELEVENLABS_API_KEY no .env (a chave começa com sk_).");
  process.exit(1);
}

const args = process.argv.slice(2);
const valor = (nome: string) => {
  const i = args.indexOf(nome);
  return i >= 0 ? args[i + 1] : undefined;
};
const modelo = (valor("--modelo") ?? "v3") as keyof typeof MODELOS;
if (!MODELOS[modelo])
  throw new Error(`Modelo desconhecido: ${modelo} (use v2 ou v3)`);

async function chamar(caminho: string, init?: RequestInit) {
  const res = await fetch(`${API}${caminho}`, {
    ...init,
    headers: {
      "xi-api-key": CHAVE!,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) throw new Error(`ElevenLabs ${res.status}: ${await res.text()}`);
  return res.json();
}

type Alinhamento = {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
};

const falar = (f: FalaRoteiro) => f.fala ?? f.texto;
const comTom = (f: FalaRoteiro) =>
  modelo === "v3" && f.tom ? `[${f.tom}] ${falar(f)}` : falar(f);

async function sintetizar(voz: string, texto: string) {
  const r = (await chamar(
    `/text-to-speech/${voz}/with-timestamps?output_format=mp3_44100_128`,
    {
      method: "POST",
      body: JSON.stringify({ text: texto, ...MODELOS[modelo] }),
    },
  )) as { audio_base64: string; alignment: Alinhamento };
  return {
    audio: Buffer.from(r.audio_base64, "base64"),
    alinhamento: r.alignment,
  };
}

const letra = /[\p{L}\p{N}]/u;
const seg = (n: number) => Math.round(n * 100) / 100;

/**
 * Onde cada fala começa e termina dentro da tomada. Procura o texto falado nos
 * caracteres alinhados (as etiquetas do v3 podem ou não aparecer ali).
 */
function marcarFalas(falas: FalaRoteiro[], a: Alinhamento) {
  const corrido = a.characters.join("").toLowerCase();
  let cursor = 0;
  const tempos: Record<string, { inicio: number; fim: number }> = {};
  for (const f of falas) {
    const alvo = falar(f).toLowerCase();
    let i = corrido.indexOf(alvo, cursor);
    if (i < 0) i = corrido.indexOf(alvo.slice(0, 12), cursor);
    if (i < 0)
      throw new Error(`Não achei a fala ${f.id} no alinhamento: "${falar(f)}"`);
    let fimIdx = Math.min(i + alvo.length - 1, a.characters.length - 1);
    while (fimIdx > i && !letra.test(a.characters[fimIdx])) fimIdx--;
    tempos[f.id] = {
      inicio: seg(a.character_start_times_seconds[i]),
      fim: seg(a.character_end_times_seconds[fimIdx] + 0.06),
    };
    cursor = i + alvo.length;
  }
  return tempos;
}

async function listarVozes() {
  const r = (await chamar(
    "/shared-voices?page_size=20&language=pt&gender=female&sort=usage_character_count_1y",
  )) as {
    voices: {
      voice_id: string;
      name: string;
      accent?: string;
      age?: string;
      use_case?: string;
    }[];
  };
  for (const v of r.voices)
    console.log(
      `${v.voice_id}  ${v.name}  [${v.accent ?? "?"} · ${v.age ?? "?"} · ${v.use_case ?? "?"}]`,
    );
}

const cenasPedidas = () => {
  const lista = valor("--cenas")
    ?.split(",")
    .map((c) => c.trim());
  const todas = Object.keys(NARRACAO) as (keyof typeof NARRACAO)[];
  return lista ? todas.filter((c) => lista.includes(c)) : todas;
};

/** Um MP3 de teste com as cenas pedidas, numa tomada só. Não mexe no vídeo. */
async function amostra(voz: string, nome: string) {
  mkdirSync("out", { recursive: true });
  const falas = cenasPedidas().flatMap((c) => NARRACAO[c] as FalaRoteiro[]);
  const { audio } = await sintetizar(voz, falas.map(comTom).join(" "));
  const arquivo = `out/amostra-${nome}-${modelo}.mp3`;
  writeFileSync(arquivo, audio);
  console.log(arquivo);
}

async function gerar(voz: string) {
  const forcar = args.includes("--forcar");
  const tempos: Record<string, unknown> = existsSync(ARQUIVO_TEMPOS)
    ? JSON.parse(readFileSync(ARQUIVO_TEMPOS, "utf8"))
    : {};
  mkdirSync("public/voz", { recursive: true });

  for (const cena of cenasPedidas()) {
    const arquivo = `public/voz/${cena}.mp3`;
    if (!forcar && !valor("--cenas") && existsSync(arquivo) && tempos[cena])
      continue;
    const falas = NARRACAO[cena] as FalaRoteiro[];
    const { audio, alinhamento } = await sintetizar(
      voz,
      falas.map(comTom).join(" "),
    );
    writeFileSync(arquivo, audio);
    tempos[cena] = { modelo, falas: marcarFalas(falas, alinhamento) };
    writeFileSync(ARQUIVO_TEMPOS, JSON.stringify(tempos, null, 2) + "\n");
    const resumo = Object.entries(
      (
        tempos[cena] as {
          falas: Record<string, { inicio: number; fim: number }>;
        }
      ).falas,
    )
      .map(([id, t]) => `${id} ${t.inicio}–${t.fim}s`)
      .join(" · ");
    console.log(`${cena}: ${resumo}`);
  }
}

const voz = valor("--voz") ?? VOZ_PADRAO;
if (args.includes("--vozes")) await listarVozes();
else if (valor("--amostra")) await amostra(voz, valor("--amostra")!);
else await gerar(voz);
