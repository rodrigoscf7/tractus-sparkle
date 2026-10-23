/**
 * Regras de negócio dos avisos (webhooks v2) da Hubla.
 * Server-only: usa o cliente administrativo do banco.
 *
 * Eventos: https://hubla.gitbook.io/docs/webhooks/eventos.md
 * Quem libera e renova o acesso é a fatura paga (invoice.payment_succeeded);
 * quem encerra é o reembolso, o chargeback e a assinatura desativada (sem
 * créditos, depois de a renovação ter sido desligada ou de a cobrança falhar).
 */

import { randomBytes } from "crypto";

type AnyClient = any;

export type HublaEventoRow = {
  id?: string;
  evento: string;
  /** Identificador do aviso (header x-hubla-idempotency): deduplica reenvios. */
  idempotencia: string | null;
  fatura_id: string | null;
  assinatura_externa_id: string | null;
  comprador_email: string | null;
  comprador_nome: string | null;
  /** Conta do app, quando o checkout veio do botão "Assinar" (sck=c-<uuid>). */
  conta_id: string | null;
  /** Lead do quiz da oferta (sck=<uuid>). */
  lead_id: string | null;
  oferta_id: string | null;
  /** Todos os produtos e ofertas do aviso: com order bump, vem mais de um. */
  produto_ids: string[];
  oferta_ids: string[];
  /** Meses por ciclo da assinatura recorrente do aviso (1 mensal, 12 anual). */
  ciclo_meses: number | null;
  valor_centavos: number | null;
  payload: Record<string, any>;
};

const APROVA = new Set(["invoice.payment_succeeded"]);
const ATRASA = new Set(["invoice.payment_failed", "invoice.expired"]);
const ENCERRA = new Set(["invoice.refunded", "subscription.deactivated"]);

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** O tipo do evento, com o chargeback (que só chega como mudança de status) à parte. */
function tipoEfetivo(e: HublaEventoRow): string {
  const tipo = e.evento.toLowerCase();
  if (tipo === "invoice.status_updated") {
    const status = String(e.payload?.event?.invoice?.status ?? "").toLowerCase();
    if (status === "chargeback") return "invoice.chargeback";
  }
  return tipo;
}

function encerra(tipo: string): boolean {
  return ENCERRA.has(tipo) || tipo === "invoice.chargeback";
}

/** Lê `sck` dos parâmetros da sessão de pagamento ou da URL do checkout. */
function sckDa(sessao: any): string | null {
  const params = (sessao?.params ?? {}) as Record<string, unknown>;
  const direto = Object.entries(params).find(([k]) => k.toLowerCase() === "sck")?.[1];
  if (typeof direto === "string" && direto) return direto;
  try {
    const url = sessao?.url ? new URL(String(sessao.url)) : null;
    return url?.searchParams.get("sck") ?? url?.searchParams.get("SCK") ?? null;
  } catch {
    return null;
  }
}

