/**
 * Regras de negócio dos avisos (webhooks) da Kiwify.
 * Server-only: usa o cliente administrativo do banco.
 */

import { randomBytes } from "crypto";

type AnyClient = any;

export type KiwifyEventoRow = {
  id?: string;
  evento: string;
  pedido_id: string | null;
  assinatura_externa_id: string | null;
  comprador_email: string | null;
  conta_id: string | null;
  /** Lead do quiz da oferta, se a compra veio de la. */
  lead_id: string | null;
  plano_codigo: string | null;
  valor_centavos: number | null;
  payload: Record<string, any>;
};

const APROVA = new Set([
  "order_approved",
  "order_paid",
  "subscription_renewed",
  "subscription_reactivated",
]);
const ATRASA = new Set(["order_rejected", "pix_created", "billet_created", "subscription_late"]);
const ENCERRA = new Set([
  "order_refunded",
  "chargeback",
  "subscription_canceled",
  "subscription_cancelled",
]);

function centavos(payload: Record<string, any>): number {
  const raw =
    payload?.Commissions?.charge_amount ??
    payload?.commissions?.charge_amount ??
    payload?.charge_amount ??
    payload?.Subscription?.plan?.amount ??
    0;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return 0;
  // Kiwify envia valores em centavos; se vier com decimais, trata como reais.
  return Number.isInteger(n) ? n : Math.round(n * 100);
}

/** Extrai os campos que o sistema usa de um payload cru da Kiwify. */
export function normalizarEventoKiwify(payload: Record<string, any>): KiwifyEventoRow {
  const tracking = payload?.TrackingParameters ?? payload?.tracking ?? {};
  return {
    evento: String(
      payload?.webhook_event_type ?? payload?.event ?? payload?.order_status ?? "desconhecido",
    ),
    pedido_id: payload?.order_id ?? payload?.order_ref ?? payload?.id ?? null,
    assinatura_externa_id: payload?.Subscription?.id ?? payload?.subscription_id ?? null,
    comprador_email:
      payload?.Customer?.email ?? payload?.customer?.email ?? payload?.buyer_email ?? null,
    conta_id: tracking?.s1 && String(tracking.s1).length === 36 ? String(tracking.s1) : null,
    // s3 e o lead do quiz da oferta. Nao pode ser s1: aquele campo vira
    // conta_id sempre que tem 36 caracteres, e um randomUUID tem exatamente 36.
    lead_id: tracking?.s3 && String(tracking.s3).length === 36 ? String(tracking.s3) : null,
    plano_codigo: tracking?.s2 ? String(tracking.s2) : null,
    valor_centavos: centavos(payload),
    payload,
  };
}

async function resolverPlano(admin: AnyClient, evento: KiwifyEventoRow): Promise<string | null> {
  if (evento.plano_codigo) {
    const { data } = await admin
      .from("planos")
      .select("codigo")
      .eq("codigo", evento.plano_codigo)
      .maybeSingle();
    if (data) return data.codigo;
  }
  const produtoId = evento.payload?.Product?.product_id ?? evento.payload?.product_id ?? null;
  const ofertaId = evento.payload?.Subscription?.plan?.id ?? evento.payload?.offer_id ?? null;
  const { data: planos } = await admin
    .from("planos")
    .select("codigo, kiwify_produto_id, kiwify_oferta_id")
    .eq("ativo", true);
  const match = (planos ?? []).find(
    (p: any) =>
      (ofertaId && p.kiwify_oferta_id && p.kiwify_oferta_id === String(ofertaId)) ||
      (produtoId && p.kiwify_produto_id && p.kiwify_produto_id === String(produtoId)),
  );
  return match?.codigo ?? null;
}

/**
 * Fecha o funil: carimba o lead do quiz que virou compra.
 *
 * Idempotente (so escreve se ainda nao comprou) e silenciosa: falhar aqui nao
 * pode derrubar o processamento de um pagamento.
 */
