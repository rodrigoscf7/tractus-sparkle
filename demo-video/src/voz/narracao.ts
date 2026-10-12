// As falas posicionadas no tempo de cada cena, a partir de textos.ts e das
// marcas de tempo da tomada de cada cena (tempos.json, escrito por gerar-voz.mts).
//
// Cada fala é um trecho do MP3 da cena, do seu começo até o começo da próxima:
// a pausa natural entre as frases vai junto. Se a animação pede a próxima fala
// mais tarde, sobra um silêncio a mais; se não, as falas se emendam como na
// tomada original.

import tempos from "./tempos.json";
import { NARRACAO, type FalaRoteiro } from "./textos";

export type IdCena = keyof typeof NARRACAO;

type TemposDaCena = { falas: Record<string, { inicio: number; fim: number }> };
const TEMPOS = tempos as Partial<Record<string, TemposDaCena>>;
const FPS = 30;
/** Corte um pouco antes da próxima fala, para não comer o ataque da primeira sílaba. */
const FOLGA_CORTE = 0.04;
/** Quanto a última fala da cena segue depois da última letra (o fim natural da voz). */
const CAUDA_FALA = 0.3;

export type FalaNaCena = FalaRoteiro & {
  readonly duracao: number;
  /** O trecho do MP3 da cena, em frames; ausente enquanto a voz não foi gerada. */
  readonly audio?: {
    readonly src: string;
    readonly trimBefore: number;
    readonly trimAfter: number;
  };
};

/** Trechos de cada fala na tomada, em segundos. */
function trechos(cena: IdCena, falas: FalaRoteiro[]) {
  const t = TEMPOS[cena]?.falas;
  if (!t || falas.some((f) => !t[f.id])) return null;
  return falas.map((f, i) => {
    const proxima = falas[i + 1];
    const inicio = Math.max(0, t[f.id].inicio - FOLGA_CORTE);
    const fim = proxima
      ? t[proxima.id].inicio - FOLGA_CORTE
      : t[f.id].fim + CAUDA_FALA;
    return { inicio, fim };
  });
}

/** As falas da cena com o frame de entrada já ajustado ao áudio. */
export function falasDaCena(cena: IdCena): FalaNaCena[] {
  const falas = NARRACAO[cena] as FalaRoteiro[];
  const partes = trechos(cena, falas);
  let livreEm = 0;
  return falas.map((f, i) => {
    const de = Math.max(f.de, livreEm);
    const parte = partes?.[i];
    const trimBefore = parte ? Math.round(parte.inicio * FPS) : 0;
    const trimAfter = parte ? Math.round(parte.fim * FPS) : 0;
    // Sem voz ainda: estimativa pelo número de palavras.
    const duracao = parte
      ? trimAfter - trimBefore
      : Math.ceil(
          (0.35 + (f.fala ?? f.texto).split(/\s+/).length * 0.33) * FPS,
        );
    livreEm = de + duracao;
    return {
      ...f,
      de,
      duracao,
      audio: parte
        ? { src: `voz/${cena}.mp3`, trimBefore, trimAfter }
        : undefined,
    };
  });
}

/**
 * Duração mínima da cena: a última fala termina e ainda sobra `cauda` frames.
 * A cena usa o maior entre isso e o tempo que a animação pede.
 */
export function duracaoDaCena(cena: IdCena, minimo: number, cauda = 20) {
  const falas = falasDaCena(cena);
  const ultima = falas[falas.length - 1];
  return Math.max(minimo, ultima.de + ultima.duracao + cauda);
}
