/**
 * A área /equipe (social selling): contas, onboarding (o do app e o funil do
 * quiz, com a lista de leads) e suporte. Só leitura.
 *
 * Aberta para o papel `comercial` e para `admin`. Nada aqui escreve no banco
 * nem devolve financeiro, custo ou margem: isso fica no /admin, que continua
 * só de admin. Lê com service role depois de conferir o papel, porque
 * oferta_leads não tem policy para ninguém fora do servidor.
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resumirOnboarding } from "@/lib/billing.functions";
import { labelArea, SITUACAO } from "@/lib/onboarding-perguntas";
import { PERGUNTAS, validarPergunta, type Respostas } from "@/lib/quiz-oferta";

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

const cicloAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));
const pct = (parte: number, todo: number) => (todo > 0 ? Math.round((parte / todo) * 100) : 0);

function labelSituacao(valor: unknown): string | null {
  if (typeof valor !== "string" || !valor) return null;
  return SITUACAO.find((o) => o.valor === valor)?.label ?? valor;
}

/** Primeira pergunta sem resposta válida: é onde a pessoa parou. */
function paradaNoQuiz(r: Respostas): number {
  for (let i = 1; i <= PERGUNTAS.length; i++) if (validarPergunta(i, r)) return i;
  return PERGUNTAS.length;
}

/**
 * O funil do quiz: quantos começaram, quantos receberam o diagnóstico,
 * quantos compraram, em que pergunta pararam e como respondeu quem respondeu.
 */
function funilDoQuiz(leads: any[]) {
  const total = leads.length;
  const comDiagnostico = leads.filter((l) => l.relatorio_gerado_em).length;
  const compraram = leads.filter((l) => l.comprou_em).length;

  const paradas = new Map<number, number>();
  for (const l of leads) {
    if (l.relatorio_gerado_em) continue;
    const n = paradaNoQuiz((l.respostas ?? {}) as Respostas);
    paradas.set(n, (paradas.get(n) ?? 0) + 1);
  }

  const porPergunta = PERGUNTAS.map((p, i) => {
    const numero = i + 1;
    // Chegou nesta pergunta quem não parou antes dela.
    const chegaram = leads.filter(
      (l) => l.relatorio_gerado_em || paradaNoQuiz((l.respostas ?? {}) as Respostas) >= numero,
    ).length;
    return {
      numero,
      titulo: p.titulo,
      chegaram,
      pararam: paradas.get(numero) ?? 0,
      pctChegaram: pct(chegaram, total),
    };
  });

  const distribuicoes = PERGUNTAS.flatMap((p, i) => {
    if ((p.tipo !== "unica" && p.tipo !== "multipla") || !p.opcoes?.length) return [];
    const contagem = new Map<string, number>();
    let responderam = 0;
    for (const l of leads) {
      const bruto = ((l.respostas ?? {}) as Record<string, unknown>)[p.campo as string];
      const valores = Array.isArray(bruto)
        ? bruto
        : typeof bruto === "string" && bruto
          ? [bruto]
          : [];
      if (!valores.length) continue;
      responderam++;
      for (const v of valores) {
        const label = p.opcoes.find((o) => o.valor === v)?.label ?? String(v);
        contagem.set(label, (contagem.get(label) ?? 0) + 1);
      }
    }
    return [
      {
        titulo: `${i + 1}. ${p.titulo}`,
        total: responderam,
        itens: [...contagem.entries()]
          .map(([label, quantidade]) => ({ label, quantidade }))
          .sort((a, b) => b.quantidade - a.quantidade),
      },
    ];
  });

  return {
    total,
    comDiagnostico,
    compraram,
    pctDiagnostico: pct(comDiagnostico, total),
    pctCompraSobreDiagnostico: pct(compraram, comDiagnostico),
    porPergunta,
    distribuicoes,
  };
}

