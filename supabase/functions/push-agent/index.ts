// push-agent: envia Web Push para todos os membros da conta de um lote da
// fila de notificações. Chamado pelo cron de despacho (fire-and-forget) e,
// manualmente, pela ação "Enviar notificação de teste" do admin.
import webpush from "npm:web-push@3.6.7";
import {
  corsHeaders,
  enviarPushAdmins,
  formatAgentError,
  getServiceClient,
  requireAgentAuth,
} from "../_shared/agent-utils.ts";

// ---------------------------------------------------------------------------
// admin_venda: { tipo, evento_id } aviso aos admins de venda, plano anual, material
// e reembolso. Montado aqui a partir de hubla_eventos (quem chama passa só o
// id), uma vez por evento.
// ---------------------------------------------------------------------------

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

async function avisarVenda(eventoId: string): Promise<number> {
  if (!/^[0-9a-f-]{36}$/i.test(eventoId)) return 0;
  const supabase = getServiceClient();
  const [{ data: e }, { data: planos }, { data: materiais }] = await Promise.all([
    supabase
      .from("hubla_eventos")
      .select("id, evento, fatura_id, comprador_email, processado, payload")
      .eq("id", eventoId)
      .maybeSingle(),
    supabase
      .from("planos")
      .select("nome, hubla_produto_id, hubla_oferta_id, hubla_oferta_anual_id"),
    supabase.from("materiais").select("nome, hubla_produto_id, hubla_oferta_id"),
  ]);
  if (!e?.processado || String(e.fatura_id ?? "").endsWith("-tester")) return 0;

  const ev = (e.payload as any)?.event ?? {};
  const fatura = ev.invoice ?? {};
  const tipo = String(e.evento);
  const chargeback =
    tipo === "invoice.status_updated" && String(fatura.status ?? "").toLowerCase() === "chargeback";
  const aprovada = tipo === "invoice.payment_succeeded";
  if (!aprovada && tipo !== "invoice.refunded" && !chargeback) return 0;
  // Renovação não é venda nova.
  if (aprovada && String(fatura.type ?? "sell") === "renewal") return 0;

  const produtos = [ev.product, ...(Array.isArray(ev.products) ? ev.products : [])].filter(Boolean);
  const produtoIds = new Set(produtos.map((p: any) => p?.id).filter(Boolean));
  const ofertaIds = new Set(
    produtos
      .flatMap((p: any) => (Array.isArray(p?.offers) ? p.offers : []).map((o: any) => o?.id))
      .filter(Boolean),
  );
  const nomesMateriais = (materiais ?? [])
    .filter((m: any) => produtoIds.has(m.hubla_produto_id) || ofertaIds.has(m.hubla_oferta_id))
    .map((m: any) => String(m.nome).split(" · ")[0]);
  const plano = (planos ?? []).find(
    (p: any) =>
      produtoIds.has(p.hubla_produto_id) ||
      ofertaIds.has(p.hubla_oferta_id) ||
      ofertaIds.has(p.hubla_oferta_anual_id),
  ) as any;
  const anual =
    !!plano &&
    (ofertaIds.has(plano.hubla_oferta_anual_id) ||
      (Array.isArray(ev.subscriptions) ? ev.subscriptions : []).some(
        (s: any) => s?.billingCycleMonths === 12,
      ));

  const subtotal = Number(fatura.amount?.subtotalCents);
  const desconto = Number(fatura.amount?.discountCents) || 0;
  const total = Number(fatura.amount?.totalCents) || 0;
  const centavos = Number.isFinite(subtotal) && subtotal > 0 ? subtotal - desconto : total;
  const quem =
    [ev.user?.firstName, ev.user?.lastName].filter(Boolean).join(" ").trim() ||
    e.comprador_email ||
    "Cliente";
  const itens = [
    ...(plano ? [`${plano.nome} ${anual ? "anual" : "mensal"}`] : []),
    ...nomesMateriais,
  ].join(" + ");

  let titulo: string;
  if (!aprovada) titulo = `${chargeback ? "Chargeback" : "Reembolso"} · ${brl(centavos)}`;
  else if (plano && anual) titulo = `Plano anual · ${brl(centavos)}`;
  else if (plano) titulo = `Nova venda · ${brl(centavos)}`;
  else titulo = `Material vendido · ${brl(centavos)}`;

  return await enviarPushAdmins(
    { title: titulo, body: `${quem}${itens ? `: ${itens}` : ""}`.slice(0, 180), url: "/admin" },
    `venda:${e.id}`,
  );
}

