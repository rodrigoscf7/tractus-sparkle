/**
 * Traduz falha técnica em frase que o usuário resolve.
 *
 * O app mostrava `error.message` cru do Postgres em toast — o advogado lia
 * coisas como `duplicate key value violates unique constraint "perfis_nome_key"`.
 * Erro não pede desculpa e não é vago: diz o que houve e o que fazer.
 */

const REGRAS: { casa: RegExp; texto: string }[] = [
  {
    casa: /failed to fetch|networkerror|network request failed|err_internet/i,
    texto: "Sem conexão com o servidor. Verifique a internet e tente de novo.",
  },
  {
    casa: /jwt expired|invalid jwt|refresh_token|session.*expired/i,
    texto: "Sua sessão expirou. Entre de novo para continuar.",
  },
  {
    casa: /duplicate key|already exists|23505/i,
    texto: "Já existe um registro com esse nome. Escolha outro.",
  },
  {
    casa: /row-level security|permission denied|42501|not authorized/i,
    texto: "Você não tem permissão para essa ação nesta conta.",
  },
  {
    casa: /violates foreign key|23503/i,
    texto: "Esse item está ligado a outro registro e não pode ser removido agora.",
  },
  {
    casa: /violates not-null|23502/i,
    texto: "Faltou preencher um campo obrigatório.",
  },
  {
    casa: /invalid login credentials/i,
    texto: "E-mail ou senha incorretos.",
  },
  {
    casa: /user already registered/i,
    texto: "Já existe uma conta com esse e-mail. Entre em vez de criar.",
  },
  {
    casa: /email not confirmed/i,
    texto: "Confirme o e-mail que enviamos antes de entrar.",
  },
  {
    casa: /password.*at least|weak.?password/i,
    texto: "A senha precisa de pelo menos 6 caracteres.",
  },
  {
    casa: /rate limit|too many requests|429/i,
    texto: "Muitas tentativas seguidas. Espere um minuto e tente de novo.",
  },
  {
    casa: /limite|quota|cota/i,
    texto: "Você atingiu o limite do seu plano neste ciclo.",
  },
  {
    casa: /timeout|timed out|statement canceled/i,
    texto: "A operação demorou demais e foi interrompida. Tente de novo.",
  },
];

export function mensagemErro(
  erro: unknown,
  padrao = "Não consegui completar essa ação. Tente de novo em instantes.",
): string {
  const bruto =
    erro instanceof Error
      ? erro.message
      : typeof erro === "string"
        ? erro
        : typeof erro === "object" && erro !== null && "message" in erro
          ? String((erro as { message: unknown }).message)
          : "";

  if (!bruto) return padrao;

  const regra = REGRAS.find((r) => r.casa.test(bruto));
  return regra ? regra.texto : padrao;
}
