import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/billing.functions";
import { digitosWhatsapp, emailValido, whatsappValido } from "@/lib/quiz-oferta";

/**
 * O link de convite (/convite/<codigo>): a pessoa preenche nome, e-mail,
 * WhatsApp e senha, e a conta nasce na hora com a cortesia do convite.
 *
 * O cadastro público continua desligado no Auth; quem cria o usuário é o
 * servidor, e só para um código ativo, dentro da validade e do limite de usos.
 * Cada origem (hash do IP) tem um teto de contas por hora, contra robôs.
 */

const RESGATES_POR_HORA_POR_ORIGEM = 5;
const CODIGO_RE = /^[a-z0-9-]{3,40}$/;

async function admin(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

type Convite = {
  id: string;
  codigo: string;
  descricao: string | null;
  plano_codigo: string;
  dias_cortesia: number;
  usos_max: number | null;
  usos: number;
  expira_em: string | null;
  ativo: boolean;
  criado_em: string;
};

export type EstadoConvite =
  { estado: "valido"; dias: number } | { estado: "invalido" | "expirado" | "esgotado" };

function avaliar(c: Convite | null): EstadoConvite {
  if (!c || !c.ativo) return { estado: "invalido" };
  if (c.expira_em && new Date(c.expira_em).getTime() <= Date.now()) return { estado: "expirado" };
  if (c.usos_max !== null && c.usos >= c.usos_max) return { estado: "esgotado" };
  return { estado: "valido", dias: c.dias_cortesia };
}

async function buscarConvite(codigo: string): Promise<Convite | null> {
  const db = await admin();
  const { data } = await db.from("convites").select("*").eq("codigo", codigo).maybeSingle();
  return (data as Convite | null) ?? null;
}

const normalizarCodigo = (bruto: string) =>
  String(bruto ?? "")
    .trim()
    .toLowerCase();

/** O que a página do convite mostra: o formulário ou por que o link não vale mais. */
export const estadoDoConvite = createServerFn({ method: "GET" })
  .inputValidator((data: { codigo: string }) => data)
  .handler(async ({ data }): Promise<EstadoConvite> => {
    const codigo = normalizarCodigo(data.codigo);
    if (!CODIGO_RE.test(codigo)) return { estado: "invalido" };
    return avaliar(await buscarConvite(codigo));
  });

/** Cria a conta pelo convite. A senha é a que a pessoa escolheu; depois ela entra sozinha. */
export const resgatarConvite = createServerFn({ method: "POST" })
  .inputValidator(
    (data: { codigo: string; nome: string; email: string; whatsapp: string; senha: string }) =>
      data,
  )
  .handler(async ({ data }) => {
    const codigo = normalizarCodigo(data.codigo);
    const nome = String(data.nome ?? "")
      .trim()
      .slice(0, 120);
    const email = String(data.email ?? "")
      .trim()
      .toLowerCase();
    const senha = String(data.senha ?? "");

    if (!CODIGO_RE.test(codigo)) throw new Error("Este convite não é válido.");
    if (nome.length < 2) throw new Error("Escreva o seu nome.");
    if (!emailValido(email)) throw new Error("Confira o e-mail digitado.");
    if (!whatsappValido(data.whatsapp ?? "")) throw new Error("Confira o WhatsApp, com DDD.");
    if (senha.length < 8) throw new Error("A senha precisa de pelo menos 8 caracteres.");
    if (senha.length > 72) throw new Error("A senha é longa demais.");

    const situacao = avaliar(await buscarConvite(codigo));
    if (situacao.estado === "expirado") throw new Error("Este convite expirou.");
    if (situacao.estado === "esgotado") throw new Error("As vagas deste convite acabaram.");
    if (situacao.estado !== "valido") throw new Error("Este convite não é válido.");

    const db = await admin();
    const { hashDaOrigem } = await import("@/lib/origem.server");
    const origem = hashDaOrigem();
    if (origem) {
      const umaHoraAtras = new Date(Date.now() - 3600_000).toISOString();
      const { count } = await db
        .from("convite_resgates")
        .select("id", { count: "exact", head: true })
        .eq("origem_hash", origem)
        .gte("criado_em", umaHoraAtras);
      if ((count ?? 0) >= RESGATES_POR_HORA_POR_ORIGEM) {
        throw new Error("Muitas contas criadas daqui agora há pouco. Tente de novo mais tarde.");
      }
    }

    // Reserva o uso antes de criar a conta: dois resgates simultâneos não
    // passam do limite. Se a conta falhar, o uso volta.
    const { data: reservado } = await db.rpc("reservar_convite", { _codigo: codigo });
    const convite = reservado as Convite | null;
    if (!convite?.id) throw new Error("Este convite não está mais disponível.");

    const { criarContaCortesia, EmailJaCadastrado } = await import("@/lib/cortesia.server");
    let criada: { userId: string; contaId: string };
    try {
      criada = await criarContaCortesia(db, {
        email,
        senha,
        nome,
        plano: convite.plano_codigo,
        dias: convite.dias_cortesia,
        origem: "cortesia",
        observacao: `Convite ${convite.codigo} em ${new Date().toLocaleDateString("pt-BR")}`,
      });
    } catch (erro) {
      await db.rpc("liberar_convite", { _id: convite.id });
      if (erro instanceof EmailJaCadastrado) {
        throw new Error(
          "Já existe uma conta com esse e-mail. Entre com ele ou use 'esqueci minha senha'.",
        );
      }
      console.error("convite: não criou a conta", erro);
      throw new Error("Não foi possível criar a sua conta agora. Tente de novo em instantes.");
    }

    await db.from("convite_resgates").insert({
      convite_id: convite.id,
      conta_id: criada.contaId,
      user_id: criada.userId,
      nome,
      email,
      whatsapp: digitosWhatsapp(data.whatsapp),
      origem_hash: origem,
    });

    return { email, dias: convite.dias_cortesia };
  });

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type ConviteComResgates = Convite & {
  resgates: { nome: string | null; email: string; whatsapp: string | null; criado_em: string }[];
};

export const listarConvites = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ConviteComResgates[]> => {
    await assertAdmin(context.supabase as any, context.userId);
    const db = await admin();
    const { data: convites } = await db
      .from("convites")
      .select("*")
      .order("criado_em", { ascending: false });
    const { data: resgates } = await db
      .from("convite_resgates")
      .select("convite_id, nome, email, whatsapp, criado_em")
      .order("criado_em", { ascending: false })
      .limit(500);
    return ((convites ?? []) as Convite[]).map((c) => ({
      ...c,
      resgates: ((resgates ?? []) as any[]).filter((r) => r.convite_id === c.id),
    }));
  });

