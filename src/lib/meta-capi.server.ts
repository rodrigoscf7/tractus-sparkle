/**
 * API de Conversões do Meta: eventos enviados pelo servidor.
 *
 * Complementa o Pixel do funil (src/lib/pixel.ts). O Lead sai daqui e do
 * navegador com o mesmo event_id (o id do lead), e o Meta conta um só. A compra
 * (Purchase) sai só daqui, a partir do webhook da Hubla, porque é aqui que se
 * sabe de qual lead do quiz ela veio; a Hubla não tem Pixel configurado.
 *
 * E-mail, telefone e external_id vão em SHA-256, como o Meta pede. O IP só vai
 * no Lead, lido da requisição na hora e nunca guardado (a Política de
 * Privacidade promete não reter o IP).
 *
 * Ambiente: META_CAPI_TOKEN e o id do Pixel (META_PIXEL_ID ou
 * VITE_META_PIXEL_ID). META_CAPI_TEST_CODE manda tudo para "Eventos de teste"
 * no Gerenciador; apague depois de conferir. Sem token ou Pixel, nada sai.
 *
 * Nunca lança: medição de anúncio não pode derrubar o quiz nem um pagamento.
 */

import { createHash } from "crypto";

const VERSAO_GRAPH = "v23.0";

type AnyClient = any;

export type DadosDoUsuario = {
  email?: string | null;
  telefone?: string | null;
  externalId?: string | null;
  fbp?: string | null;
  fbc?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export type EventoMeta = {
  nome: "Lead" | "Purchase";
  eventId: string;
  urlOrigem?: string | null;
  usuario: DadosDoUsuario;
  dados?: Record<string, unknown>;
};

function sha256(valor: string): string {
  return createHash("sha256").update(valor).digest("hex");
}

/** Só dígitos, com o 55 na frente quando o número é brasileiro sem DDI. */
function telefoneNormalizado(telefone: string): string | null {
  const digitos = telefone.replace(/\D/g, "");
  if (digitos.length < 10) return null;
  return digitos.length <= 11 ? `55${digitos}` : digitos;
}

function dadosDoUsuario(u: DadosDoUsuario): Record<string, unknown> {
  const saida: Record<string, unknown> = {};
  const email = u.email?.trim().toLowerCase();
  if (email) saida["em"] = [sha256(email)];
  const telefone = u.telefone ? telefoneNormalizado(u.telefone) : null;
  if (telefone) saida["ph"] = [sha256(telefone)];
  if (u.externalId) saida["external_id"] = [sha256(u.externalId)];
  if (u.fbp) saida["fbp"] = u.fbp;
  if (u.fbc) saida["fbc"] = u.fbc;
  if (u.ip) saida["client_ip_address"] = u.ip;
  if (u.userAgent) saida["client_user_agent"] = u.userAgent;
  saida["country"] = [sha256("br")];
  return saida;
}

function siteUrl(): string {
  return (process.env["SITE_URL"] ?? "https://previaviral.tractusoficial.com").replace(/\/+$/, "");
}

export async function enviarEventoMeta(evento: EventoMeta): Promise<void> {
  const token = process.env["META_CAPI_TOKEN"]?.trim();
  const pixel = (process.env["META_PIXEL_ID"] ?? process.env["VITE_META_PIXEL_ID"])?.trim();
  if (!token || !pixel) return;

  // Evento de site precisa do navegador; sem ele (compra feita de dentro do
  // app, sem passar pelo quiz), o Meta aceita como evento do sistema.
  const doSite = !!evento.usuario.userAgent;
  const corpo: Record<string, unknown> = {
    data: [
      {
        event_name: evento.nome,
        event_time: Math.floor(Date.now() / 1000),
        event_id: evento.eventId,
        action_source: doSite ? "website" : "system_generated",
        ...(doSite ? { event_source_url: evento.urlOrigem ?? siteUrl() } : {}),
        user_data: dadosDoUsuario(evento.usuario),
        ...(evento.dados ? { custom_data: evento.dados } : {}),
      },
    ],
  };
  const teste = process.env["META_CAPI_TEST_CODE"]?.trim();
  if (teste) corpo["test_event_code"] = teste;

  try {
    const resp = await fetch(
      `https://graph.facebook.com/${VERSAO_GRAPH}/${encodeURIComponent(pixel)}/events?access_token=${encodeURIComponent(token)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(corpo),
        signal: AbortSignal.timeout(10_000),
      },
    );
    if (!resp.ok) {
      const texto = await resp.text().catch(() => "");
      console.error(`meta-capi: ${evento.nome} recusado (${resp.status})`, texto.slice(0, 300));
    }
  } catch (e) {
    console.error(`meta-capi: falha ao enviar ${evento.nome}`, e);
  }
}

/**
 * Purchase de uma fatura paga da Hubla. O event_id é a fatura: reprocessar o
 * mesmo aviso não conta duas vezes. Renovação não é compra nova e não sai.
 */
export async function enviarCompraDaHubla(
  admin: AnyClient,
  evento: {
    fatura_id: string | null;
    lead_id: string | null;
    comprador_email: string | null;
    payload: Record<string, any>;
  },
  contaId: string,
  conteudos: string[],
): Promise<void> {
  try {
    const fatura = evento.payload?.event?.invoice ?? null;
    if (!evento.fatura_id || String(fatura?.type ?? "sell") === "renewal") return;

    // Valor pago sem os juros do parcelamento.
    const subtotal = Number(fatura?.amount?.subtotalCents);
    const desconto = Number(fatura?.amount?.discountCents) || 0;
    const total = Number(fatura?.amount?.totalCents);
    const centavos = Number.isFinite(subtotal) && subtotal > 0 ? subtotal - desconto : total;

    const colunas = "id, token, email, whatsapp, meta_fbp, meta_fbc, meta_user_agent";
    let lead: any = null;
    if (evento.lead_id) {
      ({ data: lead } = await admin
        .from("oferta_leads")
        .select(colunas)
        .eq("id", evento.lead_id)
        .maybeSingle());
    }
    if (!lead) {
      ({ data: lead } = await admin
        .from("oferta_leads")
        .select(colunas)
        .eq("conta_id", contaId)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle());
    }
    if (!lead && evento.comprador_email) {
      ({ data: lead } = await admin
        .from("oferta_leads")
        .select(colunas)
        .eq("email", evento.comprador_email)
        .order("criado_em", { ascending: false })
        .limit(1)
        .maybeSingle());
    }

    const telefonePagador = evento.payload?.event?.user?.phone ?? fatura?.payer?.phone ?? null;

    await enviarEventoMeta({
      nome: "Purchase",
      eventId: `hubla-${evento.fatura_id}`,
      urlOrigem: lead?.token ? `${siteUrl()}/dna-viral/${lead.token}` : null,
      usuario: {
        email: evento.comprador_email ?? lead?.email ?? null,
        telefone: lead?.whatsapp ?? (typeof telefonePagador === "string" ? telefonePagador : null),
        externalId: lead?.id ?? null,
        fbp: lead?.meta_fbp ?? null,
        fbc: lead?.meta_fbc ?? null,
        userAgent: lead?.meta_user_agent ?? null,
      },
      dados: {
        currency: "BRL",
        value: Number.isFinite(centavos) && centavos > 0 ? Math.round(centavos) / 100 : 0,
        content_ids: conteudos,
        content_type: "product",
      },
    });
  } catch (e) {
    console.error("meta-capi: falha ao montar a compra", e);
  }
}
