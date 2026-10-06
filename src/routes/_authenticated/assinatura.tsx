import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * Assinatura virou uma aba de Configurações. O endereço antigo continua
 * valendo para links do assistente, e-mails e atalhos salvos.
 */
export const Route = createFileRoute("/_authenticated/assinatura")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes", search: { aba: "assinatura" }, replace: true });
  },
});