/** Extrai os campos que o sistema usa de um payload cru da Hubla. */
export function normalizarEventoHubla(
  payload: Record<string, any>,
  idempotencia: string | null = null,
): HublaEventoRow {
  const ev = payload?.event ?? {};
  const fatura = ev.invoice ?? ev.subscription?.lastInvoice ?? null;
  const sessao =
    fatura?.paymentSession ??
    fatura?.firstPaymentSession ??
    ev.subscription?.firstPaymentSession ??
    null;
  const sck = sckDa(sessao)?.trim() ?? "";
  const contaSck = sck.toLowerCase().startsWith("c-") ? sck.slice(2) : "";

  const nome = [ev.user?.firstName, ev.user?.lastName].filter(Boolean).join(" ").trim();
  const email = ev.user?.email ?? fatura?.payer?.email ?? null;
  const centavos = Number(fatura?.amount?.totalCents);

  const produtos = [ev.product, ...(Array.isArray(ev.products) ? ev.products : [])].filter(Boolean);
  const ids = (lista: unknown[]) => [
    ...new Set(lista.filter((v): v is string => typeof v === "string" && v.length > 0)),
  ];

  // Material de order bump chega como assinatura "one_time": a do plano é a recorrente.
  const assinaturas = [
    ev.subscription,
    ...(Array.isArray(ev.subscriptions) ? ev.subscriptions : []),
  ].filter(Boolean);
  const recorrente = assinaturas.find((s: any) => s?.type !== "one_time") ?? null;
  const ciclo = Number(recorrente?.billingCycleMonths);

  return {
    evento: String(payload?.type ?? "desconhecido"),
    idempotencia,
    fatura_id: fatura?.id ?? null,
    assinatura_externa_id:
      recorrente?.id ??
      fatura?.subscriptionId ??
      ev.subscription?.id ??
      ev.subscriptions?.[0]?.id ??
      null,
    comprador_email: email ? String(email).trim().toLowerCase() : null,
    comprador_nome: nome || null,
    conta_id: UUID.test(contaSck) ? contaSck : null,
    lead_id: UUID.test(sck) ? sck : null,
    oferta_id: ev.products?.[0]?.offers?.[0]?.id ?? null,
    produto_ids: ids(produtos.map((p: any) => p?.id)),
    oferta_ids: ids(
      produtos.flatMap((p: any) =>
        (Array.isArray(p?.offers) ? p.offers : []).map((o: any) => o?.id),
      ),
    ),
    ciclo_meses: Number.isInteger(ciclo) && ciclo > 0 ? ciclo : null,
    valor_centavos: Number.isFinite(centavos) && centavos > 0 ? Math.round(centavos) : null,
    payload,
  };
}

/** O plano do aviso e o ciclo de cobrança (a oferta anual é do mesmo produto). */
async function resolverPlano(
  admin: AnyClient,
  evento: HublaEventoRow,
): Promise<{ codigo: string; cicloMeses: number; precoAnualCentavos: number | null } | null> {
  const { data: planos } = await admin
    .from("planos")
    .select(
      "codigo, hubla_oferta_id, hubla_oferta_anual_id, hubla_produto_id, preco_anual_centavos",
    )
    .eq("ativo", true);
  const temOferta = (id: string | null) => !!id && evento.oferta_ids.includes(id);
  const match = (planos ?? []).find(
    (p: any) =>
      temOferta(p.hubla_oferta_id) ||
      temOferta(p.hubla_oferta_anual_id) ||
      (!!p.hubla_produto_id && evento.produto_ids.includes(p.hubla_produto_id)),
  );
  if (!match) return null;
  return {
    codigo: match.codigo,
    cicloMeses: evento.ciclo_meses ?? (temOferta(match.hubla_oferta_anual_id) ? 12 : 1),
    precoAnualCentavos: match.preco_anual_centavos ?? null,
  };
}

/** Materiais (order bumps) que vieram no aviso. */
async function resolverMateriais(admin: AnyClient, evento: HublaEventoRow): Promise<string[]> {
  const { data: materiais } = await admin
    .from("materiais")
    .select("codigo, hubla_produto_id, hubla_oferta_id");
  return (materiais ?? [])
    .filter(
      (m: any) =>
        (!!m.hubla_oferta_id && evento.oferta_ids.includes(m.hubla_oferta_id)) ||
        (!!m.hubla_produto_id && evento.produto_ids.includes(m.hubla_produto_id)),
    )
    .map((m: any) => String(m.codigo));
}

/**
 * Libera os materiais na fatura paga e revoga no reembolso ou chargeback.
 * A assinatura desativada não mexe neles: material é pagamento único.
 */