async function marcarLeadComprou(admin: AnyClient, evento: KiwifyEventoRow) {
  if (!evento.lead_id) return;
  if (!APROVA.has(evento.evento.toLowerCase())) return;
  try {
    await admin
      .from("oferta_leads")
      .update({
        comprou_em: new Date().toISOString(),
        pedido_id: evento.pedido_id,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", evento.lead_id)
      .is("comprou_em", null);
  } catch (e) {
    console.error("kiwify: falha ao marcar lead como comprado", e);
  }
}

/**
 * Cria a conta de quem comprou, no aviso de pagamento aprovado.
 *
 * A senha nasce aleatoria e nao e revelada a ninguem: o comprador define a
 * dele na tela de boas-vindas, para onde a pagina de obrigado da Kiwify
 * aponta. O e-mail ja nasce confirmado porque a confirmacao depende de SMTP e
 * transformaria a primeira impressao pos-compra num chamado de suporte.
 *
 * Se o comprador ja tem usuario (comprou de novo, ou foi convidado antes),
 * reaproveita em vez de criar um segundo.
 *
 * Nunca lanca: falhar aqui nao pode derrubar o processamento do pagamento. O
 * evento fica registrado como nao processado e pode ser reprocessado no painel.
 */
async function criarContaDoComprador(
  admin: AnyClient,
  evento: KiwifyEventoRow,
): Promise<string | null> {
  const email = evento.comprador_email?.trim().toLowerCase();
  if (!email) return null;

  try {
    let userId = await acharUsuarioPorEmail(admin, email);

    if (!userId) {
      const { data: criado, error } = await admin.auth.admin.createUser({
        email,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
      });
      if (error) {
        console.error("kiwify: falha ao criar usuario do comprador", error.message);
        return null;
      }
      userId = criado?.user?.id ?? null;
    }

    if (!userId) return null;

    // Mesmo caminho do cadastro normal, e idempotente: devolve a conta que ja
    // existir em vez de criar uma segunda.
    const { data: contaId, error: erroConta } = await admin.rpc("iniciar_conta_trial", {
      _user_id: userId,
      _nome: email.split("@")[0] ?? "Minha conta",
      _plano: evento.plano_codigo ?? "starter",
    });
    if (erroConta) {
      console.error("kiwify: falha ao iniciar conta do comprador", erroConta.message);
      return null;
    }

    await prepararAcesso(admin, evento, String(contaId));
    return String(contaId);
  } catch (e) {
    console.error("kiwify: erro ao criar conta do comprador", e);
    return null;
  }
}

async function acharUsuarioPorEmail(admin: AnyClient, email: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = (data?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email);
    return user?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Liga o lead do quiz a conta recem-criada e semeia o onboarding.
 *
 * E aqui que a promessa de nao responder duas vezes se cumpre para quem veio
 * pelo funil: as respostas do quiz viram o onboarding da conta antes mesmo de
 * a pessoa entrar. Quem comprou sem passar pelo quiz nao tem lead, e este
 * passo simplesmente nao faz nada.
 *
 * O carimbo em conta_criada_em abre a janela em que a tela de boas-vindas
 * aceita definir a senha.
 */
async function prepararAcesso(admin: AnyClient, evento: KiwifyEventoRow, contaId: string) {
  const agora = new Date().toISOString();

  let lead: { id: string; respostas: Record<string, unknown>; importado_em: string | null } | null =
    null;

  if (evento.lead_id) {
    const { data } = await admin
      .from("oferta_leads")
      .select("id, respostas, importado_em")
      .eq("id", evento.lead_id)
      .maybeSingle();
    lead = data ?? null;
  }

  if (!lead && evento.comprador_email) {
    const { data } = await admin
      .from("oferta_leads")
      .select("id, respostas, importado_em")
      .eq("email", evento.comprador_email.toLowerCase())
      .is("conta_id", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    lead = data ?? null;
  }

  if (!lead) return;

  await admin
    .from("oferta_leads")
    .update({ conta_id: contaId, conta_criada_em: agora, atualizado_em: agora })
    .eq("id", lead.id);

  const respostas = (lead.respostas ?? {}) as Record<string, unknown>;
  if (lead.importado_em || !Object.keys(respostas).length) return;

  // Nao sobrescreve: se a conta ja tem onboarding em andamento, o que a pessoa
  // fez dentro do app manda.
  const { data: existente } = await admin
    .from("onboarding_respostas")
    .select("conta_id, respostas, concluido_em")
    .eq("conta_id", contaId)
    .maybeSingle();

  if (existente?.concluido_em) return;
  if (existente?.respostas && Object.keys(existente.respostas).length > 0) return;

  if (existente) {
    await admin
      .from("onboarding_respostas")
      .update({ respostas, atualizado_em: agora })
      .eq("conta_id", contaId);
  } else {
    await admin
      .from("onboarding_respostas")
      .insert({ conta_id: contaId, respostas, passo_atual: 1 });
  }

  await admin.from("oferta_leads").update({ importado_em: agora }).eq("id", lead.id);
}

async function resolverConta(admin: AnyClient, evento: KiwifyEventoRow): Promise<string | null> {
  if (evento.conta_id) return evento.conta_id;

  if (evento.assinatura_externa_id) {
    const { data } = await admin
      .from("assinaturas")
      .select("conta_id")
      .eq("kiwify_assinatura_id", evento.assinatura_externa_id)
      .maybeSingle();
    if (data) return data.conta_id;
  }

  if (evento.comprador_email) {
    const email = evento.comprador_email.toLowerCase();
    const { data: porEmail } = await admin
      .from("assinaturas")
      .select("conta_id")
      .ilike("comprador_email", email)
      .maybeSingle();
    if (porEmail) return porEmail.conta_id;

    // Busca o usuário pelo e-mail e a conta em que ele é membro.
    const { data: lista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const user = (lista?.users ?? []).find((u: any) => (u.email ?? "").toLowerCase() === email);
    if (user) {
      const { data: membro } = await admin
        .from("conta_membros")
        .select("conta_id")
        .eq("user_id", user.id)
        .order("criado_em")
        .limit(1)
        .maybeSingle();
      if (membro) return membro.conta_id;
    }
  }
  return null;
}

/**
 * Aplica um evento já gravado: move a assinatura da conta conforme o tipo do aviso.
 * Idempotente — reprocessar o mesmo evento leva ao mesmo estado final.
 */
export async function aplicarEventoKiwify(admin: AnyClient, evento: KiwifyEventoRow) {
  // Antes de qualquer coisa: registrar que este lead comprou.
  //
  // Vem primeiro porque a funcao desiste logo abaixo quando nao acha a conta,
  // e nao achar e o caso NORMAL -- o aviso de pagamento chega antes de a
  // pessoa se cadastrar. Se a marcacao ficasse depois, a conversao do funil
  // nunca seria registrada justamente nas compras que deram certo.
  await marcarLeadComprou(admin, evento);

  let contaId = await resolverConta(admin, evento);

  /*
   * Ninguem se cadastra sozinho neste app: o cadastro publico esta desligado
   * no Auth. Entao quem acabou de pagar depende de a conta nascer aqui --
   * antes disto, o pagamento era registrado e o comprador ficava sem
   * conseguir entrar. Restrito a evento de aprovacao: pix gerado e boleto
   * emitido ainda nao sao compra.
   */
  if (!contaId && APROVA.has(evento.evento.toLowerCase())) {
    contaId = await criarContaDoComprador(admin, evento);
  }

  if (!contaId) {
    await marcar(admin, evento, false, "Conta não identificada para este pagamento.");
    return { ok: false, motivo: "conta_nao_identificada" as const };
  }
  const planoCodigo = await resolverPlano(admin, evento);
  const tipo = evento.evento.toLowerCase();
  const agora = new Date();

  const patch: Record<string, unknown> = {
    comprador_email: evento.comprador_email,
    kiwify_assinatura_id: evento.assinatura_externa_id,
    kiwify_pedido_id: evento.pedido_id,
    origem: "kiwify",
  };

  if (APROVA.has(tipo)) {
    const proxima = new Date(agora);
    proxima.setMonth(proxima.getMonth() + 1);
    patch["situacao"] = "ativa";
    patch["cancelada_em"] = null;
    patch["proxima_renovacao"] = proxima.toISOString();
    if (evento.valor_centavos) patch["valor_centavos"] = evento.valor_centavos;
    if (planoCodigo) patch["plano_codigo"] = planoCodigo;
    if (planoCodigo) {
      await admin
        .from("contas")
        .update({ plano_codigo: planoCodigo, status: "ativa" })
        .eq("id", contaId);
    } else {
      await admin.from("contas").update({ status: "ativa" }).eq("id", contaId);
    }
  } else if (ATRASA.has(tipo)) {
    patch["situacao"] = "atrasada";
  } else if (ENCERRA.has(tipo)) {
    patch["situacao"] = "cancelada";
    patch["cancelada_em"] = agora.toISOString();
    await admin.from("contas").update({ plano_codigo: "free" }).eq("id", contaId);
  } else {
    await marcar(admin, evento, false, `Tipo de evento não tratado: ${evento.evento}`);
    return { ok: false, motivo: "evento_ignorado" as const };
  }

  const { data: existente } = await admin
    .from("assinaturas")
    .select("id")
    .eq("conta_id", contaId)
    .maybeSingle();

  if (existente) {
    await admin.from("assinaturas").update(patch).eq("conta_id", contaId);
  } else {
    await admin.from("assinaturas").insert({
      conta_id: contaId,
      plano_codigo: planoCodigo ?? "free",
      ...patch,
    });
  }

  await marcar(admin, evento, true, null, contaId, planoCodigo);
  return { ok: true, contaId, planoCodigo, situacao: String(patch["situacao"] ?? "") };
}

async function marcar(
  admin: AnyClient,
  evento: KiwifyEventoRow,
  processado: boolean,
  erro: string | null,
  contaId?: string | null,
  planoCodigo?: string | null,
) {
  if (!evento.id) return;
  await admin
    .from("kiwify_eventos")
    .update({
      processado,
      erro,
      processado_em: new Date().toISOString(),
      ...(contaId ? { conta_id: contaId } : {}),
      ...(planoCodigo ? { plano_codigo: planoCodigo } : {}),
    })
    .eq("id", evento.id);
}
