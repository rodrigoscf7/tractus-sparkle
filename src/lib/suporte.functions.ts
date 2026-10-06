import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";
import { LIMITE_MENSAGENS_DIA, type AcaoSuporte, type MensagemSuporte } from "@/lib/suporte";

/**
 * Chat do assistente de suporte.
 *
 * Conversas e mensagens só são lidas pelo dono (RLS) e só são escritas aqui,
 * com service role. A conta e o usuário vêm sempre da sessão; o suporte-agent
 * recebe os dois desta camada, nunca do navegador.
 */

async function admin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

async function contaDoUsuario(supabase: SupabaseClient<Database>, userId: string): Promise<string> {
  const { data: membro } = await supabase
    .from("conta_membros")
    .select("conta_id")
    .eq("user_id", userId)
    .order("criado_em")
    .limit(1)
    .maybeSingle();
  if (!membro?.conta_id) throw new Error("Seu usuário ainda não está vinculado a uma conta.");
  return membro.conta_id;
}

const CAMPOS_MENSAGEM = "id, papel, conteudo, acao, criado_em";

/** A conversa em andamento do usuário (aberta ou encaminhada), com as mensagens. */
export const carregarConversaSuporte = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: conversa } = await context.supabase
      .from("suporte_conversas")
      .select("id, status")
      .eq("user_id", context.userId)
      .neq("status", "encerrada")
      .order("atualizado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!conversa) return { conversaId: null as string | null, mensagens: [] as MensagemSuporte[] };

    const { data: mensagens } = await context.supabase
      .from("suporte_mensagens")
      .select(CAMPOS_MENSAGEM)
      .eq("conversa_id", conversa.id)
      .order("criado_em")
      .limit(100);
    return {
      conversaId: conversa.id as string | null,
      mensagens: (mensagens ?? []) as unknown as MensagemSuporte[],
    };
  });

/** Envia uma pergunta e devolve a mensagem da pessoa e a resposta do assistente. */
export const enviarMensagemSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversaId?: string | null; texto: string; rota?: string }) => ({
    conversaId: data.conversaId ?? null,
    texto: String(data.texto ?? "")
      .trim()
      .slice(0, 1000),
    rota: String(data.rota ?? "").slice(0, 120),
  }))
  .handler(async ({ data, context }) => {
    if (!data.texto) throw new Error("Escreva sua pergunta.");
    const contaId = await contaDoUsuario(context.supabase, context.userId);
    const db = await admin();

    // Limite diário por usuário, contado nas conversas dele.
    const desde = new Date(Date.now() - 86_400_000).toISOString();
    const { count } = await db
      .from("suporte_mensagens")
      .select("id, suporte_conversas!inner(user_id)", { count: "exact", head: true })
      .eq("papel", "usuario")
      .eq("suporte_conversas.user_id", context.userId)
      .gte("criado_em", desde);
    if ((count ?? 0) >= LIMITE_MENSAGENS_DIA) {
      throw new Error(
        "Você chegou ao limite de mensagens do assistente por hoje. Se for urgente, fale com o suporte pelo WhatsApp.",
      );
    }

    // Conversa: a informada, se for do usuário e estiver em andamento; senão, uma nova.
    let conversaId: string | null = null;
    if (data.conversaId) {
      const { data: conversa } = await context.supabase
        .from("suporte_conversas")
        .select("id")
        .eq("id", data.conversaId)
        .eq("user_id", context.userId)
        .neq("status", "encerrada")
        .maybeSingle();
      conversaId = (conversa?.id as string | undefined) ?? null;
    }
    if (!conversaId) {
      const { data: nova, error } = await db
        .from("suporte_conversas")
        .insert({ conta_id: contaId, user_id: context.userId })
        .select("id")
        .single();
      if (error || !nova) throw new Error("Não consegui abrir a conversa. Tente de novo.");
      conversaId = nova.id;
    }

    const { data: pergunta, error: erroPergunta } = await db
      .from("suporte_mensagens")
      .insert({ conversa_id: conversaId, papel: "usuario", conteudo: data.texto })
      .select(CAMPOS_MENSAGEM)
      .single();
    if (erroPergunta || !pergunta) throw new Error("Não consegui enviar. Tente de novo.");

    const { invocarAgente } = await import("@/lib/agentes.server");
    const resposta = await invocarAgente<{ mensagem?: MensagemSuporte }>(
      "suporte-agent",
      { conversa_id: conversaId, conta_id: contaId, user_id: context.userId, rota: data.rota },
      { timeoutMs: 60_000 },
    );

    let respostaMsg = resposta.data?.mensagem ?? null;
    if (!resposta.ok || !respostaMsg) {
      console.error("suporte-agent falhou", resposta.status, resposta.erro);
      const { data: falha } = await db
        .from("suporte_mensagens")
        .insert({
          conversa_id: conversaId,
          papel: "assistente",
          conteudo:
            "Não consegui responder agora. Tente de novo em instantes ou fale com uma pessoa pelo WhatsApp.",
        })
        .select(CAMPOS_MENSAGEM)
        .single();
      respostaMsg = (falha as unknown as MensagemSuporte) ?? null;
    }

    return {
      conversaId,
      mensagens: [pergunta as unknown as MensagemSuporte, respostaMsg].filter(
        Boolean,
      ) as MensagemSuporte[],
    };
  });

