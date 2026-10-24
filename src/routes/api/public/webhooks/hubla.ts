import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Recebe os avisos (webhooks v2) da Hubla.
 *
 * A Hubla manda o token da integração no header x-hubla-token e um id do aviso
 * em x-hubla-idempotency. Não garante ordem nem entrega única: o id deduplica
 * reenvios, e as regras em hubla.server.ts são idempotentes.
 */
const AVISA_ADMIN = new Set([
  "invoice.payment_succeeded",
  "invoice.refunded",
  "invoice.status_updated",
]);

export const Route = createFileRoute("/api/public/webhooks/hubla")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const esperado = process.env["HUBLA_WEBHOOK_TOKEN"] ?? "";
        const recebido = request.headers.get("x-hubla-token") ?? "";
        const idempotencia = request.headers.get("x-hubla-idempotency");
        const corpo = await request.text();

        const tokenValido =
          esperado.length > 0 &&
          recebido.length === esperado.length &&
          timingSafeEqual(Buffer.from(recebido), Buffer.from(esperado));

        let payload: Record<string, unknown> | null = null;
        try {
          payload = JSON.parse(corpo);
        } catch {
          payload = null;
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const admin = supabaseAdmin as any;

        if (!tokenValido || !payload) {
          // Registra a tentativa recusada para diagnóstico no painel. 401 faz a
          // Hubla mostrar a falha no histórico de eventos dela.
          try {
            await admin.from("hubla_eventos").insert({
              evento: tokenValido ? "payload_invalido" : "token_invalido",
              idempotencia: null,
              payload: {
                recebido_em: new Date().toISOString(),
                tipo: (payload as any)?.type ?? null,
                corpo: corpo.slice(0, 4000),
              },
              processado: false,
              erro: tokenValido ? "Corpo do webhook não reconhecido" : "Token do webhook inválido",
            });
          } catch (e) {
            console.error("hubla: falha ao registrar tentativa recusada", e);
          }
          return new Response(tokenValido ? "payload invalido" : "nao autorizado", {
            status: tokenValido ? 400 : 401,
          });
        }

        const { normalizarEventoHubla, aplicarEventoHubla } = await import("@/lib/hubla.server");
        const normalizado = normalizarEventoHubla(payload, idempotencia);

        // Grava sempre, antes de qualquer decisão de negócio. Reenvio do mesmo
        // aviso cai no mesmo registro.
        const linha = {
          evento: normalizado.evento,
          idempotencia: normalizado.idempotencia,
          fatura_id: normalizado.fatura_id,
          assinatura_externa_id: normalizado.assinatura_externa_id,
          comprador_email: normalizado.comprador_email,
          conta_id: normalizado.conta_id,
          lead_id: normalizado.lead_id,
          valor_centavos: normalizado.valor_centavos,
          payload,
        };
        const { data: gravado, error } = idempotencia
          ? await admin
              .from("hubla_eventos")
              .upsert(linha, { onConflict: "idempotencia" })
              .select("id, processado")
              .maybeSingle()
          : await admin.from("hubla_eventos").insert(linha).select("id, processado").maybeSingle();

        if (error) {
          console.error("hubla: falha ao gravar evento", error.message);
          // 500 faz a Hubla tentar de novo mais tarde.
          return new Response("erro ao gravar", { status: 500 });
        }

        try {
          await aplicarEventoHubla(admin, { ...normalizado, id: gravado?.id });
          // Push para os admins (venda, upsell, material, reembolso). O
          // push-agent lê o evento gravado, decide se vale aviso e não repete.
          if (gravado?.id && AVISA_ADMIN.has(normalizado.evento)) {
            const { invocarAgente } = await import("@/lib/agentes.server");
            void invocarAgente(
              "push-agent",
              { tipo: "admin_venda", evento_id: gravado.id },
              { timeoutMs: 20_000 },
            ).then((r) => {
              if (!r.ok) console.error("hubla: push de venda falhou", r.erro);
            });
          }
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          console.error("hubla: falha ao aplicar evento", msg);
          if (gravado?.id) {
            await admin
              .from("hubla_eventos")
              .update({ processado: false, erro: msg.slice(0, 300) })
              .eq("id", gravado.id);
          }
        }

        return new Response("ok", { status: 200 });
      },
      // A Hubla pode testar o endereço antes de salvar a integração.
      GET: async () => new Response("ok", { status: 200 }),
    },
  },
});
