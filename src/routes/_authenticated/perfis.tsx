import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * "Minha marca" virou "Configurações". O endereço antigo continua valendo
 * porque links do assistente e atalhos salvos ainda apontam para ele.
 */
export const Route = createFileRoute("/_authenticated/perfis")({
  beforeLoad: () => {
    throw redirect({ to: "/configuracoes", replace: true });
  },
});
