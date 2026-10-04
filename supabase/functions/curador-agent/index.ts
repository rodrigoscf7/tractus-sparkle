// Curador (fan-out):
// - Modo orquestrador (sem ref_id): chamado 1x/dia via pg_cron. Lê todos os
//   perfis_referencia ativos e dispara 1 invocação por ref (fire-and-forget)
//   via fetch para esta mesma function com ?ref_id=...
// - Modo worker (com ref_id): processa apenas 1 ref — busca via Apify, scoreia
//   com Claude e insere em conteudos_curados. O ideador roda em cron separado
//   depois da curadoria para evitar estouro de limite por paralelismo.
import {
  alertarAdminFalha,
  callModelo,
  corsHeaders,
  extractJson,
  formatAgentError,
  getServiceClient,
  limiteDisponivel,
  registrarCustoScraping,
  requireAgentAuth,
  setCustoContexto,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você é o agente de curadoria de conteúdo da Tractus.
Sua função é analisar um post/reel de um perfil de referência e decidir se ele
tem potencial para inspirar conteúdo do perfil: {{perfil_nome}} ({{perfil_tipo}}).
Diretrizes do perfil (apenas para contexto de tema/nicho — NÃO exija tom já alinhado): {{perfil_diretrizes}}

Sua tarefa é IDENTIFICAR POTENCIAL, não filtrar por tom ou profundidade.
Os agentes seguintes (ideador e copy) vão adaptar tom, profundidade e contexto
ao perfil. Você só precisa dizer se o TEMA/GANCHO/TRAÇÃO justifica entrar no funil.

Foco estratégico desta busca: {{foco}}
{{rubrica_foco}}


Retorne APENAS um JSON, sem markdown:
{ "score_curadoria": 0-10, "tema": "string", "gancho_identificado": "string",
  "motivo_score": "string", "aproveitavel": true/false, "fala_util": true/false }

"aproveitavel" deve ser true sempre que score_curadoria >= 5.
Você recebe a legenda, o texto escrito nas imagens/slides e a fala transcrita do vídeo:
julgue pelo conteúdo todo, não só pela legenda.
"fala_util" é false quando a transcrição for letra de música, trilha ou áudio sem fala
própria da pessoa (nesse caso ignore-a na nota); true quando for fala real ou não houver transcrição.
Não descarte por "clichê" ou "raso" se o engajamento for alto — vira insumo mesmo assim.`;

const RUBRICA_VIRAL = `Rubrica de score (0-10) — foco VIRAL (modelar o que já performou):
- 9-10: tração muito acima da média do perfil e gancho replicável no nicho
- 7-8: boa tração com ângulo aproveitável
- 5-6: tração razoável e tema pertinente ao nicho
- 0-4: sem tração relevante ou fora do nicho
Peso maior em visualizações, curtidas e comentários — potencial de alcance.`;

const RUBRICA_POSICIONAMENTO =
  `Rubrica de score (0-10) — foco POSICIONAMENTO (assunto atual e tese defensável):
- 9-10: assunto muito atual no nicho, com tese clara de posicionamento a defender
- 7-8: tema pertinente e atual, bom ângulo de opinião
- 5-6: tema do nicho aproveitável, mesmo sem grande novidade
- 0-4: fora do nicho ou sem ângulo de opinião possível
IGNORE visualizações e engajamento no julgamento: post com pouca tração pode ter score alto.`;

/** 60s abortava a coleta do onboarding (AbortError); o scraper leva ~40s com a fila vazia. */
const APIFY_TIMEOUT_MS = 100_000;
/**
 * A conta do Apify aceita 5 execuções simultâneas. O orquestrador usa 4 e deixa
 * uma de folga para a coleta disparada pelo onboarding.
 */
const APIFY_CONCORRENCIA = 4;
const APIFY_TENTATIVAS = 4;
const TRANSCRIPT_TIMEOUT_MS = 150_000;
/** Visão: modelo barato basta para OCR; sobrescreva com o secret OPENROUTER_MODEL_VISAO. */
const VISAO_MODEL = Deno.env.get("OPENROUTER_MODEL_VISAO") ?? "anthropic/claude-haiku-4.5";
const VISAO_MAX_SLIDES = 12;
const VISAO_MAX_TOKENS = 3000;
const VISAO_TIMEOUT_MS = 60_000;
const IMAGEM_TIMEOUT_MS = 15_000;
const IMAGEM_MAX_BYTES = 5 * 1024 * 1024;
const CLAUDE_TIMEOUT_MS = 30_000;
const APIFY_RESULTS_LIMIT = 12;
const MAX_NEW_POSTS_TO_SCORE = 5;
/** Quantos itens gravar por ref/ciclo (sempre o de maior score). */
const TOP_SAVE_PER_REF = 1;
/** JSON de score (tema + gancho + motivo); 220 truncava; 500 e 800 ainda estouravam em alguns posts. */
const SCORE_MAX_TOKENS = 1200;
const TRANSCRIPT_ACTOR =
  "scraping_solutions~instagram-reels-transcript-scraper-audio-to-text";

type Foco = "viral" | "posicionamento";

type ScoreParsed = {
  score_curadoria: number;
  tema: string;
  gancho_identificado: string;
  motivo_score: string;
  aproveitavel: boolean;
  /** false quando a "fala" transcrita é letra de música ou áudio sem fala própria. */
  fala_util?: boolean;
};

type Candidato = {
  post: Record<string, unknown>;
  parsed: ScoreParsed;
  textoRico: string;
  transcript: string | null;
};

function normalizeFoco(v: unknown): Foco {
  return String(v ?? "").toLowerCase() === "viral" ? "viral" : "posicionamento";
}

function engajamento(post: Record<string, unknown>): number {
  const views = Number(post["videoPlayCount"] ?? 0) || 0;
  const likes = Number(post["likesCount"] ?? 0) || 0;
  const comentarios = Number(post["commentsCount"] ?? 0) || 0;
  return views + likes * 3 + comentarios * 10;
}

function postTime(post: Record<string, unknown>): number {
  const ts = post["timestamp"] ?? post["taken_at_timestamp"];
  if (typeof ts === "number") return ts * 1000;
  const parsed = Date.parse(String(ts ?? ""));
  return Number.isNaN(parsed) ? 0 : parsed;
}

function ordenarPorFoco(posts: Record<string, unknown>[], foco: Foco) {
  return [...posts].sort((a, b) =>
    foco === "viral" ? engajamento(b) - engajamento(a) : postTime(b) - postTime(a)
  );
}

/** Alt automático do Instagram ("Photo by X on …"): não diz nada sobre o conteúdo. */
const ALT_GENERICO = /^(photo|video|reel) by /i;

function altUtil(valor: unknown): string {
  const alt = String(valor ?? "").trim();
  return alt && !ALT_GENERICO.test(alt) ? alt : "";
}

/**
 * Legenda + alt útil + texto lido das imagens.
 *
 * `textoNasImagens` vem da visão: um item por slide (carrossel/imagem) ou
 * a capa (reel). Fica rotulado para o ideador saber de onde veio cada trecho.
 */
function textoRicoDoPost(
  post: Record<string, unknown>,
  textoNasImagens: string[] = [],
): string {
  const parts: string[] = [];
  const caption = String(post.caption ?? "").trim();
  if (caption) parts.push(`Legenda:\n${caption}`);
  const alt = altUtil(post.alt);
  if (alt) parts.push(`Alt:\n${alt}`);

  const children = Array.isArray(post.childPosts) ? post.childPosts : [];
  children.forEach((raw, i) => {
    const child = (raw ?? {}) as Record<string, unknown>;
    const cCap = String(child.caption ?? "").trim();
    const cAlt = altUtil(child.alt);
    if (!cCap && !cAlt) return;
    parts.push(
      [`Slide ${i + 1}:`, cCap || null, cAlt ? `Alt: ${cAlt}` : null].filter(Boolean).join("\n"),
    );
  });

  const textos = textoNasImagens.map((t) => t.trim());
  if (textos.some(Boolean)) {
    if (isReel(post)) {
      parts.push(`Texto na capa do vídeo:\n${textos.find(Boolean)}`);
    } else {
      parts.push(
        "Texto nas imagens:\n" +
          textos.map((t, i) => `Slide ${i + 1}: ${t || "(sem texto)"}`).join("\n"),
      );
    }
  }
  return parts.join("\n\n");
}

function isReel(post: Record<string, unknown>): boolean {
  const url = String(post.url ?? "").toLowerCase();
  const type = String(post.type ?? "").toLowerCase();
  const product = String(post.productType ?? "").toLowerCase();
  return (
    url.includes("/reel/") ||
    product.includes("reel") ||
    product === "clips" ||
    (type === "video" && url.includes("/reel/"))
  );
}

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`timeout ${label} após ${ms}ms`)), ms),
    ),
  ]);
}

const dormir = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Roda um actor do Apify e espera o resultado.
 *
 * 5xx/429 e o 402 de limite de execuções simultâneas são transitórios: espera e
 * tenta de novo. Os demais 4xx (handle inválido, perfil privado) não melhoram
 * com repetição. Timeout lança AbortError.
 */
async function apifyRunSync(
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
  for (let tentativa = 1; !res.ok && tentativa < APIFY_TENTATIVAS; tentativa++) {
    const limiteSimultaneas = res.status === 402 &&
      (await res.clone().text().catch(() => "")).includes("concurrent-runs-limit");
    if (!limiteSimultaneas && res.status < 500 && res.status !== 429) break;
    // Jitter evita que os workers barrados voltem todos no mesmo instante.
    await dormir(limiteSimultaneas ? 15_000 + Math.random() * 10_000 : 4_000);
    res = await rodar();
  }
  return res;
}

async function resumoErroApify(res: Response, rotulo: string): Promise<string> {
  const body = (await res.text().catch(() => "")).slice(0, 300);
  console.error("Apify failed", rotulo, res.status, body);
  // 402 costuma ser limite mensal / hard cap — não necessariamente "saldo zerado" na UI.
  return `apify ${res.status}${body ? `: ${body}` : ""}`;
}

// ---------------------------------------------------------------------------
// Fala dos reels (transcrição)
// ---------------------------------------------------------------------------

function shortcodeDe(valor: unknown): string | null {
  const m = String(valor ?? "").match(/\/(?:reels?|p|tv)\/([A-Za-z0-9_-]+)/);
  return m ? m[1] : null;
}

/**
 * Transcreve vários reels numa única execução do Apify (uma só execução por
 * referência, para não disputar as 5 simultâneas da conta).
 *
 * Devolve shortcode → fala. Reel sem fala própria fica fora do mapa; falha da
 * chamada lança, porque análise sem a fala do reel seria análise pela metade.
 */
async function transcreverReels(
  apifyToken: string,
  reelUrls: string[],
): Promise<Map<string, string>> {
  const res = await apifyRunSync(apifyToken, TRANSCRIPT_ACTOR, {
    reelUrls,
    transcriptionMode: "captions-first",
    language: "auto",
    translateToEnglish: false,
    includeMetadata: false,
  }, TRANSCRIPT_TIMEOUT_MS);
  if (!res.ok) throw new Error(await resumoErroApify(res, "transcript"));

  const items = await res.json();
  const linhas: Record<string, unknown>[] = Array.isArray(items)
    ? items.filter((r) => r && typeof r === "object")
    : [];
  if (linhas.length) console.log("transcript: campos", Object.keys(linhas[0]).join(","));

  const textoDe = (row: Record<string, unknown>) =>
    String(row.transcript ?? row.fullText ?? row.text ?? "").trim();

  const porShortcode = new Map<string, string>();
  const naoCasadas: Record<string, unknown>[] = [];
  for (const row of linhas) {
    const texto = textoDe(row);
    const codigo = Object.values(row).map(shortcodeDe).find(Boolean) ?? null;
    if (codigo) {
      if (texto) porShortcode.set(codigo, texto);
    } else {
      naoCasadas.push(row);
    }
  }
  // Sem URL nas linhas de saída, só dá para casar pela ordem — e só se as contagens baterem.
  if (naoCasadas.length && naoCasadas.length === reelUrls.length) {
    naoCasadas.forEach((row, i) => {
      const codigo = shortcodeDe(reelUrls[i]);
      const texto = textoDe(row);
      if (codigo && texto) porShortcode.set(codigo, texto);
    });
  }
  if (linhas.length && !porShortcode.size) {
    // Há linhas mas nenhuma casou nem tem fala: mostra o formato para ajustar o casamento.
    console.warn(
      "transcript: nenhuma fala casada",
      JSON.stringify(linhas.slice(0, 2)).slice(0, 600),
    );
  }
  return porShortcode;
}

// ---------------------------------------------------------------------------
// Texto escrito nas imagens (visão)
// ---------------------------------------------------------------------------

function urlsParaLerTexto(post: Record<string, unknown>): string[] {
  const str = (v: unknown) => (typeof v === "string" && v.startsWith("http") ? v : null);

  // Reel: só a capa (onde costuma estar o título). Os quadros do vídeo não entram.
  if (isReel(post)) {
    const capa = str(post.displayUrl);
    return capa ? [capa] : [];
  }

  const filhos = Array.isArray(post.childPosts) ? post.childPosts : [];
  const dosFilhos = filhos
    .map((c) => str((c as Record<string, unknown>)?.displayUrl))
    .filter((u): u is string => Boolean(u));
  if (dosFilhos.length) return dosFilhos.slice(0, VISAO_MAX_SLIDES);

  const imagens = Array.isArray(post.images)
    ? post.images.map(str).filter((u): u is string => Boolean(u))
    : [];
  if (imagens.length) return imagens.slice(0, VISAO_MAX_SLIDES);

  const unica = str(post.displayUrl);
  return unica ? [unica] : [];
}

function base64DeBytes(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(bin);
}

/**
 * Baixa a imagem e a entrega como data URL. As URLs da CDN do Instagram são
 * assinadas e expiram; baixar aqui evita que o provedor do modelo tente buscá-la
 * depois e receba 403.
 */
async function baixarImagem(url: string): Promise<string> {
  let ultimoErro: unknown;
  for (let tentativa = 0; tentativa < 2; tentativa++) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), IMAGEM_TIMEOUT_MS);
    try {
      const res = await fetch(url, { signal: ctrl.signal });
      if (!res.ok) throw new Error(`imagem HTTP ${res.status}`);
      const tipo = (res.headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
      if (!tipo.startsWith("image/")) throw new Error(`conteúdo não é imagem (${tipo || "?"})`);
      const bytes = new Uint8Array(await res.arrayBuffer());
      if (bytes.byteLength > IMAGEM_MAX_BYTES) throw new Error("imagem acima de 5MB");
      return `data:${tipo};base64,${base64DeBytes(bytes)}`;
    } catch (e) {
      ultimoErro = e;
    } finally {
      clearTimeout(t);
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

const SYSTEM_VISAO = `Você transcreve o texto escrito em imagens de posts do Instagram (slides de carrossel, imagem única ou capa de vídeo).

Regras:
- Transcreva fielmente TODO o texto legível de cada imagem, na ordem em que se lê. Preserve a língua original.
- Não descreva a imagem, não interprete, não resuma e não invente texto que não esteja visível.
- Imagem sem texto escrito: devolva "".
- Ignore marcas d'água, @ do perfil, contadores de slide e botões da interface.

Retorne APENAS um JSON, sem markdown:
{ "slides": [ { "n": 1, "texto": "..." } ] }
Um item por imagem recebida, com "n" começando em 1.`;

/** Texto escrito em cada imagem, na ordem das URLs. Falha lança: análise pela metade não serve. */
async function lerTextoDasImagens(urls: string[], rotulo: string): Promise<string[]> {
  const imagens = await Promise.all(urls.map(baixarImagem));
  const text = await withTimeout(
    callModelo(
      SYSTEM_VISAO,
      `São ${imagens.length} imagem(ns), em ordem. Transcreva o texto de cada uma.`,
      VISAO_MAX_TOKENS,
      { model: VISAO_MODEL, imagens },
    ),
    VISAO_TIMEOUT_MS,
    `visão ${rotulo}`,
  );
  const parsed = extractJson<{ slides?: { n?: number; texto?: unknown }[] }>(text);
  const slides = Array.isArray(parsed.slides) ? parsed.slides : [];
  if (slides.length !== imagens.length) {
    throw new Error(`visão devolveu ${slides.length} slides para ${imagens.length} imagens`);
  }
  return imagens.map((_, i) => {
    const doSlide = slides.find((s) => s.n === i + 1) ?? slides[i];
    return String(doSlide?.texto ?? "").trim();
  });
}

type Enriquecido = {
  post: Record<string, unknown>;
  textoRico: string;
  transcript: string | null;
};

async function processRef(refId: string) {
  const supabase = getServiceClient();
  const apifyToken = Deno.env.get("APIFY_API_TOKEN");
  if (!apifyToken) throw new Error("APIFY_API_TOKEN missing");

  const { data: ref } = await supabase
    .from("perfis_referencia")
    .select(
      "id, handle, foco_curadoria, conta_id, perfil_id_relacionado, perfis:perfis!perfis_referencia_perfil_id_relacionado_fkey(id,nome,tipo,diretrizes,foco_curadoria,conta_id)",
    )
    .eq("id", refId)
    .maybeSingle();

  if (!ref) throw new Error(`ref ${refId} não encontrada`);
  const perfil = (ref as any).perfis;
  if (!perfil) throw new Error(`perfil para ref ${refId} não encontrado`);

  // Cota do plano validada no servidor antes de gastar Apify/Claude.
  const contaId = (ref as any).conta_id ?? perfil.conta_id;
  const cota = await limiteDisponivel(contaId, "curadoria");
  if (!cota.permitido) {
    return { ref: ref.handle, curados: 0, error: `limite: ${cota.motivo}` };
  }

  // Exceção por referência sobrescreve o foco padrão do perfil.
  const foco: Foco = normalizeFoco(
    (ref as any).foco_curadoria ?? perfil.foco_curadoria,
  );

  await setStatus("curador", "working", `buscando @${ref.handle} (${foco})`);

  let posts: any[] = [];
  try {
    const apifyRes = await apifyRunSync(apifyToken, "apify~instagram-scraper", {
      directUrls: [`https://www.instagram.com/${ref.handle}/`],
      resultsType: "posts",
      resultsLimit: APIFY_RESULTS_LIMIT,
    }, APIFY_TIMEOUT_MS);
    if (!apifyRes.ok) {
      return { ref: ref.handle, curados: 0, error: await resumoErroApify(apifyRes, ref.handle) };
    }
    posts = await apifyRes.json();
  } catch (e) {
    console.error("Apify error", ref.handle, e);
    const error = e instanceof Error && e.name === "AbortError"
      ? `timeout apify após ${APIFY_TIMEOUT_MS / 1000}s`
      : String(e).slice(0, 200);
    return { ref: ref.handle, curados: 0, error };
  }

  // Custo da coleta (Apify) desta referência.
  await registrarCustoScraping(contaId, perfil.id, posts.length);
  setCustoContexto({
    contaId,
    perfilId: perfil.id,
    agente: "curador",
    tipo: "curadoria",
  });

  // Perfil inexistente/privado volta 1 linha de erro (`error: "no_items"`) em vez
  // de posts. Sem este filtro ela virava um "conteúdo" de score 0 na curadoria.
  const encontrados = posts.length;
  posts = posts.filter((p) => p && !p.error && !p.errorDescription);
  if (!posts.length) {
    return {
      ref: ref.handle,
      curados: 0,
      error: "sem posts: handle inexistente, perfil privado ou sem publicações",
    };
  }

  // Viral: melhores por tração primeiro. Posicionamento: mais recentes primeiro.
  posts = ordenarPorFoco(posts as Record<string, unknown>[], foco);

  // ---- 1) Candidatos novos ----
  let duplicados = 0;
  const selecionados: Record<string, unknown>[] = [];
  for (const raw of posts) {
    if (selecionados.length >= MAX_NEW_POSTS_TO_SCORE) break;
    const post = raw as Record<string, unknown>;
    if (post.url) {
      const { data: existing } = await supabase
        .from("conteudos_curados")
        .select("id")
        .eq("url", post.url)
        .limit(1)
        .maybeSingle();
      if (existing) {
        duplicados++;
        continue;
      }
    }
    selecionados.push(post);
  }
  const avaliados = selecionados.length;

  // ---- 2) Conteúdo completo de cada candidato, ANTES da nota ----
  // Fala dos reels (1 execução do Apify) e texto das imagens (visão) rodam juntos.
  // Candidato cujo conteúdo não pôde ser lido sai da disputa em vez de ser julgado
  // só pela legenda.
  await setStatus("curador", "working", `lendo @${ref.handle}: ${avaliados} posts`);

  const reelUrls = selecionados
    .filter((p) => isReel(p) && typeof p.url === "string")
    .map((p) => p.url as string);

  const falasPromise: Promise<{ ok: true; mapa: Map<string, string> } | { ok: false; erro: string }> =
    reelUrls.length
      ? transcreverReels(apifyToken, reelUrls)
        .then(async (mapa) => {
          await registrarCustoScraping(contaId, perfil.id, reelUrls.length);
          return { ok: true as const, mapa };
        })
        .catch((e) => ({ ok: false as const, erro: formatAgentError(e) }))
      : Promise.resolve({ ok: true as const, mapa: new Map<string, string>() });

  const textosDasImagens = await Promise.all(
    selecionados.map(async (post) => {
      const urls = urlsParaLerTexto(post);
      if (!urls.length) return { ok: true as const, textos: [] as string[] };
      try {
        return { ok: true as const, textos: await lerTextoDasImagens(urls, ref.handle) };
      } catch (e) {
        console.error("Curador visão error", ref.handle, post.url, e);
        return { ok: false as const, erro: `visão: ${formatAgentError(e)}` };
      }
    }),
  );
  const falas = await falasPromise;
  if (!falas.ok) {
    await alertarAdminFalha("curador", `transcrição @${ref.handle}: ${falas.erro}`);
  }

  const enriquecidos: Enriquecido[] = [];
  const falhasLeitura: string[] = [];
  selecionados.forEach((post, i) => {
    const imagens = textosDasImagens[i];
    if (!imagens.ok) {
      falhasLeitura.push(imagens.erro);
      return;
    }
    let transcript: string | null = null;
    if (isReel(post) && typeof post.url === "string") {
      if (!falas.ok) {
        falhasLeitura.push(`transcrição: ${falas.erro}`);
        return;
      }
      transcript = falas.mapa.get(shortcodeDe(post.url) ?? "") ?? null;
    }
    enriquecidos.push({ post, textoRico: textoRicoDoPost(post, imagens.textos), transcript });
  });

  if (avaliados > 0 && !enriquecidos.length) {
    return {
      ref: ref.handle,
      curados: 0,
      error: `não consegui ler o conteúdo de nenhum dos ${avaliados} posts (${falhasLeitura[0]})`,
    };
  }

  // ---- 3) Nota, já com legenda + texto das imagens + fala ----
  const system = SYSTEM
    .replace("{{perfil_nome}}", perfil.nome)
    .replace("{{perfil_tipo}}", perfil.tipo)
    .replace("{{perfil_diretrizes}}", JSON.stringify(perfil.diretrizes))
    .replace("{{foco}}", foco)
    .replace("{{rubrica_foco}}", foco === "viral" ? RUBRICA_VIRAL : RUBRICA_POSICIONAMENTO);

  const pontuados = await Promise.all(
    enriquecidos.map(async ({ post, textoRico, transcript }): Promise<Candidato | null> => {
      const userPrompt = `Post para análise:
- texto:
${textoRico || "(sem texto de legenda/alt/slides)"}
- fala (transcrição do áudio do vídeo):
${transcript ?? "(sem transcrição)"}
- likes: ${post.likesCount ?? 0}
- comentários: ${post.commentsCount ?? 0}
- views: ${post.videoPlayCount ?? "n/a"}
- formato: ${post.type ?? "post"}
- url: ${post.url ?? ""}`;
      try {
        const text = await withTimeout(
          callModelo(system, userPrompt, SCORE_MAX_TOKENS),
          CLAUDE_TIMEOUT_MS,
          `claude ${ref.handle}`,
        );
        const parsed = extractJson<ScoreParsed>(text);
        if (typeof parsed.score_curadoria !== "number") return null;
        return { post, parsed, textoRico, transcript };
      } catch (e) {
        console.error("Curador item error", ref.handle, e);
        return null;
      }
    }),
  );
  const candidatos = pontuados.filter((c): c is Candidato => c !== null);

  // Sempre grava o(s) top-N por score — limiar ≥5 não bloqueia a entrega.
  candidatos.sort((a, b) => b.parsed.score_curadoria - a.parsed.score_curadoria);
  const vencedores = candidatos.slice(0, TOP_SAVE_PER_REF);

  let curados = 0;
  for (const { post, parsed, textoRico, transcript } of vencedores) {
    // Trilha sonora não é fala: o modelo marca `fala_util: false` e a transcrição é descartada.
    const transcricao = transcript && parsed.fala_util !== false ? transcript : null;
    const { error: insertError } = await supabase
      .from("conteudos_curados")
      .insert({
        perfil_referencia_id: ref.id,
        url: post.url ?? null,
        formato: post.type ?? "post",
        tema: parsed.tema,
        gancho: parsed.gancho_identificado,
        score_curadoria: parsed.score_curadoria,
        texto_original: textoRico || String(post.caption ?? "") || null,
        transcricao,
        likes: typeof post.likesCount === "number" ? post.likesCount : null,
        comentarios: typeof post.commentsCount === "number" ? post.commentsCount : null,
        views: typeof post.videoPlayCount === "number" ? post.videoPlayCount : null,
        postado_em: post.timestamp ?? post.taken_at_timestamp ?? null,
      });

    if (insertError) {
      console.error("Curador insert error", ref.handle, insertError);
      continue;
    }
    curados++;
  }

  return {
    ref: ref.handle,
    foco,
    curados,
    avaliados,
    duplicados,
    encontrados,
    lidos: enriquecidos.length,
    reels: reelUrls.length,
    falas: falas.ok ? falas.mapa.size : 0,
    fala_do_vencedor: !vencedores[0] || !isReel(vencedores[0].post)
      ? "n/a"
      : !vencedores[0].transcript
      ? "reel sem transcrição"
      : vencedores[0].parsed.fala_util === false
      ? "descartada (não é fala)"
      : "salva",
    topScore: vencedores[0]?.parsed.score_curadoria ?? null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  const url = new URL(req.url);
  const refId = url.searchParams.get("ref_id");

  // ============ MODO WORKER (1 ref) ============
  if (refId) {
    try {
      const result = await processRef(refId);
      // A fila do cron só considera coletada a referência que terminou sem erro.
      if (!result.error) {
        await getServiceClient()
          .from("perfis_referencia")
          .update({ ultima_coleta_em: new Date().toISOString() })
          .eq("id", refId);
      }
      const detalhe = result.error
        ? `falha @${result.ref}: ${result.error}`
        : `worker ok: @${result.ref} (${result.curados} novas, ${result.duplicados ?? 0} dup, ${result.avaliados ?? 0} avaliadas${
            result.topScore != null ? `, top ${result.topScore}` : ""
          })`;
      await setStatus(
        "curador",
        result.error ? "error" : "idle",
        detalhe.slice(0, 180),
      );
      return new Response(JSON.stringify({ ok: !result.error, result }), {
        status: result.error ? 502 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    } catch (e) {
      console.error("worker error", e);
      await setStatus("curador", "error", formatAgentError(e));
      return new Response(JSON.stringify({ ok: false, error: String(e) }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ============ MODO ORQUESTRADOR ============
  try {
    const supabase = getServiceClient();

    // Fila: cada tick do cron reserva só o que cabe nas execuções simultâneas do
    // Apify. O que não coube (ou falhou) volta no tick seguinte, dentro do dia.
    const { data: reservadas, error: reservaError } = await supabase.rpc(
      "reservar_referencias_coleta",
      { _limite: APIFY_CONCORRENCIA },
    );
    if (reservaError) throw new Error(`reservar_referencias_coleta: ${reservaError.message}`);

    const refs: { id: string; handle: string }[] = (reservadas ?? []).map((r: { ref_id: string; ref_handle: string }) => ({
      id: r.ref_id,
      handle: r.ref_handle,
    }));

    // Nada pendente: não toca no status do agente (o tick roda de 5 em 5 minutos).
    if (!refs.length) {
      return new Response(JSON.stringify({ ok: true, disparados: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const internalSecret = Deno.env.get("AGENT_INTERNAL_SECRET") ?? "";
    const fnUrl = `${supabaseUrl}/functions/v1/curador-agent`;

    const dispararWorker = (ref: { id: string; handle: string }) =>
      fetch(`${fnUrl}?ref_id=${ref.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "x-agent-secret": internalSecret,
        },
        body: "{}",
      }).then(async (res) => ({
        handle: ref.handle,
        ok: res.ok,
        status: res.status,
        body: await res.text().catch(() => ""),
      })).catch((e) => ({
        handle: ref.handle,
        ok: false,
        status: 0,
        body: String(e),
      }));

    const totalRefs = refs.length;
    const resultados: Awaited<ReturnType<typeof dispararWorker>>[] = [];
    const pool = Promise.all(refs.map(async (ref) => {
      resultados.push(await dispararWorker(ref));
    }));

    const summarizeWorkers = async () => {
      await pool;
      const results = resultados;
      const ok = results.filter((r) => r.ok).length;
      const fail = results.length - ok;
      const firstFail = results.find((r) => !r.ok);
      if (fail) {
        console.error("curador fanout failures", results);
        // Falha parcial (perfil indisponível na fonte) não é erro do agente:
        // o ciclo concluiu e as demais referências foram curadas normalmente.
        const parcial = ok > 0;
        await setStatus(
          "curador",
          parcial ? "idle" : "error",
          `${ok}/${results.length} referências verificadas${
            fail
              ? `; ${fail} indisponível(is) na fonte${firstFail ? ` (@${firstFail.handle})` : ""} — serão tentadas no próximo ciclo`
              : ""
          }`,
        );
        return;
      }
      await setStatus("curador", "idle", `${ok}/${results.length} referências verificadas`);
    };

    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(summarizeWorkers());
    else await summarizeWorkers();

    await setStatus("curador", "working", `${totalRefs} workers disparados`);
    return new Response(JSON.stringify({ ok: true, disparados: totalRefs }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    await setStatus("curador", "error", formatAgentError(e));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
