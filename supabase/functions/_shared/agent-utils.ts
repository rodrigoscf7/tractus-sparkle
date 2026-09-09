// Shared utilities for all agent edge functions
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

export function getServiceClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

/**
 * Todas as functions de agente rodam com service-role. Elas só podem ser
 * invocadas por:
 *  - chamadas internas (pg_cron, triggers, fan-out do curador) que enviam o
 *    header x-agent-secret com AGENT_INTERNAL_SECRET;
 *  - um usuário logado com papel 'admin' (JWT no header Authorization).
 * Qualquer outra chamada é rejeitada com 401/403.
 */
export async function requireAgentAuth(req: Request): Promise<Response | null> {
  const unauthorized = (status: number, error: string) =>
    new Response(JSON.stringify({ ok: false, error }), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  const internalSecret = Deno.env.get("AGENT_INTERNAL_SECRET");
  const provided = req.headers.get("x-agent-secret");
  if (internalSecret && provided && provided === internalSecret) return null;

  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim()
    : "";
  if (!token) return unauthorized(401, "Autenticação obrigatória");

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  // A anon key sozinha não autentica ninguém.
  if (token === anonKey) return unauthorized(401, "Autenticação obrigatória");

  const userClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    anonKey,
    {
      auth: { persistSession: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    },
  );

  const { data: userData, error } = await userClient.auth.getUser();
  if (error || !userData?.user) return unauthorized(401, "Sessão inválida");

  const { data: isAdmin, error: roleError } = await userClient.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleError || !isAdmin) return unauthorized(403, "Acesso restrito a administradores");

  return null;
}

export async function setStatus(
  agente: string,
  estado: "idle" | "working" | "waiting" | "error",
  ultimaAcao?: string,
) {
  const supabase = getServiceClient();
  await supabase.from("agentes_status").upsert({
    agente_nome: agente,
    estado_atual: estado,
    ultima_acao: ultimaAcao ?? null,
    atualizado_em: new Date().toISOString(),
  });
}

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
// Trocar de modelo não exige deploy: basta ajustar o secret OPENROUTER_MODEL.
const MODEL = Deno.env.get("OPENROUTER_MODEL") ?? "anthropic/claude-sonnet-4.5";

export type CustoContexto = {
  contaId?: string | null;
  perfilId?: string | null;
  agente: string;
  tipo: string;
};

let custoContexto: CustoContexto | null = null;

/**
 * Define a qual conta/perfil os próximos custos de modelo pertencem.
 * Chame antes de callModelo para que o consumo apareça no painel financeiro.
 */
export function setCustoContexto(ctx: CustoContexto | null) {
  custoContexto = ctx;
}

async function registrarCustoModelo(
  tokensEntrada: number,
  tokensSaida: number,
) {
  const ctx = custoContexto;
  if (!ctx) return;
  try {
    const supabase = getServiceClient();
    await supabase.from("custo_eventos").insert({
      conta_id: ctx.contaId ?? null,
      perfil_id: ctx.perfilId ?? null,
      agente: ctx.agente,
      tipo: ctx.tipo,
      modelo: MODEL,
      tokens_entrada: tokensEntrada,
      tokens_saida: tokensSaida,
      itens: 1,
    });
  } catch (e) {
    console.error("registrarCustoModelo falhou", e);
  }
}

/** Registra o custo de uma execução de coleta (Apify). */
export async function registrarCustoScraping(
  contaId: string | null | undefined,
  perfilId: string | null | undefined,
  itens = 1,
) {
  try {
    const supabase = getServiceClient();
    await supabase.from("custo_eventos").insert({
      conta_id: contaId ?? null,
      perfil_id: perfilId ?? null,
      agente: "curador",
      tipo: "scraping",
      modelo: "apify",
      tokens_entrada: 0,
      tokens_saida: 0,
      itens,
    });
  } catch (e) {
    console.error("registrarCustoScraping falhou", e);
  }
}

