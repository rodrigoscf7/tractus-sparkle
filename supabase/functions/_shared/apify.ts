// Chamadas ao Apify compartilhadas entre os agentes de coleta.

/** Tentativas por chamada: cobre o 402 de limite de execuções simultâneas da conta. */
const TENTATIVAS = 4;

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Roda um actor do Apify e espera o resultado.
 *
 * 5xx/429 e o 402 de limite de execuções simultâneas são transitórios: espera e
 * tenta de novo. Os demais 4xx (handle inválido, perfil privado) não melhoram
 * com repetição. Timeout lança AbortError.
 */
export async function apifyRunSync(
  token: string,
  actor: string,
  input: Record<string, unknown>,
  timeoutMs: number,
): Promise<Response> {
  const rodar = async () => {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(
        `https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?token=${token}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
          signal: ctrl.signal,
        },
      );
    } finally {
      clearTimeout(t);
    }
  };

  let res = await rodar();
  for (let tentativa = 1; !res.ok && tentativa < TENTATIVAS; tentativa++) {
    const limiteSimultaneas = res.status === 402 &&
      (await res.clone().text().catch(() => "")).includes("concurrent-runs-limit");
    if (!limiteSimultaneas && res.status < 500 && res.status !== 429) break;
    // Jitter evita que as chamadas barradas voltem todas no mesmo instante.
    await dormir(limiteSimultaneas ? 15_000 + Math.random() * 10_000 : 4_000);
    res = await rodar();
  }
  return res;
}

export async function resumoErroApify(res: Response, rotulo: string): Promise<string> {
  const body = (await res.text().catch(() => "")).slice(0, 300);
  console.error("Apify failed", rotulo, res.status, body);
  return `apify ${res.status}${body ? `: ${body}` : ""}`;
}

export type PostInstagram = Record<string, unknown>;

/**
 * Últimos posts de um perfil. Perfil inexistente/privado volta uma linha de erro
 * (`error: "no_items"`) em vez de posts: ela é descartada e, se nada sobrar, lança.
 */
export async function postsDoPerfil(
  token: string,
  handle: string,
  limite: number,
  timeoutMs: number,
): Promise<PostInstagram[]> {
  let res: Response;
  try {
    res = await apifyRunSync(token, "apify~instagram-scraper", {
      directUrls: [`https://www.instagram.com/${handle}/`],
      resultsType: "posts",
      resultsLimit: limite,
    }, timeoutMs);
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") {
      throw new Error(`timeout apify após ${timeoutMs / 1000}s`);
    }
    throw e;
  }
  if (!res.ok) throw new Error(await resumoErroApify(res, handle));

  const brutos = await res.json();
  const posts = (Array.isArray(brutos) ? brutos : [])
    .filter((p) => p && typeof p === "object" && !p.error && !p.errorDescription);
  if (!posts.length) {
    throw new Error("sem posts: handle inexistente, perfil privado ou sem publicações");
  }
  return posts as PostInstagram[];
}