export const getPainelEquipe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const papel = await assertEquipe(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const db = supabaseAdmin as any;
    const ciclo = cicloAtual();

    const [
      leads,
      contas,
      planos,
      membros,
      assinaturas,
      uso,
      onboarding,
      resgates,
      chamados,
      usuarios,
    ] = await Promise.all([
      db
        .from("oferta_leads")
        .select(
          "id, token, nome, email, whatsapp, respostas, origem, relatorio, relatorio_gerado_em, comprou_em, conta_id, criado_em",
        )
        .order("criado_em", { ascending: false })
        .limit(1000),
      db
        .from("contas")
        .select("id, nome, plano_codigo, status, criado_em")
        .order("criado_em", { ascending: false }),
      db
        .from("planos")
        .select("codigo, nome, limite_roteiros_mes, limite_carrosseis_mes, limite_imagens_mes"),
      db.from("conta_membros").select("conta_id, user_id, papel"),
      db.from("assinaturas").select("conta_id, situacao, origem, comprador_email"),
      db.from("uso_mensal").select("conta_id, tipo, quantidade").eq("ciclo", ciclo),
      db
        .from("onboarding_respostas")
        .select("conta_id, respostas, passo_atual, concluido_em, criado_em")
        .order("criado_em", { ascending: false }),
      db.from("convite_resgates").select("conta_id, whatsapp"),
      db
        .from("suporte_chamados")
        .select("id, conta_id, user_id, conversa_id, resumo, status, criado_em, resolvido_em")
        .order("criado_em", { ascending: false })
        .limit(200),
      db.auth.admin.listUsers({ page: 1, perPage: 1000 }),
    ]);

    const listaLeads = (leads.data ?? []) as any[];
    const emailPorUsuario = new Map<string, string>(
      ((usuarios.data?.users ?? []) as any[]).map((u) => [
        u.id as string,
        (u.email ?? "") as string,
      ]),
    );

    // Contas de quem é da equipe não são clientes: ficam de fora.
    const { data: papeis } = await db.from("user_roles").select("user_id, role");
    const usuariosEquipe = new Set(
      ((papeis ?? []) as any[]).filter((p) => p.role === "comercial").map((p) => p.user_id),
    );

    const membrosPorConta = new Map<string, any[]>();
    for (const m of (membros.data ?? []) as any[]) {
      membrosPorConta.set(m.conta_id, [...(membrosPorConta.get(m.conta_id) ?? []), m]);
    }
    const planoPor = new Map<string, any>(((planos.data ?? []) as any[]).map((p) => [p.codigo, p]));
    const assinaturaPor = new Map<string, any>(
      ((assinaturas.data ?? []) as any[]).map((a) => [a.conta_id, a]),
    );
    const onboardingPor = new Map<string, any>(
      ((onboarding.data ?? []) as any[]).map((o) => [o.conta_id, o]),
    );
    const leadPor = new Map<string, any>();
    for (const l of listaLeads)
      if (l.conta_id && !leadPor.has(l.conta_id)) leadPor.set(l.conta_id, l);
    const resgatePor = new Map<string, string>();
    for (const r of (resgates.data ?? []) as any[])
      if (r.conta_id && r.whatsapp) resgatePor.set(r.conta_id, r.whatsapp);
    const usoPor = new Map<string, Record<string, number>>();
    for (const u of (uso.data ?? []) as any[]) {
      usoPor.set(u.conta_id, { ...(usoPor.get(u.conta_id) ?? {}), [u.tipo]: num(u.quantidade) });
    }

    const contasDetalhe = ((contas.data ?? []) as any[])
      .filter((c) => !(membrosPorConta.get(c.id) ?? []).some((m) => usuariosEquipe.has(m.user_id)))
      .map((c) => {
        const ms = membrosPorConta.get(c.id) ?? [];
        const dono = ms.find((m) => m.papel === "owner") ?? ms[0];
        const plano = planoPor.get(c.plano_codigo);
        const a = assinaturaPor.get(c.id);
        const o = onboardingPor.get(c.id);
        const lead = leadPor.get(c.id);
        return {
          id: c.id as string,
          nome: c.nome as string,
          email: (dono ? emailPorUsuario.get(dono.user_id) : null) ?? a?.comprador_email ?? null,
          whatsapp: (lead?.whatsapp ?? resgatePor.get(c.id) ?? null) as string | null,
          membros: ms.length,
          plano: (plano?.nome ?? c.plano_codigo) as string,
          status: c.status as string,
          situacao: (a?.situacao ?? null) as string | null,
          origem: (a?.origem ?? null) as string | null,
          criadoEm: c.criado_em as string,
          onboarding: o?.concluido_em
            ? "concluido"
            : o
              ? `passo ${o.passo_atual ?? 1} de 5`
              : "nao_iniciado",
          veioDoQuiz: Boolean(lead),
          uso: usoPor.get(c.id) ?? {},
          limites: {
            roteiro: num(plano?.limite_roteiros_mes),
            carrossel: num(plano?.limite_carrosseis_mes),
            imagem: num(plano?.limite_imagens_mes),
          },
        };
      });

    const idsClientes = new Set(contasDetalhe.map((c) => c.id));
    const registrosOnboarding = ((onboarding.data ?? []) as any[]).filter((o) =>
      idsClientes.has(o.conta_id),
    );

    const leadsDetalhe = listaLeads.map((l) => {
      const r = (l.respostas ?? {}) as Respostas & Record<string, unknown>;
      const origem = (l.origem ?? {}) as Record<string, string>;
      const etapa: EtapaLead = l.comprou_em
        ? "comprou"
        : l.relatorio_gerado_em
          ? "diagnostico"
          : "quiz_incompleto";
      const parou = l.relatorio_gerado_em ? null : paradaNoQuiz(r);
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
        parouNaPergunta: parou,
        comprouEm: (l.comprou_em ?? null) as string | null,
        origem:
          [origem.utm_source, origem.utm_campaign, origem.utm_content]
            .filter(Boolean)
            .join(" · ") || null,
        relatorio: l.relatorio_gerado_em ? `/dna-viral/${l.token}?ver=completo` : null,
      };
    });

    const contaNome = new Map<string, string>(contasDetalhe.map((c) => [c.id, c.nome]));
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

    return {
      papel,
      contas: contasDetalhe,
      onboarding: resumirOnboarding(registrosOnboarding, contasDetalhe),
      quiz: { ...funilDoQuiz(listaLeads), leads: leadsDetalhe },
      chamados: listaChamados,
    };
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
