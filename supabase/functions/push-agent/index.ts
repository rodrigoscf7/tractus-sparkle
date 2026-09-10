// push-agent: envia Web Push para todos os membros da conta de um lote da
// fila de notificações. Chamado pelo cron de despacho (fire-and-forget) e,
// manualmente, pela ação "Enviar notificação de teste" do admin.
import webpush from "npm:web-push@3.6.7";
import {
  corsHeaders,
  formatAgentError,
  getServiceClient,
  requireAgentAuth,
} from "../_shared/agent-utils.ts";

function montarMensagem(tipo: string, nome: string, contagem: number) {
  if (tipo === "curadoria_pronta") {
    return {
      titulo: "prevIA",
      corpo: `Bom dia, ${nome}! A curadoria de hoje já está pronta pra você aprovar.`,
    };
  }
  if (contagem <= 1) {
    return {
      titulo: "prevIA",
      corpo: `${nome}, 1 pauta nova está esperando sua aprovação na prevIA.`,
    };
  }
  return {
    titulo: "prevIA",
    corpo: `${nome}, ${contagem} pautas novas estão esperando sua aprovação na prevIA.`,
  };
}

function destino(tipo: string): string {
  return tipo === "curadoria_pronta" ? "/curadoria" : "/pipeline";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  try {
    const { queue_id } = await req.json();
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
