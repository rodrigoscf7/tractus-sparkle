// Curador (fan-out):
// - Modo orquestrador (sem ref_id): chamado 1x/dia via pg_cron. Lê todos os
//   perfis_referencia ativos e dispara 1 invocação por ref (fire-and-forget)
//   via fetch para esta mesma function com ?ref_id=...
// - Modo worker (com ref_id): processa apenas 1 ref — busca via Apify, scoreia
//   com Claude, insere em conteudos_curados, e ao final chama o ideador-agent
//   uma única vez para o perfil correspondente.
import {
  callClaude,
  corsHeaders,
  extractJson,
  getServiceClient,
  setStatus,
} from "../_shared/agent-utils.ts";

const SYSTEM = `Você é o agente de curadoria de conteúdo da Tractus.
Sua função é analisar um post/reel de um perfil de referência e decidir se ele é
relevante para inspirar conteúdo do perfil: {{perfil_nome}} ({{perfil_tipo}}).
Diretrizes do perfil: {{perfil_diretrizes}}
Retorne APENAS um JSON, sem markdown:
{ "score_curadoria": 0-10, "tema": "string", "gancho_identificado": "string",
  "motivo_score": "string", "aproveitavel": true/false }
Critério: priorize ganchos específicos e contra-intuitivos sobre fórmulas genéricas.
Conteúdo raso ou clichê recebe score baixo mesmo com engajamento alto.`;

const APIFY_TIMEOUT_MS = 60_000;
const CLAUDE_TIMEOUT_MS = 30_000;

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
          resultsLimit: 20,
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
  let temScoreAlto = false;

  for (const post of posts) {
    if (post.url) {
      const { data: existing } = await supabase
        .from("conteudos_curados")
        .select("id")
        .eq("url", post.url)
        .limit(1)
        .maybeSingle();
      if (existing) continue;
    }

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
        callClaude(system, userPrompt, 800),
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
      });
      curados++;
      if (parsed.score_curadoria >= 7) temScoreAlto = true;
    } catch (e) {
      console.error("Curador item error", ref.handle, e);
    }
  }

  // Chama ideador 1x para o perfil, somente se houve conteúdo aproveitável >= 7
  if (temScoreAlto) {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    // fire-and-forget
    fetch(`${supabaseUrl}/functions/v1/ideador-agent`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
      },
      body: JSON.stringify({ perfil_referencia_id: ref.id }),
    }).catch((e) => console.error("ideador trigger failed", e));
  }

  return { ref: ref.handle, curados };
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
      await setStatus("curador", "error", String(e).slice(0, 200));
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

    let disparados = 0;
    for (const ref of refs ?? []) {
      // fire-and-forget; cada worker faz seu próprio setStatus e roda independente
      fetch(`${fnUrl}?ref_id=${ref.id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
        },
      }).catch((e) => console.error("fanout failed", ref.handle, e));
      disparados++;
    }

    await setStatus("curador", "working", `${disparados} workers disparados`);
    return new Response(JSON.stringify({ ok: true, disparados }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    await setStatus("curador", "error", String(e).slice(0, 200));
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
