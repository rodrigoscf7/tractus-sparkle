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

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-5-20250929"; // closest available; was "claude-sonnet-4-6" in prompt

export async function callClaude(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 2000,
): Promise<string> {
  const key = Deno.env.get("ANTHROPIC_API_KEY");
  if (!key) throw new Error("ANTHROPIC_API_KEY missing");

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Anthropic error ${res.status}: ${t}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text ?? "";
}

export function extractJson<T = unknown>(text: string): T {
  // Try plain parse first, then fenced ```json
  try {
    return JSON.parse(text) as T;
  } catch {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (fenced) return JSON.parse(fenced[1]) as T;
    const m = text.match(/\{[\s\S]*\}/);
    if (m) return JSON.parse(m[0]) as T;
    throw new Error("No JSON found in model response: " + text.slice(0, 300));
  }
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
