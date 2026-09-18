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
  "motivo_score": "string", "aproveitavel": true/false }

"aproveitavel" deve ser true sempre que score_curadoria >= 5.
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

const APIFY_TIMEOUT_MS = 60_000;
const TRANSCRIPT_TIMEOUT_MS = 120_000;
const CLAUDE_TIMEOUT_MS = 30_000;
const APIFY_RESULTS_LIMIT = 12;
const MAX_NEW_POSTS_TO_SCORE = 5;
/** Quantos itens gravar por ref/ciclo (sempre o de maior score). */
const TOP_SAVE_PER_REF = 1;
/** JSON de score (tema + gancho + motivo); 220 truncava; 500 ainda estourava em alguns posts. */
const SCORE_MAX_TOKENS = 800;
const TRANSCRIPT_ACTOR =
  "scraping_solutions~instagram-reels-transcript-scraper-audio-to-text";

type Foco = "viral" | "posicionamento";

type ScoreParsed = {
  score_curadoria: number;
  tema: string;
  gancho_identificado: string;
  motivo_score: string;
  aproveitavel: boolean;
};

type Candidato = {
  post: Record<string, unknown>;
  parsed: ScoreParsed;
  textoRico: string;
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

/** Legenda + alt + textos/alt dos slides do carrossel. */
function textoRicoDoPost(post: Record<string, unknown>): string {
  const parts: string[] = [];
  const caption = String(post.caption ?? "").trim();
  if (caption) parts.push(`Legenda:\n${caption}`);
  const alt = String(post.alt ?? "").trim();
  if (alt) parts.push(`Alt:\n${alt}`);
  const children = Array.isArray(post.childPosts) ? post.childPosts : [];
  children.forEach((raw, i) => {
    const child = (raw ?? {}) as Record<string, unknown>;
    const cCap = String(child.caption ?? "").trim();
    const cAlt = String(child.alt ?? "").trim();
    if (!cCap && !cAlt) return;
    const bloco = [
      `Slide ${i + 1}:`,
      cCap ? cCap : null,
      cAlt ? `Alt: ${cAlt}` : null,
    ].filter(Boolean).join("\n");
    parts.push(bloco);
  });
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

async function buscarTranscriptReel(
  apifyToken: string,
  reelUrl: string,
): Promise<string | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TRANSCRIPT_TIMEOUT_MS);
  try {
    const res = await fetch(
      `https://api.apify.com/v2/acts/${TRANSCRIPT_ACTOR}/run-sync-get-dataset-items?token=${apifyToken}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reelUrls: [reelUrl],
          transcriptionMode: "captions-first",
          language: "auto",
          translateToEnglish: false,
          includeMetadata: false,
        }),
        signal: ctrl.signal,
      },
    );
    if (!res.ok) {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      throw new Error(`apify transcript ${res.status}${body ? `: ${body}` : ""}`);
    }
    const items = await res.json();
    const row = Array.isArray(items) ? items[0] : null;
    if (!row || typeof row !== "object") return null;
    const transcript = String(
      (row as Record<string, unknown>).transcript ??
        (row as Record<string, unknown>).fullText ??
        "",
    ).trim();
    return transcript || null;
  } finally {
    clearTimeout(t);
  }
}

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
    const runApify = async () => {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), APIFY_TIMEOUT_MS);
      try {
        return await fetch(
          `https://api.apify.com/v2/acts/apify~instagram-scraper/run-sync-get-dataset-items?token=${apifyToken}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              directUrls: [`https://www.instagram.com/${ref.handle}/`],
              resultsType: "posts",
              resultsLimit: APIFY_RESULTS_LIMIT,
            }),
            signal: ctrl.signal,
          },
        );
      } finally {
        clearTimeout(t);
      }
    };

    const summarizeApifyError = async (res: Response) => {
      const body = (await res.text().catch(() => "")).slice(0, 300);
      console.error("Apify failed", ref.handle, res.status, body);
      // 402 costuma ser limite mensal / hard cap — não necessariamente "saldo zerado" na UI.
      return `apify ${res.status}${body ? `: ${body}` : ""}`;
    };

    let apifyRes = await runApify();
    if (!apifyRes.ok) {
      // 5xx/429 do Apify são transitórios: uma nova tentativa antes de desistir.
      if (apifyRes.status >= 500 || apifyRes.status === 429) {
        await new Promise((r) => setTimeout(r, 4000));
        apifyRes = await runApify();
        if (!apifyRes.ok) {
          return { ref: ref.handle, curados: 0, error: await summarizeApifyError(apifyRes) };
        }
      } else {
        return { ref: ref.handle, curados: 0, error: await summarizeApifyError(apifyRes) };
      }
    }
    posts = await apifyRes.json();
  } catch (e) {
    console.error("Apify error", ref.handle, e);
    return { ref: ref.handle, curados: 0, error: String(e).slice(0, 200) };
  }

  // Custo da coleta (Apify) desta referência.
  await registrarCustoScraping(contaId, perfil.id, posts.length);
  setCustoContexto({
    contaId,
    perfilId: perfil.id,
    agente: "curador",
    tipo: "curadoria",
  });

  let curados = 0;
  let duplicados = 0;
  let avaliados = 0;
  const candidatos: Candidato[] = [];

  // Viral: melhores por tração primeiro. Posicionamento: mais recentes primeiro.
  posts = ordenarPorFoco(posts as Record<string, unknown>[], foco);

  for (const raw of posts) {
    if (avaliados >= MAX_NEW_POSTS_TO_SCORE) break;
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

    avaliados++;
    const textoRico = textoRicoDoPost(post);

    const userPrompt = `Post para análise:
- texto:
${textoRico || "(sem texto de legenda/alt/slides)"}
- likes: ${post.likesCount ?? 0}
- comentários: ${post.commentsCount ?? 0}
- views: ${post.videoPlayCount ?? "n/a"}
- formato: ${post.type ?? "post"}
- url: ${post.url ?? ""}`;

    const system = SYSTEM
      .replace("{{perfil_nome}}", perfil.nome)
      .replace("{{perfil_tipo}}", perfil.tipo)
      .replace("{{perfil_diretrizes}}", JSON.stringify(perfil.diretrizes))
      .replace("{{foco}}", foco)
      .replace("{{rubrica_foco}}", foco === "viral" ? RUBRICA_VIRAL : RUBRICA_POSICIONAMENTO);

    try {
      const text = await withTimeout(
        callModelo(system, userPrompt, SCORE_MAX_TOKENS),
        CLAUDE_TIMEOUT_MS,
        `claude ${ref.handle}`,
      );
      const parsed = extractJson<ScoreParsed>(text);
      if (typeof parsed.score_curadoria !== "number") continue;
      candidatos.push({ post, parsed, textoRico });
    } catch (e) {
      console.error("Curador item error", ref.handle, e);
    }
  }

  // Sempre grava o(s) top-N por score — limiar ≥5 não bloqueia a entrega.
  candidatos.sort((a, b) => b.parsed.score_curadoria - a.parsed.score_curadoria);
  const vencedores = candidatos.slice(0, TOP_SAVE_PER_REF);

  for (const cand of vencedores) {
    const { post, parsed, textoRico } = cand;
    const { data: inserted, error: insertError } = await supabase
      .from("conteudos_curados")
      .insert({
        perfil_referencia_id: ref.id,
        url: post.url ?? null,
        formato: post.type ?? "post",
        tema: parsed.tema,
        gancho: parsed.gancho_identificado,
        score_curadoria: parsed.score_curadoria,
        texto_original: textoRico || String(post.caption ?? "") || null,
        likes: typeof post.likesCount === "number" ? post.likesCount : null,
        comentarios: typeof post.commentsCount === "number" ? post.commentsCount : null,
        views: typeof post.videoPlayCount === "number" ? post.videoPlayCount : null,
        postado_em: post.timestamp ?? post.taken_at_timestamp ?? null,
      })
      .select("id")
      .single();

    if (insertError || !inserted?.id) {
      console.error("Curador insert error", ref.handle, insertError);
      continue;
    }
    curados++;

    const url = typeof post.url === "string" ? post.url : "";
    if (url && isReel(post)) {
      try {
        const transcript = await buscarTranscriptReel(apifyToken, url);
        await registrarCustoScraping(contaId, perfil.id, 1);
        if (transcript) {
          await supabase
            .from("conteudos_curados")
            .update({ transcricao: transcript })
            .eq("id", inserted.id);
        }
      } catch (e) {
        console.error("Curador transcript error", ref.handle, e);
        await alertarAdminFalha(
          "curador",
          `transcript @${ref.handle}: ${formatAgentError(e)}`,
        );
      }
    }
  }

  return {
    ref: ref.handle,
    foco,
    curados,
    avaliados,
    duplicados,
    encontrados: posts.length,
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
    await setStatus("curador", "working", "orquestrando curadoria diária");
    const supabase = getServiceClient();

    const { data: refs } = await supabase
      .from("perfis_referencia")
      .select("id, handle")
      .eq("ativo", true);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const internalSecret = Deno.env.get("AGENT_INTERNAL_SECRET") ?? "";
    const fnUrl = `${supabaseUrl}/functions/v1/curador-agent`;

    const workerPromises = (refs ?? []).map((ref) =>
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
      })),
    );

    const summarizeWorkers = async () => {
      const results = await Promise.allSettled(workerPromises);
      const ok = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
      const fail = results.length - ok;
      const firstFail = results.find((r) => r.status === "fulfilled" && !r.value.ok);
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
              ? `; ${fail} indisponível(is) na fonte${firstFail?.status === "fulfilled" ? ` (@${firstFail.value.handle})` : ""} — serão tentadas no próximo ciclo`
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

    await setStatus("curador", "working", `${workerPromises.length} workers disparados`);
    return new Response(JSON.stringify({ ok: true, disparados: workerPromises.length }), {
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
