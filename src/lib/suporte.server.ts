/**
 * Executor das ações do assistente de suporte. Só roda no servidor.
 *
 * A ação chega já validada pelo suporte-agent e é lida do banco (nunca do
 * navegador). Mesmo assim, toda escrita usa o client do PRÓPRIO usuário (RLS)
 * ou as funções comuns que conferem a posse por ele: uma ação adulterada no
 * banco não alcança a conta de outra pessoa.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import type { AcaoSuporte } from "@/lib/suporte";

type Ctx = {
  supabase: SupabaseClient<Database>;
  userId: string;
  contaId: string;
  conversaId: string;
};

const NOMES_DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

async function perfilDaConta(ctx: Ctx): Promise<string> {
  const { data } = await supabaseAdmin
    .from("onboarding_respostas")
    .select("perfil_id")
    .eq("conta_id", ctx.contaId)
    .maybeSingle();
  if (!data?.perfil_id) throw new Error("Seu perfil ainda não foi criado. Conclua o onboarding.");
  return data.perfil_id;
}

const texto = (v: unknown) => String(v ?? "");

/** Executa a ação e devolve o resultado em uma frase para a pessoa. Erros lançam com mensagem legível. */
export async function executarAcao(ctx: Ctx, acao: AcaoSuporte): Promise<string> {
  const a = acao.args ?? {};

  switch (acao.tipo) {
    case "pedir_plano_semana": {
      const { criarPlanoDaConta } = await import("@/lib/plano.server");
      await criarPlanoDaConta(ctx.contaId);
      return "Pedido feito. Seu plano fica pronto em uns 5 minutos, e você é avisado.";
    }

    case "trocar_pauta_do_plano": {
      const { trocarPautaDoPlano } = await import("@/lib/plano.server");
      const nova = await trocarPautaDoPlano(
        ctx.supabase,
        texto(a.plano_id),
        Number(a.indice),
        texto(a.pedido),
      );
      return `Trocado. O novo vídeo de ${nova.dia} é "${nova.tema}".`;
    }

    case "tirar_pauta_do_plano":
    case "devolver_pauta_ao_plano": {
      const { alternarPautaDoPlano } = await import("@/lib/plano.server");
      const removida = acao.tipo === "tirar_pauta_do_plano";
      await alternarPautaDoPlano(ctx.supabase, texto(a.plano_id), Number(a.indice), removida);
      return removida
        ? "Pronto, esse vídeo saiu da semana."
        : "Pronto, esse vídeo voltou para a semana.";
    }

    case "aprovar_plano": {
      const { aprovarPlanoDoUsuario } = await import("@/lib/plano.server");
      const r = await aprovarPlanoDoUsuario(ctx.supabase, texto(a.plano_id));
      return r.jaAprovado
        ? "Esse plano já estava aprovado."
        : `Plano aprovado. A prevIA já está escrevendo ${r.pautas} roteiro(s).`;
    }

    case "mudar_dias_de_postar": {
      const dias = [...new Set((Array.isArray(a.dias) ? a.dias : []).map(Number))]
        .filter((d) => Number.isInteger(d) && d >= 0 && d <= 6)
        .sort((x, y) => x - y);
      if (!dias.length) throw new Error("Nenhum dia válido.");
      const perfilId = await perfilDaConta(ctx);
      const { error } = await ctx.supabase
        .from("perfis")
        .update({ ritmo_dias: dias })
        .eq("id", perfilId);
      if (error) throw new Error("Não consegui salvar os dias.");
      return `Pronto. Seus dias de postar agora são: ${dias.map((d) => NOMES_DIAS[d]).join(", ")}. Vale a partir do próximo plano.`;
    }

    case "adicionar_referencia": {
      const handle = texto(a.handle);
      const perfilId = await perfilDaConta(ctx);
      const [{ data: refs }, { data: conta }] = await Promise.all([
        ctx.supabase
          .from("perfis_referencia")
          .select("id, handle, ativo")
          .eq("conta_id", ctx.contaId),
        supabaseAdmin
          .from("contas")
          .select("planos:planos(limite_referencias)")
          .eq("id", ctx.contaId)
          .maybeSingle(),
      ]);
      const limite = Number(
        (conta as { planos?: { limite_referencias?: number } | null } | null)?.planos
          ?.limite_referencias ?? 5,
      );
      if ((refs ?? []).filter((r) => r.ativo).length >= limite) {
        throw new Error(`Seu plano permite até ${limite} referências ativas.`);
      }
      const existente = (refs ?? []).find((r) => r.handle === handle);
      const { error } = existente
        ? await ctx.supabase
            .from("perfis_referencia")
            .update({ ativo: true })
            .eq("id", existente.id)
        : await ctx.supabase.from("perfis_referencia").insert({
            handle,
            perfil_id_relacionado: perfilId,
            conta_id: ctx.contaId,
            ativo: true,
          });
      if (error) throw new Error("Não consegui adicionar essa referência.");
      return `Pronto, @${handle} entrou nas suas referências e vale a partir do próximo plano.`;
    }

    case "desativar_referencia": {
      const { data, error } = await ctx.supabase
        .from("perfis_referencia")
        .update({ ativo: false })
        .eq("id", texto(a.referencia_id))
        .select("id")
        .maybeSingle();
      if (error || !data) throw new Error("Não consegui desativar essa referência.");
      return `Pronto, @${texto(a.handle)} não será mais lida nos próximos planos.`;
    }

    case "mudar_template_carrossel": {
      const perfilId = texto(a.perfil_id);
      const mudancas = (a.mudancas ?? {}) as Record<string, string>;
      const { data: perfil } = await ctx.supabase
        .from("perfis")
        .select("template_carrossel")
        .eq("id", perfilId)
        .maybeSingle();
      if (!perfil) throw new Error("Perfil não encontrado na sua conta.");
      const atual = (perfil.template_carrossel ?? {}) as Record<string, unknown>;
      const { error } = await ctx.supabase
        .from("perfis")
        .update({ template_carrossel: { ...atual, ...mudancas } as never })
        .eq("id", perfilId);
      if (error) throw new Error("Não consegui salvar o template.");
      return "Pronto, o template do carrossel foi atualizado. Os próximos slides já saem assim.";
    }

    case "gerar_carrossel": {
      const pautaId = texto(a.pauta_id);
      const { data: pauta } = await ctx.supabase
        .from("pautas_geradas")
        .select("id, status")
        .eq("id", pautaId)
        .maybeSingle();
      if (!pauta) throw new Error("Roteiro não encontrado na sua conta.");
      if (pauta.status !== "aprovada")
        throw new Error("O carrossel só sai de um roteiro aprovado.");
      const { invocarAgente } = await import("@/lib/agentes.server");
      const r = await invocarAgente(
        "carrossel-agent",
        { pauta_id: pautaId },
        { timeoutMs: 150_000 },
      );
      if (!r.ok) throw new Error(r.erro ?? "Não consegui gerar o carrossel.");
      return `Carrossel pronto. [Abrir o roteiro](/aprovacao/${pautaId}) para ver e baixar os slides.`;
    }

    case "regerar_manual_de_marca": {
      const perfilId = await perfilDaConta(ctx);
      const { invocarAgente } = await import("@/lib/agentes.server");
      const r = await invocarAgente(
        "dna-agent",
        { conta_id: ctx.contaId, perfil_id: perfilId },
        { timeoutMs: 150_000 },
      );
      if (!r.ok)
        throw new Error("Não consegui escrever o seu DNA viral agora. Tente de novo em instantes.");
      return "Pronto, seu DNA viral foi escrito de novo. [Ver o DNA viral](/dna)";
    }

    case "falar_com_pessoa": {
      const { invocarAgente } = await import("@/lib/agentes.server");
      const r = await invocarAgente(
        "suporte-agent",
        {
          acao: "abrir_chamado",
          conversa_id: ctx.conversaId,
          conta_id: ctx.contaId,
          user_id: ctx.userId,
          resumo: texto(a.resumo),
        },
        { timeoutMs: 30_000 },
      );
      if (!r.ok) throw new Error("Não consegui abrir o chamado. Use o WhatsApp abaixo.");
      return "Chamado aberto: a equipe foi avisada. Se preferir, fale agora pelo WhatsApp.";
    }

    default:
      throw new Error("Ação desconhecida.");
  }
}
