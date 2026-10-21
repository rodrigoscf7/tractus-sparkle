/**
 * Cria um usuário com a conta em cortesia — o mesmo caminho para o convidado
 * criado pelo admin e para quem entra pelo link de convite (/convite/<codigo>).
 *
 * O usuário nasce com o e-mail JÁ confirmado: sem isso, ele esbarraria no aviso
 * de confirmar o e-mail, que depende de SMTP configurado.
 */

/** O e-mail já tem usuário: quem chamou decide a mensagem (admin ou convite). */
export class EmailJaCadastrado extends Error {
  constructor() {
    super("Já existe um usuário com esse e-mail.");
  }
}

export async function criarContaCortesia(
  admin: any,
  dados: {
    email: string;
    senha: string;
    nome: string;
    plano: string;
    dias: number;
    origem: "cortesia";
    observacao: string;
  },
): Promise<{ userId: string; contaId: string }> {
  const { data: criado, error: erroUsuario } = await admin.auth.admin.createUser({
    email: dados.email,
    password: dados.senha,
    email_confirm: true,
  });

  if (erroUsuario) {
    const bruto = String(erroUsuario.message ?? "");
    if (/already (been )?registered|already exists/i.test(bruto)) throw new EmailJaCadastrado();
    throw new Error(bruto || "Não foi possível criar o usuário.");
  }

  const userId = criado?.user?.id as string | undefined;
  if (!userId) throw new Error("O usuário foi criado sem id. Tente de novo.");

  try {
    // Mesmo caminho que o cadastro normal percorre: cria conta, vincula como
    // owner e abre a assinatura. Reusar evita que a conta nasça diferente.
    const { data: contaId, error: erroConta } = await admin.rpc("iniciar_conta_trial", {
      _user_id: userId,
      _nome: dados.nome,
      _plano: dados.plano,
    });
    if (erroConta) throw new Error(erroConta.message);

    // O RPC marca a origem como venda, que é o caso comum. Aqui não é venda:
    // corrigir a origem mantém o painel financeiro honesto.
    const fim = new Date(Date.now() + dados.dias * 86400000);
    const { error: erroAssinatura } = await admin
      .from("assinaturas")
      .update({
        situacao: "trial",
        origem: dados.origem,
        trial_fim: fim.toISOString(),
        valor_centavos: 0,
        cancelada_em: null,
        observacao: dados.observacao,
      })
      .eq("conta_id", contaId);
    if (erroAssinatura) throw new Error(erroAssinatura.message);

    return { userId, contaId: String(contaId) };
  } catch (erro) {
    // Sem conta, o usuário só atrapalharia: a próxima tentativa com o mesmo
    // e-mail cairia em "já existe" sem ter acesso a nada.
    await admin.auth.admin.deleteUser(userId).catch(() => undefined);
    throw erro;
  }
}
