/**
 * Server functions do quiz da oferta. Todas PÚBLICAS — sem
 * `requireSupabaseAuth`, porque quem responde o quiz ainda não tem conta.
 *
 * Por isso mesmo, cada uma é uma porta aberta na internet e é tratada como tal:
 *
 *   - O visitante nunca fala com o Postgres. `oferta_leads` não tem grant nem
 *     policy para `anon`; tudo aqui usa service role. Abrir insert público
 *     numa tabela daria a qualquer um um lugar para despejar dados.
 *   - A leitura do relatório exige o token, que é aleatório e não sequencial.
 *   - A geração por IA é idempotente por lead e limitada por origem, porque
 *     roda numa página alimentada por tráfego pago e cada chamada custa.
 *   - Toda entrada tem teto de tamanho antes de encostar no banco.
 */

import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createHash, randomBytes } from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

import { dnaViralCurado, normalizarDnaViral, type DnaViral } from "@/lib/dna-viral";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { PERGUNTAS, resumoDoQuiz, validarPergunta, type Respostas } from "@/lib/quiz-oferta";

/**
 * Quantos relatórios uma mesma origem pode gerar por hora.
 *
 * Uma pessoa real gera um. O teto é folgado para não punir escritório ou
 * co-working atrás de um IP só, e apertado o suficiente para que automação não
 * consiga transformar a página do anúncio em uma torneira de custo de modelo.
 */
const LIMITE_GERACOES_POR_HORA = 8;

/** Teto do JSON de respostas. O quiz cheio não passa de alguns KB. */
const MAX_BYTES_RESPOSTAS = 16 * 1024;

const TIMEOUT_AGENTE_MS = 45_000;

/** Cliente de service role, já tipado contra o schema real. */
type Db = SupabaseClient<Database>;

async function admin(): Promise<Db> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/**
 * Identificador de origem para o limite de geração.
 *
 * Guarda o hash, nunca o IP. O endereço é dado pessoal sob a LGPD e não temos
 * motivo para retê-lo: só precisamos saber que duas visitas vieram do mesmo
 * lugar. O sal vem do ambiente do servidor — se ele rodar, os contadores
 * zeram, o que é aceitável para uma janela de uma hora.
 */
function hashDaOrigem(): string | null {
  const request = getRequest();
  const bruto =
    request?.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request?.headers.get("x-real-ip")?.trim() ||
    "";
  if (!bruto) return null;

  const sal = process.env["LEAD_IP_SALT"] ?? process.env["SUPABASE_SERVICE_ROLE_KEY"] ?? "";
  return createHash("sha256").update(`${bruto}:${sal}`).digest("hex");
}

function novoToken(): string {
  return randomBytes(16).toString("base64url");
}

function dentroDoTeto(respostas: Respostas): boolean {
  try {
    return Buffer.byteLength(JSON.stringify(respostas), "utf8") <= MAX_BYTES_RESPOSTAS;
  } catch {
    return false;
  }
}

/** Todas as perguntas obrigatórias respondidas? */
function quizCompleto(respostas: Respostas): boolean {
  for (let i = 1; i <= PERGUNTAS.length; i++) {
    if (validarPergunta(i, respostas)) return false;
  }
  return true;
}

/**
 * Grava o progresso do quiz. Chamada a cada resposta.
 *
 * Salvar a cada passo (e não só no fim) é o que permite recuperar quem
 * abandonou no meio — e o abandono por pergunta é a métrica que diz onde o
 * quiz está perdendo gente.
 */
export const salvarQuiz = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { leadId: string; respostas: Respostas; origem?: Record<string, string> }) => data,
  )
  .handler(async ({ data }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.leadId)) throw new Error("Identificação inválida.");
    if (!dentroDoTeto(data.respostas)) throw new Error("Respostas grandes demais.");

    const db = await admin();
    const agora = new Date().toISOString();

    const { data: existente } = await db
      .from("oferta_leads")
      .select("id, token")
      .eq("id", data.leadId)
      .maybeSingle();

    if (existente) {
      await db
        .from("oferta_leads")
        .update({ respostas: data.respostas, atualizado_em: agora })
        .eq("id", data.leadId);
      return { token: existente.token as string };
    }

    const token = novoToken();
    const { error } = await db.from("oferta_leads").insert({
      id: data.leadId,
      token,
      respostas: data.respostas,
      origem: data.origem ?? {},
      ip_hash: hashDaOrigem(),
      criado_em: agora,
      atualizado_em: agora,
    });
    if (error) throw new Error("Não foi possível salvar suas respostas.");

    return { token };
  });