async function aplicarMateriais(
  admin: AnyClient,
  evento: HublaEventoRow,
  tipo: string,
  contaId: string,
  codigos: string[],
) {
  if (!codigos.length) return;
  const agora = new Date().toISOString();
  if (APROVA.has(tipo)) {
    await admin.from("conta_materiais").upsert(
      codigos.map((codigo) => ({
        conta_id: contaId,
        material_codigo: codigo,
        origem: "hubla",
        hubla_fatura_id: evento.fatura_id,
        revogado_em: null,
      })),
      { onConflict: "conta_id,material_codigo" },
    );
  } else if (tipo === "invoice.refunded" || tipo === "invoice.chargeback") {
    await admin
      .from("conta_materiais")
      .update({ revogado_em: agora })
      .eq("conta_id", contaId)
      .eq("origem", "hubla")
      .in("material_codigo", codigos);
  }
}

/**
 * Acha o lead do quiz desta compra: pelo `sck` do checkout e, sem ele, pelo
 * e-mail (o checkout chega com o e-mail do quiz pré-preenchido).
 */
async function acharLead(admin: AnyClient, evento: HublaEventoRow) {
  const colunas = "id, respostas, importado_em, comprou_em, conta_id";
  if (evento.lead_id) {
    const { data } = await admin
      .from("oferta_leads")
      .select(colunas)
      .eq("id", evento.lead_id)
      .maybeSingle();
    if (data) return data;
  }
  if (evento.comprador_email) {
    const { data } = await admin
      .from("oferta_leads")
      .select(colunas)
      .eq("email", evento.comprador_email)
      .is("conta_id", null)
      .order("criado_em", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) return data;
  }
  return null;
}

/**
 * Fecha o funil: carimba o lead do quiz que virou compra.
 *
 * Vem antes de resolver a conta: na compra que dá certo, a conta ainda não
 * existe, e a conversão precisa ficar registrada mesmo assim. Idempotente e
 * silenciosa.
 */
