/**
 * A área /equipe: leads do quiz, contas, onboarding e suporte, só leitura.
 *
 * Aberta para o papel `comercial` (social selling) e para `admin`. Nada aqui
 * escreve no banco nem devolve financeiro, custo ou margem: para isso existe o
 * /admin, que continua só de admin. Lê com service role depois de conferir o
 * papel, porque oferta_leads não tem policy para ninguém fora do servidor.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { labelArea, SITUACAO } from "@/lib/onboarding-perguntas";

type ClienteComRpc = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown }>;
};

async function papelDaEquipe(supabase: ClienteComRpc, userId: string) {
  const [admin, comercial] = await Promise.all([
    supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
    supabase.rpc("has_role", { _user_id: userId, _role: "comercial" }),
  ]);
  return { admin: Boolean(admin.data), comercial: Boolean(comercial.data) };
}

async function assertEquipe(supabase: ClienteComRpc, userId: string) {
  const papel = await papelDaEquipe(supabase, userId);
  if (!papel.admin && !papel.comercial) throw new Error("Acesso restrito à equipe da prevIA.");
  return papel;
}

/** Para o login e o menu saberem para onde mandar a pessoa. */
export const getPapelEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => papelDaEquipe(context.supabase as any, context.userId));

export type EtapaLead = "quiz_incompleto" | "diagnostico" | "comprou";

function labelSituacao(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor) return null;
  return SITUACAO.find((o) => o.valor === valor)?.label ?? valor;
}

export const getPainelEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const papel = await assertEquipe(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;

    const [leads, contas, membros, assinaturas, onboarding, chamados, usuarios] = await Promise.all(
      [
        db
          .from("oferta_leads")
          .select(
            "id, token, nome, email, whatsapp, respostas, origem, relatorio, relatorio_gerado_em, comprou_em, conta_id, criado_em",
          )
          .order("criado_em", { ascending: false })
          .limit(500),
        db
          .from("contas")
          .select("id, nome, plano_codigo, status, criado_em, planos(nome)")
          .order("criado_em", {
            ascending: false,
          }),
        db.from("conta_membros").select("conta_id, user_id, papel"),
        db
          .from("assinaturas")
          .select("conta_id, situacao, origem, proxima_renovacao, cancelada_em"),
        db.from("onboarding_respostas").select("conta_id, passo_atual, concluido_em, respostas"),
        db
          .from("suporte_chamados")
          .select("id, conta_id, user_id, conversa_id, resumo, status, criado_em, resolvido_em")
          .order("criado_em", { ascending: false })
          .limit(200),
        db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
      ],
    );

    const emailPorUsuario = new Map<string, string>(
      ((usuarios.data?.users ?? []) as any[]).map((u) => [
        u.id as string,
        (u.email ?? "") as string,
      ]),
    );
    const donoPorConta = new Map<string, string>();
    for (const m of (membros.data ?? []) as any[]) {
      if (m.papel === "owner" || !donoPorConta.has(m.conta_id))
        donoPorConta.set(m.conta_id, m.user_id);
    }
    const contaNome = new Map<string, string>(
      ((contas.data ?? []) as any[]).map((c) => [c.id, c.nome]),
    );
    const leadPorConta = new Map<string, any>();
    for (const l of (leads.data ?? []) as any[]) if (l.conta_id) leadPorConta.set(l.conta_id, l);

    const listaLeads = ((leads.data ?? []) as any[]).map((l) => {
      const r = (l.respostas ?? {}) as Record<string, unknown>;
      const origem = (l.origem ?? {}) as Record<string, string>;
      const etapa: EtapaLead = l.comprou_em
        ? "comprou"
        : l.relatorio_gerado_em
          ? "diagnostico"
          : "quiz_incompleto";
      return {
        id: l.id as string,
        criadoEm: l.criado_em as string,
        nome: (l.nome ?? (typeof r.nome === "string" ? r.nome : null)) as string | null,
        email: (l.email ?? null) as string | null,
        whatsapp: (l.whatsapp ?? null) as string | null,
        area:
          r.area_atuacao === "outro"
            ? ((r.area_outro as string | undefined) ?? "Outra")
            : r.area_atuacao
              ? labelArea(r.area_atuacao as string)
              : null,
        situacao: labelSituacao(r.situacao),
        perfil: (l.relatorio?.arquetipo?.nome ?? null) as string | null,
        etapa,
        comprouEm: (l.comprou_em ?? null) as string | null,
        origem:
          [origem.utm_source, origem.utm_campaign, origem.utm_content]
            .filter(Boolean)
            .join(" · ") || null,
        relatorio: l.relatorio_gerado_em ? `/dna-viral/${l.token}?ver=completo` : null,
        contaId: (l.conta_id ?? null) as string | null,
      };
    });

    const assinaturaPorConta = new Map<string, any>(
      ((assinaturas.data ?? []) as any[]).map((a) => [a.conta_id, a]),
    );
    const onboardingPorConta = new Map<string, any>(
      ((onboarding.data ?? []) as any[]).map((o) => [o.conta_id, o]),
    );

    const listaContas = ((contas.data ?? []) as any[]).map((c) => {
      const a = assinaturaPorConta.get(c.id);
      const o = onboardingPorConta.get(c.id);
      const lead = leadPorConta.get(c.id);
      const dono = donoPorConta.get(c.id);
      return {
        id: c.id as string,
        nome: c.nome as string,
        email: dono ? (emailPorUsuario.get(dono) ?? null) : null,
        whatsapp: (lead?.whatsapp ?? null) as string | null,
        plano: (c.planos?.nome ?? c.plano_codigo) as string,
        status: c.status as string,
        situacao: (a?.situacao ?? null) as string | null,
        origemAssinatura: (a?.origem ?? null) as string | null,
        criadoEm: c.criado_em as string,
        onboarding: o?.concluido_em
          ? "concluido"
          : o
            ? `passo ${o.passo_atual ?? 1} de 5`
            : "nao_iniciado",
        veioDoQuiz: Boolean(lead),
      };
    });

    const listaChamados = ((chamados.data ?? []) as any[]).map((ch) => ({
      id: ch.id as string,
      conversaId: (ch.conversa_id ?? null) as string | null,
      conta: contaNome.get(ch.conta_id) ?? "—",
      email: emailPorUsuario.get(ch.user_id) ?? null,
      resumo: ch.resumo as string,
      status: ch.status as string,
      criadoEm: ch.criado_em as string,
      resolvidoEm: (ch.resolvido_em ?? null) as string | null,
    }));

    return { papel, leads: listaLeads, contas: listaContas, chamados: listaChamados };
  });

/** A conversa com o assistente que gerou um chamado. Só leitura. */
export const getConversaChamado = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { conversaId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertEquipe(context.supabase as any, context.userId);
    if (!/^[0-9a-f-]{36}$/i.test(data.conversaId)) throw new Error("Conversa inválida.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mensagens } = await (supabaseAdmin as any)
      .from("suporte_mensagens")
      .select("id, papel, conteudo, criado_em")
      .eq("conversa_id", data.conversaId)
      .order("criado_em");
    return ((mensagens ?? []) as any[]).map((m) => ({
      id: m.id as string,
      papel: m.papel as "usuario" | "assistente",
      conteudo: m.conteudo as string,
      criadoEm: m.criado_em as string,
    }));
  });
