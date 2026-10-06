import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * "Acompanhar" virou "Roteiros". O endereço antigo continua valendo porque
 * notificações já enviadas e atalhos salvos no celular ainda apontam para ele.
 */
export const Route = createFileRoute("/_authenticated/pipeline")({
  beforeLoad: () => {
    throw redirect({ to: "/roteiros", replace: true });
  },
});
