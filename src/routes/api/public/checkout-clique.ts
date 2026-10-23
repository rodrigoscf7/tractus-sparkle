import { createFileRoute } from "@tanstack/react-router";

/**
 * Marca o primeiro clique no botão de compra do relatório.
 *
 * Chamado por navigator.sendBeacon, que sobrevive à troca de página para o
 * checkout da Hubla. Público e sem resposta útil: só carimba uma data num lead
 * que já existe, e só da primeira vez.
 */
export const Route = createFileRoute("/api/public/checkout-clique")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let leadId = "";
        try {
          leadId = String(JSON.parse(await request.text())?.leadId ?? "");
        } catch {
          leadId = "";
        }
        if (!/^[0-9a-f-]{36}$/i.test(leadId)) return new Response(null, { status: 204 });

        try {
          const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
          await (supabaseAdmin as any)
            .from("oferta_leads")
            .update({ checkout_clicado_em: new Date().toISOString() })
            .eq("id", leadId)
            .is("checkout_clicado_em", null);
        } catch (e) {
          console.error("checkout-clique: falha ao registrar", e);
        }
        return new Response(null, { status: 204 });
      },
    },
  },
});
