/**
 * Ponte entre o app e as edge functions dos agentes.
 *
 * As functions exigem o header `x-agent-secret` ou um usuário com papel
 * `admin` global (ver `supabase/functions/_shared/agent-utils.ts`). Cliente
 * pagante não é admin, então o disparo passa por aqui: o segredo nunca chega
 * ao navegador.
 *
 * Os headers vêm de `public.agent_internal_headers()`, a mesma função que os
 * triggers e cron jobs usam via pg_net. Assim o segredo tem uma fonte só, o
 * Vault do Supabase, e não precisa ser replicado no ambiente do servidor.
 *
 * SEGURANÇA: este módulo não faz nenhuma checagem de posse. Quem chama é
 * responsável por confirmar que o recurso pertence à conta do usuário antes
 * de invocar um agente.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const AGENTES = [
  "curador-agent",
  "ideador-agent",
  "copy-agent",
  "visual-agent",
  "revisor-agent",
  "carrossel-agent",
  "dna-agent",
] as const;

export type Agente = (typeof AGENTES)[number];

export type RespostaAgente<T = Record<string, unknown>> = {
  ok: boolean;
  status: number;
  data: T | null;
  erro: string | null;
};

/**
 * Headers internos do Vault, memorizados por processo.
 *
 * São estáveis durante a vida do servidor; buscar a cada chamada custaria um
 * round-trip ao Postgres antes de cada disparo. Em caso de erro o cache é
 * limpo para a próxima tentativa poder buscar de novo.
 */
let headersCache: Promise<Record<string, string>> | null = null;

function headersInternos(): Promise<Record<string, string>> {
  if (headersCache) return headersCache;

  headersCache = (async () => {
    const { data, error } = await (supabaseAdmin as unknown as {
      rpc: (fn: string) => Promise<{ data: unknown; error: { message: string } | null }>;
    }).rpc("agent_internal_headers");

    if (error) throw new Error(`Falha ao ler os segredos dos agentes: ${error.message}`);
    if (!data || typeof data !== "object") {
      throw new Error(
        "agent_internal_headers() não retornou headers. Confirme os segredos " +
          "agent_base_url, agent_apikey e agent_internal_secret no Vault.",
      );
    }
    return data as Record<string, string>;
  })().catch((e) => {
    headersCache = null;
    throw e;
  });

  return headersCache;
}

function baseUrl() {
  const url = process.env.SUPABASE_URL;
  if (!url) throw new Error("SUPABASE_URL não está definido no ambiente do servidor.");
  return url.replace(/\/+$/, "");
}

/** Invoca uma edge function de agente e espera a resposta. */
export async function invocarAgente<T = Record<string, unknown>>(
  agente: Agente,
  payload: Record<string, unknown> = {},
  opts: { query?: Record<string, string>; timeoutMs?: number } = {},
): Promise<RespostaAgente<T>> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts.timeoutMs ?? 120_000);

  try {
    const destino = new URL(`${baseUrl()}/functions/v1/${agente}`);
    for (const [chave, valor] of Object.entries(opts.query ?? {})) {
      destino.searchParams.set(chave, valor);
    }

    const headers = await headersInternos();

    const res = await fetch(destino, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

    const texto = await res.text();
    let data: T | null = null;
    try {
      data = texto ? (JSON.parse(texto) as T) : null;
    } catch {
      data = null;
    }

    const corpoErro = (data as { error?: string } | null)?.error;
    const okNoCorpo = (data as { ok?: boolean } | null)?.ok;
    const sucesso = res.ok && okNoCorpo !== false;

    return {
      ok: sucesso,
      status: res.status,
      data,
      erro: sucesso ? null : corpoErro || texto.slice(0, 300) || `HTTP ${res.status}`,
    };
  } catch (e) {
    const abortado = e instanceof Error && e.name === "AbortError";
    return {
      ok: false,
      status: abortado ? 504 : 500,
      data: null,
      erro: abortado ? `O agente ${agente} não respondeu no tempo esperado.` : String(e),
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Dispara a coleta de uma ou mais referências sem esperar o resultado.
 *
 * Um worker do curador leva de 1 a 3 minutos (Apify mais uma chamada de modelo
 * por post), tempo demais para prender uma requisição. O usuário lê o manual de
 * marca enquanto isso roda e encontra a curadoria pronta ao entrar no app.
 */
export function dispararCuradoria(referenciaIds: string[]): void {
  for (const id of referenciaIds) {
    invocarAgente("curador-agent", {}, { query: { ref_id: id }, timeoutMs: 240_000 })
      .then((r) => {
        if (!r.ok) console.error("curador-agent falhou", id, r.erro);
      })
      .catch((e) => console.error("curador-agent erro", id, e));
  }
}
