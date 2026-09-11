/**
 * Nomes que o usuário reconhece, num lugar só.
 *
 * Os status do pipeline vazavam crus para a interface (`aguardando_aprovacao`,
 * com underscore, dentro de um badge) ou passavam por um `replace("_", " ")`
 * que trocava só o primeiro underscore e comia o acento. Cada estado é nomeado
 * pelo que significa para quem vai gravar, não pelo estágio da esteira.
 */

const PAUTA: Record<string, string> = {
  gerada: "Na fila",
  em_producao: "A prevIA está escrevendo",
  aguardando_aprovacao: "Esperando você",
  aprovada: "Pronto para gravar",
  rejeitada: "Recusado",
};

const CURADORIA: Record<string, string> = {
  pendente: "Esperando você",
  aprovado: "Escolhido",
  descartado: "Recusado",
};

const PUBLICACAO: Record<string, string> = {
  pendente: "Ainda não postado",
  postado: "Postado",
};

/** Último recurso: nunca devolve underscore nem string vazia para a tela. */
function humanizar(valor: string) {
  const limpo = valor.replaceAll("_", " ").trim();
  return limpo ? limpo.charAt(0).toUpperCase() + limpo.slice(1) : "—";
}

export function nomeStatusPauta(status: string | null | undefined) {
  if (!status) return "—";
  return PAUTA[status] ?? humanizar(status);
}

export function nomeStatusCuradoria(status: string | null | undefined) {
  if (!status) return "—";
  return CURADORIA[status] ?? humanizar(status);
}

export function nomeStatusPublicacao(status: string | null | undefined) {
  if (!status) return "—";
  return PUBLICACAO[status] ?? humanizar(status);
}