/**
 * Gera o DNA Viral e devolve o token para a página do relatório.
 *
 * Nunca lança por falha do agente: qualquer problema vira o relatório curado.
 * Esta chamada acontece logo depois do clique que custou o anúncio — devolver
 * um erro aqui é jogar fora a visita.
 */
export const gerarDnaViral = createServerFn({ method: "POST" })
  .inputValidator((data: { leadId: string }) => data)
  .handler(async ({ data }) => {
    if (!/^[0-9a-f-]{36}$/i.test(data.leadId)) throw new Error("Identificação inválida.");

    const db = await admin();
    const { data: lead } = await db
      .from("oferta_leads")
      .select("id, token, respostas, relatorio, ip_hash")
      .eq("id", data.leadId)
      .maybeSingle();

    if (!lead) throw new Error("Não encontramos suas respostas. Refaça o quiz.");

    // Idempotente: revisitar o link não custa uma nova geração.
    if (lead.relatorio) return { token: lead.token as string };

    const respostas = (lead.respostas ?? {}) as Respostas;
    if (!quizCompleto(respostas)) throw new Error("O quiz ainda não está completo.");

    const relatorio = await gerarComFallback(db, lead.ip_hash as string | null, respostas);

    await db
      .from("oferta_leads")
      .update({
        relatorio: relatorio.conteudo,
        relatorio_origem: relatorio.origem,
        relatorio_gerado_em: new Date().toISOString(),
        nome: respostas.nome ?? null,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", data.leadId);

    return { token: lead.token as string };
  });

async function gerarComFallback(
  db: Db,
  ipHash: string | null,
  respostas: Respostas,
): Promise<{ conteudo: DnaViral; origem: "ia" | "curado" }> {
  if (await origemNoLimite(db, ipHash)) {
    console.warn("dna-viral: origem no limite de geracoes, servindo curado");
    return { conteudo: dnaViralCurado(respostas), origem: "curado" };
  }

  try {
    const { invocarAgente } = await import("@/lib/agentes.server");
    const resposta = await invocarAgente<{ relatorio?: unknown }>(
      "dna-viral-agent",
      { respostas },
      { timeoutMs: TIMEOUT_AGENTE_MS },
    );

    if (resposta.ok) {
      const normalizado = normalizarDnaViral(resposta.data?.relatorio);
      if (normalizado) return { conteudo: normalizado, origem: "ia" };
      console.error("dna-viral: agente respondeu fora do contrato");
    } else {
      console.error("dna-viral: agente falhou", resposta.status, resposta.erro);
    }
  } catch (e) {
    console.error("dna-viral: falha ao invocar o agente", e);
  }

  return { conteudo: dnaViralCurado(respostas), origem: "curado" };
}

async function origemNoLimite(db: Db, ipHash: string | null): Promise<boolean> {
  if (!ipHash) return false;
  const desde = new Date(Date.now() - 3600_000).toISOString();

  const { count, error } = await db
    .from("oferta_leads")
    .select("id", { count: "exact", head: true })
    .eq("ip_hash", ipHash)
    .gte("relatorio_gerado_em", desde);

  // Falha na contagem não pode bloquear um lead legítimo.
  if (error) return false;
  return (count ?? 0) >= LIMITE_GERACOES_POR_HORA;
}

/**
 * Lê o relatório pelo token. É a única porta pública de leitura.
 *
 * Devolve o relatório e o primeiro nome — nunca o e-mail, nunca as respostas
 * cruas. Quem tem o link vê o diagnóstico, não o cadastro de quem respondeu.
 */
export const getDnaViral = createServerFn({ method: "GET" })
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data }) => {
    if (!data.token || data.token.length > 64) return null;

    const db = await admin();
    const { data: lead } = await db
      .from("oferta_leads")
      .select("relatorio, nome, email, relatorio_gerado_em")
      .eq("token", data.token)
      .maybeSingle();

    if (!lead?.relatorio) return null;

    const primeiroNome =
      String(lead.nome ?? "")
        .trim()
        .split(/\s+/)[0] ?? "";

    return {
      relatorio: lead.relatorio as DnaViral,
      primeiroNome,
      geradoEm: lead.relatorio_gerado_em as string | null,
      temEmail: Boolean(lead.email),
    };
  });

/** Guarda o e-mail de quem pediu para salvar o relatório. */
export const salvarEmailLead = createServerFn({ method: "POST" })
  .inputValidator((data: { token: string; email: string }) => data)
  .handler(async ({ data }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(email) || email.length > 254) {
      throw new Error("Confira o e-mail digitado.");
    }
    if (!data.token || data.token.length > 64) throw new Error("Link inválido.");

    const db = await admin();
    const { error } = await db
      .from("oferta_leads")
      .update({ email, atualizado_em: new Date().toISOString() })
      .eq("token", data.token);

    if (error) throw new Error("Não foi possível salvar. Tente de novo.");
    return { ok: true };
  });

