import { createFileRoute } from "@tanstack/react-router";
import { createHmac, timingSafeEqual } from "crypto";

/**
 * Recebe os avisos de pagamento da Kiwify.
 * A Kiwify assina o corpo cru com o token do webhook e envia em ?signature=.
 */
export const Route = createFileRoute("/api/public/webhooks/kiwify")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env["KIWIFY_WEBHOOK_TOKEN"] ?? "";

        const url = new URL(request.url);
        const signature =
          url.searchParams.get("signature") ??
          request.headers.get("x-kiwify-signature") ??
          request.headers.get("x-kiwify-webhook-signature") ??
          "";
        const body = await request.text();

        const candidatos = token
          ? ["sha1", "sha256"].map((alg) => createHmac(alg, token).update(body).digest("hex"))
          : [];
        const assinaturaValida = candidatos.some((esperado) => {
          const a = Buffer.from(signature.trim().toLowerCase());
          const b = Buffer.from(esperado.toLowerCase());
          return a.length === b.length && timingSafeEqual(a, b);
        });

        let payload: Record<string, unknown> | null = null;
        try {
          payload = JSON.parse(body);
        } catch {
          try {
            payload = Object.fromEntries(new URLSearchParams(body).entries());
          } catch {
            payload = null;
          }
        }

        if (!assinaturaValida || !payload) {
          // Sempre responde 200 para a Kiwify aceitar/manter o webhook ativo,
          // mas registra a chamada recusada para diagnóstico.
          try {
            const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
            await (supabaseAdmin as any).from("kiwify_eventos").insert({
              evento: assinaturaValida ? "payload_invalido" : "assinatura_invalida",
              pedido_id: null,
              payload: {
                recebido_em: new Date().toISOString(),
                signature,
                headers: Object.fromEntries(request.headers.entries()),
                body: body.slice(0, 4000),
              },
              processado: false,
              erro: assinaturaValida
                ? "Corpo do webhook não reconhecido"
                : "Assinatura do webhook inválida",
            });
          } catch (e) {
            console.error("kiwify: falha ao registrar tentativa recusada", e);
          }
          return new Response("ok", { status: 200 });
        }


        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { normalizarEventoKiwify, aplicarEventoKiwify } = await import("@/lib/kiwify.server");
        const admin = supabaseAdmin as any;

        const normalizado = normalizarEventoKiwify(payload);

        // Grava sempre — inclusive duplicado — antes de qualquer decisão de negócio.
        const { data: gravado, error } = await admin
          .from("kiwify_eventos")
          .upsert(
            {
              evento: normalizado.evento,
              pedido_id: normalizado.pedido_id,
              assinatura_externa_id: normalizado.assinatura_externa_id,
              comprador_email: normalizado.comprador_email,
              conta_id: normalizado.conta_id,
              plano_codigo: normalizado.plano_codigo,
              valor_centavos: normalizado.valor_centavos,
              payload,
            },
            { onConflict: "pedido_id,evento" },
          )
          .select("id")
          .maybeSingle();

        if (error) {
          console.error("kiwify: falha ao gravar evento", error.message);
          return new Response("ok", { status: 200 });
        }

        try {
          await aplicarEventoKiwify(admin, { ...normalizado, id: gravado?.id });
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("kiwify: falha ao aplicar evento", msg);
          if (gravado?.id) {
            await admin
              .from("kiwify_eventos")
              .update({ processado: false, erro: msg.slice(0, 300) })
              .eq("id", gravado.id);
          }
        }

        return new Response("ok", { status: 200 });
      },
    },
  },
});