/**
 * Confirma ou cancela a ação proposta numa mensagem do assistente.
 *
 * A ação é lida do banco e marcada como 'executando' numa atualização
 * condicional antes de rodar: dois toques em Confirmar executam uma vez só.
 */
export const responderAcaoSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { mensagemId: string; confirmar: boolean }) => data)
  .handler(async ({ data, context }) => {
    // Leitura com o client do usuário: se a mensagem não é dele, nada volta.
    const { data: mensagem } = await context.supabase
      .from("suporte_mensagens")
      .select("id, acao, conversa_id")
      .eq("id", data.mensagemId)
      .maybeSingle();
    const acao = mensagem?.acao as AcaoSuporte | null | undefined;
    if (!mensagem || !acao) throw new Error("Ação não encontrada.");
    if (acao.status !== "proposta") return { acao };

    const db = await admin();
    const salvar = async (novo: AcaoSuporte) => {
      await db
        .from("suporte_mensagens")
        .update({ acao: novo as never })
        .eq("id", mensagem.id);
      return novo;
    };

    if (!data.confirmar) {
      return { acao: await salvar({ ...acao, status: "cancelada", resultado: "Cancelado." }) };
    }

    const { data: reservada } = await db
      .from("suporte_mensagens")
      .update({ acao: { ...acao, status: "executando" } as never })
      .eq("id", mensagem.id)
      .eq("acao->>status", "proposta")
      .select("id")
      .maybeSingle();
    if (!reservada) return { acao: { ...acao, status: "executando" as const } };

    const contaId = await contaDoUsuario(context.supabase, context.userId);
    const { executarAcao } = await import("@/lib/suporte.server");
    try {
      const resultado = await executarAcao(
        {
          supabase: context.supabase,
          userId: context.userId,
          contaId,
          conversaId: mensagem.conversa_id,
        },
        acao,
      );
      return { acao: await salvar({ ...acao, status: "executada", resultado }) };
    } catch (e) {
      const resultado = e instanceof Error ? e.message : "Não consegui fazer isso agora.";
      return { acao: await salvar({ ...acao, status: "erro", resultado }) };
    }
  });

/** Encerra a conversa atual: a próxima pergunta começa uma nova. */
export const novaConversaSuporte = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversaId: string | null }) => data)
  .handler(async ({ data, context }) => {
    if (!data.conversaId) return { ok: true as const };
    const db = await admin();
    await db
      .from("suporte_conversas")
      .update({ status: "encerrada", atualizado_em: new Date().toISOString() })
      .eq("id", data.conversaId)
      .eq("user_id", context.userId);
    return { ok: true as const };
  });