function montarMensagem(tipo: string, nome: string, contagem: number) {
  if (tipo === "plano_pronto") {
    return {
      titulo: "prevIA",
      corpo: `${nome}, seu plano da semana chegou: os vídeos de cada dia, com o gancho já escrito.`,
    };
  }
  if (tipo === "curadoria_pronta") {
    return {
      titulo: "prevIA",
      corpo: `Bom dia, ${nome}! Os assuntos de hoje já estão prontos pra você escolher.`,
    };
  }
  // Cobrança do ritmo: só chega quando já existe conteúdo esperando — ver
  // enfileirar_cobranca_ritmo. Por isso pode prometer que tem o que gravar.
  if (tipo === "ritmo_hoje") {
    return {
      titulo: "prevIA",
      corpo: `${nome}, hoje é dia de postar — e já tem conteúdo pronto esperando você.`,
    };
  }
  if (contagem <= 1) {
    return {
      titulo: "prevIA",
      corpo: `${nome}, 1 roteiro novo está esperando sua aprovação.`,
    };
  }
  return {
    titulo: "prevIA",
    corpo: `${nome}, ${contagem} roteiros novos estão esperando sua aprovação.`,
  };
}

function destino(tipo: string): string {
  if (tipo === "plano_pronto") return "/plano";
  if (tipo === "curadoria_pronta") return "/curadoria";
  // A cobrança leva para a tela que diz o que fazer agora, não para o quadro.
  if (tipo === "ritmo_hoje") return "/hoje";
  return "/roteiros";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  try {
    const pedido = await req.json();
    if (pedido?.tipo === "admin_venda") {
      const enviadas = await avisarVenda(String(pedido.evento_id ?? ""));
      return new Response(JSON.stringify({ ok: true, enviadas }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { queue_id } = pedido;
    if (!queue_id) {
      return new Response(JSON.stringify({ ok: false, error: "queue_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_SUBJECT ausente no ambiente.");
    }
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = getServiceClient();

    const { data: lote, error: erroLote } = await supabase
      .from("push_notificacoes_pendentes")
      .select("id, conta_id, perfil_id, tipo, contagem")
      .eq("id", queue_id)
      .single();
    if (erroLote || !lote) {
      return new Response(JSON.stringify({ ok: false, error: "Lote não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome")
      .eq("id", lote.perfil_id)
      .maybeSingle();
    const nome = perfil?.nome ?? "";

    const { data: membros } = await supabase
      .from("conta_membros")
      .select("user_id")
      .eq("conta_id", lote.conta_id);

    const userIds = (membros ?? []).map((m) => m.user_id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviadas: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inscricoes } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .in("user_id", userIds);

    const { titulo, corpo } = montarMensagem(lote.tipo, nome, lote.contagem);
    const payload = JSON.stringify({
      title: titulo,
      body: corpo,
      url: destino(lote.tipo),
    });

    let enviadas = 0;
    for (const inscricao of inscricoes ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.p256dh, auth: inscricao.auth_key },
          },
          payload,
        );
        enviadas++;
        await supabase
          .from("push_subscriptions")
          .update({ ultimo_uso_em: new Date().toISOString() })
          .eq("id", inscricao.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", inscricao.id);
        } else {
          console.error("push-agent: falha ao enviar", inscricao.id, e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, enviadas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: formatAgentError(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
