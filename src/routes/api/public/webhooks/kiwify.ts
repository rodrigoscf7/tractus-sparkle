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
        const token = process.env["KIWIFY_WEBHOOK_TOKEN"];
        if (!token) return new Response("Webhook não configurado", { status: 503 });

        const url = new URL(request.url);
        const signature =
          url.searchParams.get("signature") ??
          request.headers.get("x-kiwify-signature") ??
          "";
        const body = await request.text();

        const candidatos = ["sha1", "sha256"].map((alg) =>
          createHmac(alg, token).update(body).digest("hex"),
        );
        const assinaturaValida = candidatos.some((esperado) => {
          const a = Buffer.from(signature.trim().toLowerCase());
          const b = Buffer.from(esperado.toLowerCase());
          return a.length === b.length && timingSafeEqual(a, b);
        });
        if (!assinaturaValida) return new Response("Invalid signature", { status: 401 });

        let payload: Record<string, unknown>;
        try {
          payload = JSON.parse(body);
        } catch {
          return new Response("Invalid JSON", { status: 400 });
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
