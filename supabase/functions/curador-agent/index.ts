// Curador: roda 1x/dia via pg_cron. Busca posts via Apify para cada perfil de
// referência ativo e cria linhas em conteudos_curados com score atribuído pelo
// Claude. Score >= 7 dispara trigger_ideador automaticamente.
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    await setStatus("curador", "working", "iniciando curadoria diária");
    const supabase = getServiceClient();
    const apifyToken = Deno.env.get("APIFY_API_TOKEN");
    if (!apifyToken) throw new Error("APIFY_API_TOKEN missing");

    const { data: refs } = await supabase
      .from("perfis_referencia")
      .select("id, handle, perfil_id_relacionado, perfis:perfis!perfis_referencia_perfil_id_relacionado_fkey(id,nome,tipo,diretrizes)")
      .eq("ativo", true);

    let totalCurados = 0;
    for (const ref of refs ?? []) {
      const perfil = (ref as any).perfis;
      if (!perfil) continue;

      await setStatus("curador", "working", `buscando @${ref.handle}`);

      // Apify Instagram scraper
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
        },
      );
      if (!apifyRes.ok) {
        console.error("Apify failed", ref.handle, await apifyRes.text());
        continue;
      }
      const posts: any[] = await apifyRes.json();

      for (const post of posts) {
        // skip if already curado (url match)
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
          const text = await callClaude(system, userPrompt, 800);
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
          totalCurados++;
        } catch (e) {
          console.error("Curador parse error", e);
        }
      }
    }

    await setStatus("curador", "idle", `${totalCurados} conteúdos curados`);
    return new Response(JSON.stringify({ ok: true, total: totalCurados }), {
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