/** Cria um convite (sem `id`) ou altera um existente: validade, limite e se está ativo. */
export const salvarConvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      id?: string;
      codigo?: string;
      descricao?: string;
      diasCortesia?: number;
      usosMax?: number | null;
      expiraEm?: string | null;
      ativo?: boolean;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const db = await admin();

    const valores: Record<string, unknown> = {};
    if (data.descricao !== undefined) valores.descricao = data.descricao.trim() || null;
    if (data.diasCortesia !== undefined) {
      if (!(data.diasCortesia >= 1 && data.diasCortesia <= 365))
        throw new Error("Cortesia de 1 a 365 dias.");
      valores.dias_cortesia = Math.round(data.diasCortesia);
    }
    if (data.usosMax !== undefined) {
      if (data.usosMax !== null && !(data.usosMax >= 1))
        throw new Error("Limite de usos inválido.");
      valores.usos_max = data.usosMax;
    }
    if (data.expiraEm !== undefined) valores.expira_em = data.expiraEm || null;
    if (data.ativo !== undefined) valores.ativo = data.ativo;

    if (data.id) {
      const { error } = await db.from("convites").update(valores).eq("id", data.id);
      if (error) throw new Error(error.message);
    } else {
      const codigo = normalizarCodigo(data.codigo ?? "");
      if (!CODIGO_RE.test(codigo)) {
        throw new Error("Código com 3 a 40 caracteres: letras minúsculas, números e hífen.");
      }
      const { error } = await db
        .from("convites")
        .insert({ ...valores, codigo, criado_por: context.userId });
      if (error) {
        if (/duplicate|unique/i.test(error.message))
          throw new Error("Já existe um convite com esse código.");
        throw new Error(error.message);
      }
    }

    await db.from("admin_acoes").insert({
      ator_user_id: context.userId,
      conta_id: null,
      acao: data.id ? "convite_editado" : "convite_criado",
      detalhes: { ...data },
    });
    return { ok: true };
  });