/**
 * Dados públicos do plano para montar o CTA.
 *
 * `planos.checkout_url` só é legível hoje por server function autenticada, e
 * quem está no relatório é anônimo. Devolve só o que a página de oferta
 * precisa mostrar — nunca a linha inteira do plano.
 */
export const getOfertaPublica = createServerFn({ method: "GET" }).handler(async () => {
  const db = await admin();
  const { data: plano } = await db
    .from("planos")
    .select("nome, preco_mensal_centavos, checkout_url, codigo")
    .eq("publico", true)
    .eq("ativo", true)
    .order("ordem")
    .limit(1)
    .maybeSingle();

  if (!plano?.checkout_url) return null;

  return {
    nome: plano.nome as string,
    codigo: plano.codigo as string,
    precoCentavos: (plano.preco_mensal_centavos ?? null) as number | null,
    checkoutUrl: plano.checkout_url as string,
  };
});

// ---------------------------------------------------------------------------
// A costura pós-compra — a única função autenticada deste arquivo
// ---------------------------------------------------------------------------

/**
 * Traz as respostas do quiz para o onboarding da conta recém-criada.
 *
 * POR QUE AQUI E NÃO NO WEBHOOK DA KIWIFY: o webhook não cria contas. O
 * `resolverConta` de `kiwify.server.ts` só encontra conta que já existe, e na
 * hora em que o aviso de pagamento chega a pessoa normalmente ainda nem se
 * cadastrou. Quem cria a conta é `iniciarConta`, quando ela entra no
 * onboarding — então é aqui, e não lá, que dá para costurar com segurança.
 *
 * Duas formas de achar o lead, nesta ordem:
 *   1. O id que veio do navegador. É o caminho normal: quem comprou voltou
 *      para o app na mesma sessão, e o id continua no localStorage.
 *   2. O e-mail do usuário, contra o e-mail que ela deixou no relatório.
 *      Cobre quem respondeu o quiz no celular e se cadastrou no computador.
 *
 * Nunca sobrescreve: se o onboarding já foi concluído ou já tem respostas, sai
 * sem tocar em nada. E marca `importado_em` no lead, então reprocessar é
 * inofensivo.
 */
export const importarQuizParaOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { leadId?: string }) => data)
  .handler(async ({ data, context }) => {
    const vazio = { importado: false as const, resumo: [] as ReturnType<typeof resumoDoQuiz> };

    const { data: membro } = await context.supabase
      .from("conta_membros")
      .select("conta_id")
      .eq("user_id", context.userId)
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (!membro?.conta_id) return vazio;

    const db = await admin();

    const { data: existente } = await db
      .from("onboarding_respostas")
      .select("respostas, concluido_em")
      .eq("conta_id", membro.conta_id)
      .maybeSingle();

    // Onboarding fechado ou já em andamento: o que a pessoa fez no app manda.
    if (existente?.concluido_em) return vazio;
    if (existente?.respostas && Object.keys(existente.respostas).length > 0) return vazio;

    const lead = await acharLead(db, data.leadId, context.claims?.email as string | undefined);
    if (!lead) return vazio;

    const respostas = (lead.respostas ?? {}) as Respostas;
    if (!Object.keys(respostas).length) return vazio;

    const agora = new Date().toISOString();

    if (existente) {
      await db
        .from("onboarding_respostas")
        .update({ respostas, atualizado_em: agora })
        .eq("conta_id", membro.conta_id);
    } else {
      await db
        .from("onboarding_respostas")
        .insert({ conta_id: membro.conta_id, respostas, passo_atual: 1 });
    }

    await db
      .from("oferta_leads")
      .update({ conta_id: membro.conta_id, importado_em: agora, atualizado_em: agora })
      .eq("id", lead.id);

    return {
      importado: true as const,
      resumo: resumoDoQuiz(respostas),
    };
  });

async function acharLead(db: Db, leadId: string | undefined, email: string | undefined) {
  if (leadId && /^[0-9a-f-]{36}$/i.test(leadId)) {
    const { data } = await db
      .from("oferta_leads")
      .select("id, respostas")
      .eq("id", leadId)
      .maybeSingle();
    if (data) return data;
  }

  if (email) {
    const { data } = await db
      .from("oferta_leads")
      .select("id, respostas")
      .eq("email", email.toLowerCase())
      .is("conta_id", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }

  return null;
}
