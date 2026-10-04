// Download de imagens e vídeos de posts do Instagram para envio ao modelo.
//
// As URLs da CDN do Instagram são assinadas e expiram em poucas horas: a mídia é
// baixada aqui e enviada em data URL, em vez de o provedor do modelo buscá-la
// depois e receber 403.
import { encodeBase64 } from "jsr:@std/encoding@1/base64";

/**
 * Codifica direto dos bytes. A versão anterior montava uma string binária
 * intermediária e estourava a memória do worker com vídeos de dezenas de MB.
 */
export function base64DeBytes(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}

export function shortcodeDe(valor: unknown): string | null {
  const m = String(valor ?? "").match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * Baixa a mídia e devolve `data:<tipo>;base64,...`. Uma nova tentativa em caso
 * de falha de rede; tipo fora do prefixo esperado ou acima do teto lança.
 */
export async function baixarMidia(
  url: string,
  opts: { prefixo: "image/" | "video/"; maxBytes: number; timeoutMs: number },
): Promise<string> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`mídia HTTP ${res.status}`);
      const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!tipo.startsWith(opts.prefixo)) {
        throw new Error(`esperava ${opts.prefixo}*, veio ${tipo || "?"}`);
      }
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > opts.maxBytes) {
        throw new Error(`mídia com ${Math.round(bytes.byteLength / 1e6)}MB acima do teto`);
      }
      return `data:${tipo};base64,${base64DeBytes(bytes)}`;
    } catch (e) {
      ultimoErro = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}
