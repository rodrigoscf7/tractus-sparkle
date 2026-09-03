import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { iniciarConta } from "@/lib/assinatura.functions";

/**
 * Onboarding: garante que o usuário logado pertença a uma conta.
 * No primeiro acesso cria a conta, vincula como owner e abre o trial do plano de entrada.
 */
export function useEnsureConta() {
  const queryClient = useQueryClient();
  const criar = useServerFn(iniciarConta);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await criar();
        if (!cancelled && res?.criada) {
          queryClient.invalidateQueries({ queryKey: ["minha-conta"] });
          queryClient.invalidateQueries({ queryKey: ["minha-assinatura"] });
        }
      } catch {
        // usuário sem sessão válida ou conta já existente: nada a fazer
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [criar, queryClient]);
}