async function marcarLeadComprou(admin: AnyClient, evento: HublaEventoRow) {
  if (!APROVA.has(tipoEfetivo(evento))) return;
  try {
    const lead = await acharLead(admin, evento);
    if (!lead || lead.comprou_em) return;
    await admin
      .from("oferta_leads")
      .update({
        comprou_em: new Date().toISOString(),
        pedido_id: evento.fatura_id,
        atualizado_em: new Date().toISOString(),
      })
      .eq("id", lead.id)
      .is("comprou_em", null);
  } catch (e) {
    console.error("hubla: falha ao marcar lead como comprado", e);
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
 * Cria a conta de quem comprou, no aviso de pagamento aprovado.
 *
 * A senha nasce aleatória e não é revelada a ninguém: o comprador define a
 * dele na tela de boas-vindas (para onde a página de obrigado da Hubla aponta)
 * ou pelo link do e-mail de boas-vindas. O e-mail já nasce confirmado.
 *
 * Nunca lança: o evento fica registrado e pode ser reprocessado no painel.
 */
async function criarContaDoComprador(
  admin: AnyClient,
  evento: HublaEventoRow,
  planoCodigo: string | null,
): Promise<string | null> {
  const email = evento.comprador_email;
  if (!email) return null;

  try {
    let userId = await acharUsuarioPorEmail(admin, email);
    const usuarioNovo = !userId;

    if (!userId) {
      const { data: criado, error } = await admin.auth.admin.createUser({
        email,
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
      });
      if (error) {
        console.error("hubla: falha ao criar usuario do comprador", error.message);
        return null;
      }
      userId = criado?.user?.id ?? null;
    }
    if (!userId) return null;

    const { data: contaId, error: erroConta } = await admin.rpc("iniciar_conta_trial", {
      _user_id: userId,
      _nome: evento.comprador_nome || email.split("@")[0] || "Minha conta",
      _plano: planoCodigo ?? "starter",
    });
    if (erroConta) {
      console.error("hubla: falha ao iniciar conta do comprador", erroConta.message);
      return null;
    }

    const leadId = await prepararAcesso(admin, evento, String(contaId));

    // Rede de segurança da tela de boas-vindas: quem fechou a aba, pagou em
    // outro aparelho ou comprou sem passar pelo quiz recebe o link para criar
    // a senha. Só para usuário criado agora: quem já tinha conta tem senha.
    if (usuarioNovo) {
      const { enviarEmailEmSegundoPlano } = await import("@/lib/agentes.server");
      enviarEmailEmSegundoPlano({ tipo: "boas_vindas", email, lead_id: leadId });
    }

    return String(contaId);
  } catch (e) {
    console.error("hubla: erro ao criar conta do comprador", e);
    return null;
  }
}

/**
 * Liga o lead do quiz à conta recém-criada e semeia o onboarding com as
 * respostas do quiz. O carimbo em conta_criada_em abre a janela em que a tela
 * de boas-vindas aceita definir a senha. Devolve o lead ligado, se houver.
 */
async function prepararAcesso(
  admin: AnyClient,
  evento: HublaEventoRow,
  contaId: string,
): Promise<string | null> {
  const agora = new Date().toISOString();
  const lead = await acharLead(admin, evento);
  if (!lead) return null;

  await admin
    .from("oferta_leads")
    .update({
      conta_id: contaId,
      conta_criada_em: agora,
      // Achado só pelo e-mail, o lead pode não ter sido carimbado ainda.
      ...(lead.comprou_em ? {} : { comprou_em: agora, pedido_id: evento.fatura_id }),
      atualizado_em: agora,
    })
    .eq("id", lead.id);

  const respostas = (lead.respostas ?? {}) as Record<string, unknown>;
  if (lead.importado_em || !Object.keys(respostas).length) return lead.id;

  // Não sobrescreve: se a conta já tem onboarding em andamento, o que a pessoa
  // fez dentro do app manda.
  const { data: existente } = await admin
    .from("onboarding_respostas")
    .select("conta_id, respostas, concluido_em")
    .eq("conta_id", contaId)
    .maybeSingle();

  if (existente?.concluido_em) return lead.id;
  if (existente?.respostas && Object.keys(existente.respostas).length > 0) return lead.id;

  // Contato fica em oferta_leads; o onboarding não carrega e-mail nem WhatsApp.
  const { email: _e, whatsapp: _w, ...semContato } = respostas;
  if (existente) {
    await admin
      .from("onboarding_respostas")
      .update({ respostas: semContato, atualizado_em: agora })
      .eq("conta_id", contaId);
  } else {
    await admin
      .from("onboarding_respostas")
      .insert({ conta_id: contaId, respostas: semContato, passo_atual: 1 });
  }

  await admin.from("oferta_leads").update({ importado_em: agora }).eq("id", lead.id);
  return lead.id;
}

/**
 * Quem já tinha usuário (convidado, ou comprou de novo) e comprou pelo quiz:
 * a conta não nasce aqui, então o lead é ligado à existente e nasce com a
 * senha já definida, para a tela de boas-vindas mandar direto para o login.
 */
async function vincularLeadAContaExistente(
  admin: AnyClient,
  evento: HublaEventoRow,
  contaId: string,
) {
  if (!APROVA.has(tipoEfetivo(evento))) return;
  try {
    const lead = await acharLead(admin, evento);
    if (!lead || lead.conta_id) return;
    const agora = new Date().toISOString();
    await admin
      .from("oferta_leads")
      .update({
        conta_id: contaId,
        conta_criada_em: agora,
        senha_definida_em: agora,
        atualizado_em: agora,
      })
      .eq("id", lead.id)
      .is("conta_id", null);
  } catch (e) {
    console.error("hubla: falha ao vincular lead a conta existente", e);
  }
}

async function resolverConta(admin: AnyClient, evento: HublaEventoRow): Promise<string | null> {
  if (evento.conta_id) return evento.conta_id;

  if (evento.assinatura_externa_id) {
    const { data } = await admin
      .from("assinaturas")
      .select("conta_id")
      .eq("hubla_assinatura_id", evento.assinatura_externa_id)
      .maybeSingle();
    if (data) return data.conta_id;
  }

  if (evento.comprador_email) {
    const { data: porEmail } = await admin
      .from("assinaturas")
      .select("conta_id")
      .ilike("comprador_email", evento.comprador_email)
      .maybeSingle();
    if (porEmail) return porEmail.conta_id;

    const userId = await acharUsuarioPorEmail(admin, evento.comprador_email);
    if (userId) {
      const { data: membro } = await admin
        .from("conta_membros")
        .select("conta_id")
        .eq("user_id", userId)
        .order("criado_em")
        .limit(1)
        .maybeSingle();
      if (membro) return membro.conta_id;
    }
  }
  return null;
}

/**
 * Aplica um evento já gravado: move a assinatura da conta conforme o aviso.
 * Idempotente: reprocessar o mesmo evento leva ao mesmo estado final.
 */
export async function aplicarEventoHubla(admin: AnyClient, evento: HublaEventoRow) {
  const tipo = tipoEfetivo(evento);

  // O "enviar evento de teste" do painel da Hubla manda uma fatura paga de
  // verdade no formato, com e-mail de exemplo (teste@gmail.com) e o id da
  // fatura terminando em "-tester". Processar criaria conta e mandaria o
  // e-mail de boas-vindas para um endereço de terceiro.
  if (evento.fatura_id?.endsWith("-tester")) {
    await marcar(admin, evento, true, "Evento de teste da Hubla: registrado, nada alterado.");
    return { ok: true, motivo: "evento_de_teste" as const };
  }

  if (!APROVA.has(tipo) && !ATRASA.has(tipo) && !encerra(tipo)) {
    // Acesso concedido, assinatura criada, carrinho abandonado etc. ficam
    // registrados, mas quem move a assinatura é a fatura.
    await marcar(admin, evento, true, null);
    return { ok: true, motivo: "evento_ignorado" as const };
  }

  await marcarLeadComprou(admin, evento);

  const plano = await resolverPlano(admin, evento);
  const planoCodigo = plano?.codigo ?? null;
  const materiais = await resolverMateriais(admin, evento);
  // Order bump que chegou num aviso só dele: libera o material e não toca na
  // assinatura (a do material é "one_time" e trocaria a do plano).
  const soMaterial = !plano && materiais.length > 0;

  let contaId = await resolverConta(admin, evento);

  if (!contaId && APROVA.has(tipo)) {
    contaId = await criarContaDoComprador(admin, evento, planoCodigo);
  } else if (contaId) {
    await vincularLeadAContaExistente(admin, evento, contaId);
  }

  if (!contaId) {
    await marcar(admin, evento, false, "Conta não identificada para este pagamento.");
    return { ok: false, motivo: "conta_nao_identificada" as const };
  }

  await aplicarMateriais(admin, evento, tipo, contaId, materiais);
  if (soMaterial) {
    await marcar(admin, evento, true, null, contaId);
    return { ok: true, contaId, materiais };
  }

  const { data: existente } = await admin
    .from("assinaturas")
    .select("id, situacao, hubla_assinatura_id, ciclo_meses")
    .eq("conta_id", contaId)
    .maybeSingle();

  // A conta já tem outra assinatura da Hubla valendo: é quem aceitou o upsell
  // anual (a mensal segue viva na Hubla até alguém cancelar) ou comprou de novo.
  const outraAssinatura =
    !!existente?.hubla_assinatura_id &&
    !!evento.assinatura_externa_id &&
    existente.hubla_assinatura_id !== evento.assinatura_externa_id &&
    (existente.situacao === "ativa" || existente.situacao === "atrasada");

  if (outraAssinatura) {
    const cicloAtual = Number(existente.ciclo_meses ?? 1);
    const cicloEvento = plano?.cicloMeses ?? 1;

    if (!APROVA.has(tipo)) {
      // Atraso ou cancelamento da assinatura que foi trocada: a atual manda.
      await marcar(
        admin,
        evento,
        true,
        `Aviso da assinatura ${evento.assinatura_externa_id}, que não é a atual da conta (${existente.hubla_assinatura_id}). Nada alterado.`,
        contaId,
        planoCodigo,
      );
      return { ok: true, contaId, motivo: "assinatura_substituida" as const };
    }

    const { enviarEmailEmSegundoPlano } = await import("@/lib/agentes.server");
    if (cicloEvento < cicloAtual) {
      // A mensal de quem já está no anual cobrou de novo: o anual segue valendo.
      const renovacao = String(evento.payload?.event?.invoice?.type ?? "") === "renewal";
      enviarEmailEmSegundoPlano({
        tipo: "cancelar_assinatura",
        conta_id: contaId,
        assinatura_id: String(evento.assinatura_externa_id),
        reembolsar: renovacao,
      });
      await marcar(
        admin,
        evento,
        true,
        `A conta está no anual (${existente.hubla_assinatura_id}) e a assinatura ${evento.assinatura_externa_id} cobrou${renovacao ? " uma renovação" : ""}. Cancele${renovacao ? " e reembolse" : ""} na Hubla.`,
        contaId,
        planoCodigo,
      );
      return { ok: true, contaId, motivo: "assinatura_a_cancelar" as const };
    }

    // A nova passa a valer; a anterior precisa ser cancelada no painel da Hubla.
    enviarEmailEmSegundoPlano({
      tipo: "cancelar_assinatura",
      conta_id: contaId,
      assinatura_id: String(existente.hubla_assinatura_id),
      reembolsar: false,
    });
  }

  const agora = new Date();
  const patch: Record<string, unknown> = {
    comprador_email: evento.comprador_email,
    hubla_assinatura_id: evento.assinatura_externa_id,
    hubla_fatura_id: evento.fatura_id,
    origem: "hubla",
  };

  if (APROVA.has(tipo)) {
    const ciclo = plano?.cicloMeses ?? 1;
    const proxima = new Date(agora);
    proxima.setMonth(proxima.getMonth() + ciclo);
    patch["situacao"] = "ativa";
    patch["cancelada_em"] = null;
    patch["proxima_renovacao"] = proxima.toISOString();
    patch["ciclo_meses"] = ciclo;
    // valor_centavos é receita por mês (MRR no painel): o anual entra como 1/12
    // do preço de tabela, porque o total da fatura traz os juros do parcelamento.
    // Com order bump na mesma fatura, o total inclui o material.
    if (ciclo >= 12 && plano?.precoAnualCentavos) {
      patch["valor_centavos"] = Math.round(plano.precoAnualCentavos / 12);
    } else if (evento.valor_centavos && !materiais.length) {
      patch["valor_centavos"] = evento.valor_centavos;
    }
    if (planoCodigo) patch["plano_codigo"] = planoCodigo;
    await admin
      .from("contas")
      .update(planoCodigo ? { plano_codigo: planoCodigo, status: "ativa" } : { status: "ativa" })
      .eq("id", contaId);
  } else if (ATRASA.has(tipo)) {
    patch["situacao"] = "atrasada";
  } else {
    patch["situacao"] = "cancelada";
    patch["cancelada_em"] = agora.toISOString();
    await admin.from("contas").update({ plano_codigo: "free" }).eq("id", contaId);
  }

  if (existente) {
    await admin.from("assinaturas").update(patch).eq("conta_id", contaId);
  } else {
    await admin
      .from("assinaturas")
      .insert({ conta_id: contaId, plano_codigo: planoCodigo ?? "free", ...patch });
  }

  await marcar(admin, evento, true, null, contaId, planoCodigo);
  return { ok: true, contaId, planoCodigo, situacao: String(patch["situacao"] ?? "") };
}

async function marcar(
  admin: AnyClient,
  evento: HublaEventoRow,
  processado: boolean,
  erro: string | null,
  contaId?: string | null,
  planoCodigo?: string | null,
) {
  if (!evento.id) return;
  await admin
    .from("hubla_eventos")
    .update({
      processado,
      erro,
      processado_em: new Date().toISOString(),
      ...(contaId ? { conta_id: contaId } : {}),
      ...(planoCodigo ? { plano_codigo: planoCodigo } : {}),
    })
    .eq("id", evento.id);
}