export async function callModelo(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000,
): Promise<string> {
  const key = Deno.env.get("OPENROUTER_API_KEY");
  if (!key) throw new Error("OPENROUTER_API_KEY missing");

  const res = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "content-type": "application/json",
      "X-Title": "Tractus Content Hub",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    let message = t;
    try {
      const parsed = JSON.parse(t);
      message = parsed?.error?.message ?? t;
    } catch {
      // keep raw response text
    }
    throw new Error(`OpenRouter error ${res.status}: ${message}`);
  }
  const data = await res.json();
  // O OpenRouter responde 200 com corpo de erro quando o upstream falha.
  if (data?.error) {
    throw new Error(`OpenRouter error: ${data.error.message ?? JSON.stringify(data.error)}`);
  }
  await registrarCustoModelo(
    Number(data?.usage?.prompt_tokens ?? 0),
    Number(data?.usage?.completion_tokens ?? 0),
  );
  return data?.choices?.[0]?.message?.content ?? "";
}


export function formatAgentError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  if (text.includes("rate limit") || text.includes("429")) {
    return "Limite temporário do modelo atingido; execução será retomada no próximo ciclo.";
  }
  return text.slice(0, 180);
}

export function extractJson<T = unknown>(text: string): T {
  // Try plain parse first, then fenced ```json
  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenced) {
      try { return JSON.parse(fenced[1]) as T; } catch { /* fall through */ }
    }
    // Look for the first { and try progressively balanced substrings
    const start = text.indexOf("{");
    if (start >= 0) {
      const candidate = text.slice(start);
      try { return JSON.parse(candidate) as T; } catch { /* try repair */ }
      // Attempt to repair truncated JSON by closing open braces/brackets
      const repaired = repairTruncatedJson(candidate);
      if (repaired) {
        try { return JSON.parse(repaired) as T; } catch { /* give up */ }
      }
    }
    throw new Error("No JSON found in model response: " + text.slice(0, 300));
  }
}

function repairTruncatedJson(s: string): string | null {
  // Strip trailing incomplete token, then balance braces/brackets and close strings
  let str = s;
  // If we're inside a string, close it
  let inStr = false;
  let escape = false;
  const stack: string[] = [];
  for (let i = 0; i < str.length; i++) {
    const c = str[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") stack.push(c);
    else if (c === "}" && stack[stack.length - 1] === "{") stack.pop();
    else if (c === "]" && stack[stack.length - 1] === "[") stack.pop();
  }
  if (inStr) str += '"';
  // remove trailing comma if any
  str = str.replace(/,\s*$/, "");
  while (stack.length) {
    const open = stack.pop();
    str += open === "{" ? "}" : "]";
  }
  return str;
}

export async function getHistoricoDecisoes(perfilId: string, limit = 20) {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("decisoes_aprovacao")
    .select("decisao, motivo_categoria, comentario_livre, item_tipo, criado_em")
    .eq("perfil_id", perfilId)
    .order("criado_em", { ascending: false })
    .limit(limit);
  return data ?? [];
}

export function formatHistorico(rows: any[]): string {
  if (!rows.length) return "(sem histórico ainda)";
  return rows
    .map(
      (r) =>
        `- [${r.criado_em?.slice(0, 10)}] ${r.item_tipo} ${r.decisao}${
          r.motivo_categoria ? ` (motivo: ${r.motivo_categoria})` : ""
        }${r.comentario_livre ? ` — "${r.comentario_livre}"` : ""}`,
    )
    .join("\n");
}

/**
 * Cota do plano: valida no servidor se a conta ainda pode gerar `tipo` neste ciclo.
 * Contas suspensas, sem plano ou sem vínculo bloqueiam a geração.
 */
export async function limiteDisponivel(
  contaId: string | null | undefined,
  tipo: "curadoria" | "roteiro" | "carrossel",
): Promise<{ permitido: boolean; motivo: string }> {
  if (!contaId) return { permitido: false, motivo: "conta_ausente" };
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("limite_disponivel", {
    _conta_id: contaId,
    _tipo: tipo,
  });
  if (error) {
    console.error("limite_disponivel erro", error);
    return { permitido: false, motivo: "erro_limite" };
  }
  const r = (data ?? {}) as { permitido?: boolean; motivo?: string };
  return { permitido: r.permitido === true, motivo: r.motivo ?? "desconhecido" };
}
