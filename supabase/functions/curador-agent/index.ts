// Curador (fan-out):
// - Modo orquestrador (sem ref_id): chamado 1x/dia via pg_cron. Lê todos os
//   perfis_referencia ativos e dispara 1 invocação por ref (fire-and-forget)
//   via fetch para esta mesma function com ?ref_id=...
// - Modo worker (com ref_id): processa apenas 1 ref — busca via Apify, scoreia
//   com Claude e insere em conteudos_curados. O ideador roda em cron separado
//   depois da curadoria para evitar estouro de limite por paralelismo.
import {
  callClaude,
  corsHeaders,
  extractJson,
  formatAgentError,
  getServiceClient,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você é o agente de curadoria de conteúdo da Tractus.
Sua função é analisar um post/reel de um perfil de referência e decidir se ele
tem potencial para inspirar conteúdo do perfil: {{perfil_nome}} ({{perfil_tipo}}).
Diretrizes do perfil (apenas para contexto de tema/nicho — NÃO exija tom já alinhado): {{perfil_diretrizes}}

Sua tarefa é IDENTIFICAR POTENCIAL, não filtrar por tom ou profundidade.
Os agentes seguintes (ideador e copy) vão adaptar tom, profundidade e contexto
ao perfil. Você só precisa dizer se o TEMA/GANCHO/TRAÇÃO justifica entrar no funil.

Rubrica de score (0-10):
- 9-10: viral claro (alto engajamento p/ o perfil) OU gancho muito forte no nicho
- 7-8: bom tema com tração razoável ou ângulo interessante
- 5-6: tema pertinente ao nicho, tração mediana — ainda vale registrar
- 0-4: fora do nicho, sem tração e sem ângulo aproveitável

Retorne APENAS um JSON, sem markdown:
{ "score_curadoria": 0-10, "tema": "string", "gancho_identificado": "string",
  "motivo_score": "string", "aproveitavel": true/false }

"aproveitavel" deve ser true sempre que score_curadoria >= 5.
Não descarte por "clichê" ou "raso" se o engajamento for alto — vira insumo mesmo assim.`;

const APIFY_TIMEOUT_MS = 60_000;
const CLAUDE_TIMEOUT_MS = 30_000;
const APIFY_RESULTS_LIMIT = 6;
const MAX_NEW_POSTS_TO_SCORE = 5;
const MIN_SCORE_TO_SAVE = 6;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, rej) =>
      setTimeout(() => rej(new Error(`timeout ${label} após ${ms}ms`)), ms),
    ),
  ]);
}

async function processRef(refId: string) {
  const supabase = getServiceClient();
  const apifyToken = Deno.env.get("APIFY_API_TOKEN");
  if (!apifyToken) throw new Error("APIFY_API_TOKEN missing");

  const { data: ref } = await supabase
    .from("perfis_referencia")
    .select(
      "id, handle, perfil_id_relacionado, perfis:perfis!perfis_referencia_perfil_id_relacionado_fkey(id,nome,tipo,diretrizes)",
    )
    .eq("id", refId)
    .maybeSingle();

  if (!ref) throw new Error(`ref ${refId} não encontrada`);
  const perfil = (ref as any).perfis;
  if (!perfil) throw new Error(`perfil para ref ${refId} não encontrado`);

  await setStatus("curador", "working", `buscando @${ref.handle}`);

  let posts: any[] = [];
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), APIFY_TIMEOUT_MS);
    const apifyRes = await fetch(
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
    clearTimeout(t);
    if (!apifyRes.ok) {
      console.error("Apify failed", ref.handle, apifyRes.status);
      return { ref: ref.handle, curados: 0, error: `apify ${apifyRes.status}` };
    }
    posts = await apifyRes.json();
  } catch (e) {
    console.error("Apify error", ref.handle, e);
    return { ref: ref.handle, curados: 0, error: String(e).slice(0, 200) };
  }

  let curados = 0;
  let duplicados = 0;
  let avaliados = 0;

  for (const post of posts) {
    if (avaliados >= MAX_NEW_POSTS_TO_SCORE) break;

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

    const userPrompt = `Post para análise:
- caption: ${post.caption ?? ""}
- likes: ${post.likesCount ?? 0}
- comentários: ${post.commentsCount ?? 0}
- views: ${post.videoPlayCount ?? "n/a"}
- formato: ${post.type ?? "post"}
- url: ${post.url ?? ""}`;

    const system = SYSTEM
      .replace("{{perfil_nome}}", perfil.nome)
      .replace("{{perfil_tipo}}", perfil.tipo)
      .replace("{{perfil_diretrizes}}", JSON.stringify(perfil.diretrizes));

    try {
      const text = await withTimeout(
        callClaude(system, userPrompt, 220),
        CLAUDE_TIMEOUT_MS,
        `claude ${ref.handle}`,
      );
      const parsed = extractJson<{
        score_curadoria: number;
        tema: string;
        gancho_identificado: string;
        motivo_score: string;
        aproveitavel: boolean;
      }>(text);

      if (!parsed.aproveitavel) continue;

      await supabase.from("conteudos_curados").insert({
        perfil_referencia_id: ref.id,
        url: post.url ?? null,
        formato: post.type ?? "post",
        tema: parsed.tema,
        gancho: parsed.gancho_identificado,
        score_curadoria: parsed.score_curadoria,
        texto_original: post.caption ?? null,
        likes: typeof post.likesCount === "number" ? post.likesCount : null,
        comentarios: typeof post.commentsCount === "number" ? post.commentsCount : null,
        views: typeof post.videoPlayCount === "number" ? post.videoPlayCount : null,
        postado_em: post.timestamp ?? post.taken_at_timestamp ?? null,
      });
      curados++;
    } catch (e) {
      console.error("Curador item error", ref.handle, e);
    }
  }

  return { ref: ref.handle, curados, avaliados, duplicados, encontrados: posts.length };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const refId = url.searchParams.get("ref_id");

  // ============ MODO WORKER (1 ref) ============
  if (refId) {
    try {
      const result = await processRef(refId);
      // ao terminar este worker, verifica se outros ainda estão rodando
      // (não temos contagem central; apenas marca idle se este foi o último a atualizar)
      await setStatus("curador", "idle", `worker ok: @${result.ref} (${result.curados})`);
      return new Response(JSON.stringify({ ok: true, result }), {
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
    const fnUrl = `${supabaseUrl}/functions/v1/curador-agent`;

    const workerPromises = (refs ?? []).map((ref) =>
      fetch(`${fnUrl}?ref_id=${ref.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
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
        await setStatus(
          "curador",
          "error",
          `${ok}/${results.length} refs concluídas; falha em ${fail}${firstFail?.status === "fulfilled" ? ` (@${firstFail.value.handle} ${firstFail.value.status})` : ""}`,
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
