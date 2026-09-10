import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  AREAS,
  CANAIS,
  ORIGEM,
  SITUACAO,
  TAMANHOS,
  TRAFEGO,
} from "@/lib/onboarding-perguntas";

const cicloAtual = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};

const num = (v: unknown) => (v === null || v === undefined ? 0 : Number(v));

async function assertAdmin(supabase: {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown }>;
}, userId: string) {
  const { data } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (!data) throw new Error("Acesso restrito à administração da plataforma.");
}

export type AdminDashboard = Awaited<ReturnType<typeof carregarDashboard>>;

async function carregarDashboard(supabase: any) {
  const ciclo = cicloAtual();

  const [
    planos,
    contas,
    membros,
    assinaturas,
    uso,
    economia,
    plataforma,
    medias,
    precos,
    eventos,
    acoes,
    onboarding,
  ] = await Promise.all([
    supabase.from("planos").select("*").order("ordem"),
    supabase.from("contas").select("*").order("criado_em"),
    supabase.from("conta_membros").select("conta_id"),
    supabase.from("assinaturas").select("*"),
    supabase.from("uso_mensal").select("conta_id, tipo, quantidade").eq("ciclo", ciclo),
    supabase.from("vw_conta_economia_mensal").select("*"),
    supabase.from("vw_plataforma_mensal").select("*").order("ciclo"),
    supabase.from("vw_custo_medio_tipo").select("*"),
    supabase.from("custo_precos").select("*").order("rotulo"),
    supabase.from("kiwify_eventos").select("*").order("criado_em", { ascending: false }).limit(25),
    supabase.from("admin_acoes").select("*").order("criado_em", { ascending: false }).limit(25),
    supabase
      .from("onboarding_respostas")
      .select("conta_id, respostas, passo_atual, concluido_em, criado_em")
      .order("criado_em", { ascending: false }),
  ]);

  const planosData = (planos.data ?? []) as any[];
  const assinaturasData = (assinaturas.data ?? []) as any[];
  const economiaData = (economia.data ?? []) as any[];
  const mediasData = (medias.data ?? []) as any[];

  const mediaPorTipo = Object.fromEntries(
    mediasData.map((m) => [m.tipo, num(m.custo_medio_centavos)]),
  ) as Record<string, number>;

  const contasDetalhe = ((contas.data ?? []) as any[]).map((conta) => {
    const plano = planosData.find((p) => p.codigo === conta.plano_codigo);
    const assinatura = assinaturasData.find((a) => a.conta_id === conta.id) ?? null;
    const econCiclo = economiaData.find((e) => e.conta_id === conta.id && e.ciclo === ciclo);
    const custoCentavos = num(econCiclo?.custo_total_centavos);
    const receitaCentavos =
      assinatura?.situacao === "ativa" ? num(assinatura.valor_centavos) : 0;
    return {
      id: conta.id as string,
      nome: conta.nome as string,
      status: conta.status as string,
      plano_codigo: conta.plano_codigo as string,
      plano_nome: (plano?.nome ?? conta.plano_codigo) as string,
      criado_em: conta.criado_em as string,
      ciclo_inicio: conta.ciclo_inicio as string,
      membros: ((membros.data ?? []) as any[]).filter((m) => m.conta_id === conta.id).length,
      assinatura,
      uso: Object.fromEntries(
        ((uso.data ?? []) as any[])
          .filter((u) => u.conta_id === conta.id)
          .map((u) => [u.tipo, u.quantidade]),
      ) as Record<string, number>,
      limites: {
        curadoria: num(plano?.limite_curadorias_mes),
        roteiro: num(plano?.limite_roteiros_mes),
        carrossel: num(plano?.limite_carrosseis_mes),
      },
      custo_centavos: custoCentavos,
      geracoes: num(econCiclo?.geracoes),
      receita_centavos: receitaCentavos,
      margem_centavos: receitaCentavos - custoCentavos,
      alerta_consumo: receitaCentavos > 0 && custoCentavos > receitaCentavos * 0.5,
    };
  });

  const ativas = assinaturasData.filter((a) => a.situacao === "ativa");
  const trials = assinaturasData.filter((a) => a.situacao === "trial");
  const atrasadas = assinaturasData.filter((a) => a.situacao === "atrasada");
  const canceladas = assinaturasData.filter((a) => a.situacao === "cancelada");
  const mrr = ativas.reduce((s, a) => s + num(a.valor_centavos), 0);
  const inicioMes = new Date(ciclo);
  const canceladasMes = canceladas.filter(
    (a) => a.cancelada_em && new Date(a.cancelada_em) >= inicioMes,
  ).length;
  const trialsConvertidos = ativas.filter((a) => a.trial_fim).length;
  const totalTrialsHistorico = trialsConvertidos + trials.length + canceladas.length;

  const custoMes = num(
    ((plataforma.data ?? []) as any[]).find((p) => p.ciclo === ciclo)?.custo_total_centavos,
  );

  const resumo = {
    mrr_centavos: mrr,
    arr_centavos: mrr * 12,
    ticket_medio_centavos: ativas.length ? Math.round(mrr / ativas.length) : 0,
    pagantes: ativas.length,
    trials: trials.length,
    atrasadas: atrasadas.length,
    gratuitas: contasDetalhe.filter((c) => c.plano_codigo === "free").length,
    canceladas_mes: canceladasMes,
    conversao_trial_pct: totalTrialsHistorico
      ? Math.round((trialsConvertidos / totalTrialsHistorico) * 100)
      : 0,
    custo_mes_centavos: custoMes,
    margem_centavos: mrr - custoMes,
    margem_pct: mrr > 0 ? Math.round(((mrr - custoMes) / mrr) * 100) : 0,
    custo_por_conta_centavos: contasDetalhe.length ? Math.round(custoMes / contasDetalhe.length) : 0,
  };

  // Crescimento médio de contas pagantes por mês desde a primeira assinatura
  const primeiras = assinaturasData
    .map((a) => new Date(a.iniciada_em).getTime())
    .filter((t) => !Number.isNaN(t));
  const mesesOperando = primeiras.length
    ? Math.max(
        1,
        Math.round((Date.now() - Math.min(...primeiras)) / (1000 * 60 * 60 * 24 * 30)),
      )
    : 1;
  const novasPorMes = Math.max(0.5, ativas.length / mesesOperando);
  const custoPorContaMes = resumo.custo_por_conta_centavos || 0;

  const cenarios = [
    { nome: "Conservador", fator: 0.5 },
    { nome: "Base", fator: 1 },
    { nome: "Otimista", fator: 1.6 },
  ];
  const projecao = cenarios.map((c) => ({
    cenario: c.nome,
    meses: [3, 6, 12].map((m) => {
      const contasProj = Math.round(ativas.length + novasPorMes * c.fator * m);
      const receita = contasProj * (resumo.ticket_medio_centavos || 9700);
      const custo = contasProj * custoPorContaMes;
      return {
        mes: m,
        contas: contasProj,
        receita_centavos: receita,
        custo_centavos: custo,
        margem_centavos: receita - custo,
        margem_pct: receita > 0 ? Math.round(((receita - custo) / receita) * 100) : 0,
      };
    }),
  }));

  const PISO_MARGEM = 60;
  const coerencia = planosData.map((p) => {
    const custoMax =
      num(p.limite_curadorias_mes) * (mediaPorTipo["curadoria"] ?? 0) +
      num(p.limite_roteiros_mes) * (mediaPorTipo["roteiro"] ?? 0) +
      num(p.limite_carrosseis_mes) * (mediaPorTipo["carrossel"] ?? 0) +
      num(p.limite_referencias) * 30 * (mediaPorTipo["scraping"] ?? 0);
    const contasPlano = contasDetalhe.filter((c) => c.plano_codigo === p.codigo);
    const custoObservado = contasPlano.length
      ? contasPlano.reduce((s, c) => s + c.custo_centavos, 0) / contasPlano.length
      : 0;
    const preco = num(p.preco_mensal_centavos);
    const margemMax = preco > 0 ? Math.round(((preco - custoMax) / preco) * 100) : 0;
    const margemMedia = preco > 0 ? Math.round(((preco - custoObservado) / preco) * 100) : 0;
    return {
      codigo: p.codigo as string,
      nome: p.nome as string,
      preco_centavos: preco,
      custo_max_centavos: Math.round(custoMax),
      custo_observado_centavos: Math.round(custoObservado),
      margem_max_pct: margemMax,
      margem_media_pct: margemMedia,
      contas: contasPlano.length,
      alerta: preco > 0 && margemMax < PISO_MARGEM,
      piso_margem_pct: PISO_MARGEM,
    };
  });

  return {
    planos: planosData,
    contas: contasDetalhe,
    resumo,
    serie: ((plataforma.data ?? []) as any[]).map((p) => ({
      ciclo: p.ciclo as string,
      custo_total_centavos: num(p.custo_total_centavos),
      custo_ia_centavos: num(p.custo_ia_centavos),
      custo_scraping_centavos: num(p.custo_scraping_centavos),
      geracoes: num(p.geracoes),
      contas_ativas: num(p.contas_ativas),
    })),
    projecao,
    coerencia,
    custo_medio_tipo: mediasData.map((m) => ({
      tipo: m.tipo as string,
      eventos: num(m.eventos),
      custo_medio_centavos: num(m.custo_medio_centavos),
      custo_max_centavos: num(m.custo_max_centavos),
    })),
    precos: (precos.data ?? []) as any[],
    eventos_kiwify: (eventos.data ?? []) as any[],
    acoes: (acoes.data ?? []) as any[],
    onboarding: resumirOnboarding((onboarding.data ?? []) as any[], contasDetalhe),
    ciclo,
  };
}

/**
 * Perguntas 11 a 15 do onboarding não configuram nada nos agentes: são
 * atribuição de canal e qualificação de lead. Ficam agregadas aqui para o
 * painel da plataforma. A área de atuação entra junto porque é o corte mais
 * útil para decidir quais referências curar.
 */
function resumirOnboarding(registros: any[], contas: { id: string; nome: string }[]) {
  const nomePorConta = new Map(contas.map((c) => [c.id, c.nome]));
  const concluidos = registros.filter((r) => r.concluido_em);

  const distribuicao = (extrair: (r: any) => string[]) => {
    const contagem = new Map<string, number>();
    for (const registro of concluidos) {
      for (const valor of extrair(registro)) {
        if (!valor) continue;
        contagem.set(valor, (contagem.get(valor) ?? 0) + 1);
      }
    }
    return [...contagem.entries()]
      .map(([label, quantidade]) => ({ label, quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade);
  };

  const unico = (campo: string, opcoes: { valor: string; label: string }[]) =>
    distribuicao((r) => {
      const bruto = r.respostas?.[campo];
      if (typeof bruto !== "string" || !bruto) return [];
      return [opcoes.find((o) => o.valor === bruto)?.label ?? bruto];
    });

  const multiplo = (campo: string, opcoes: { valor: string; label: string }[]) =>
    distribuicao((r) => {
      const bruto = r.respostas?.[campo];
      if (!Array.isArray(bruto)) return [];
      return bruto.map(
        (v: unknown) => opcoes.find((o) => o.valor === v)?.label ?? String(v ?? ""),
      );
    });

  const abandonoPorPasso = [1, 2, 3, 4, 5].map((passo) => ({
    passo,
    quantidade: registros.filter((r) => !r.concluido_em && r.passo_atual === passo).length,
  }));

  return {
    iniciados: registros.length,
    concluidos: concluidos.length,
    conversao_pct: registros.length
      ? Math.round((concluidos.length / registros.length) * 100)
      : 0,
    abandono_por_passo: abandonoPorPasso,
    area: unico("area_atuacao", AREAS),
    origem: unico("origem", ORIGEM),
    situacao: unico("situacao", SITUACAO),
    tamanho: unico("tamanho_escritorio", TAMANHOS),
    trafego: unico("trafego_pago", TRAFEGO),
    canais: multiplo("canais", CANAIS),
    contas: registros.map((r) => ({
      conta_id: r.conta_id as string,
      nome: nomePorConta.get(r.conta_id) ?? "—",
      concluido_em: (r.concluido_em ?? null) as string | null,
      passo_atual: Number(r.passo_atual ?? 1),
      nome_informado: (r.respostas?.nome ?? null) as string | null,
      area: labelDe(AREAS, r.respostas?.area_atuacao),
      nicho: (r.respostas?.nicho ?? null) as string | null,
      origem: labelDe(ORIGEM, r.respostas?.origem),
      situacao: labelDe(SITUACAO, r.respostas?.situacao),
      tamanho: labelDe(TAMANHOS, r.respostas?.tamanho_escritorio),
      trafego: labelDe(TRAFEGO, r.respostas?.trafego_pago),
      referencias: Array.isArray(r.respostas?.referencias) ? r.respostas.referencias.length : 0,
    })),
  };
}

function labelDe(opcoes: { valor: string; label: string }[], valor: unknown) {
  if (typeof valor !== "string" || !valor) return null;
  return opcoes.find((o) => o.valor === valor)?.label ?? valor;
}

export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    return carregarDashboard(context.supabase);
  });

async function registrarAcao(
  admin: any,
  atorUserId: string,
  contaId: string | null,
  acao: string,
  detalhes: Record<string, unknown>,
) {
  await admin
    .from("admin_acoes")
    .insert({ ator_user_id: atorUserId, conta_id: contaId, acao, detalhes });
}

export const salvarPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { codigo: string; novo?: boolean; valores: Record<string, unknown> }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const payload = { ...data.valores, codigo: data.codigo };
    const { error } = data.novo
      ? await (supabaseAdmin as any).from("planos").insert(payload)
      : await (supabaseAdmin as any).from("planos").update(data.valores).eq("codigo", data.codigo);
    if (error) throw new Error(error.message);
    await registrarAcao(supabaseAdmin, context.userId, null, data.novo ? "plano_criado" : "plano_editado", {
      codigo: data.codigo,
      valores: data.valores,
    });
    return { ok: true };
  });

export const salvarPrecoCusto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      chave: string;
      rotulo: string;
      tipo: string;
      custo_entrada_mi_centavos: number;
      custo_saida_mi_centavos: number;
      custo_execucao_centavos: number;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await (supabaseAdmin as any)
      .from("custo_precos")
      .upsert({ ...data, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
    await registrarAcao(supabaseAdmin, context.userId, null, "preco_custo_atualizado", { ...data });
    return { ok: true };
  });

export const acaoConta = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      contaId: string;
      acao:
        | "trocar_plano"
        | "conceder_trial"
        | "pagamento_manual"
        | "suspender"
        | "reativar"
        | "cancelar_assinatura";
      planoCodigo?: string;
      dias?: number;
      observacao?: string;
    }) => data,
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const agora = new Date();

    if (data.acao === "trocar_plano" && data.planoCodigo) {
      const { data: plano } = await admin
        .from("planos")
        .select("preco_mensal_centavos")
        .eq("codigo", data.planoCodigo)
        .maybeSingle();
      await admin.from("contas").update({ plano_codigo: data.planoCodigo }).eq("id", data.contaId);
      await admin
        .from("assinaturas")
        .update({
          plano_codigo: data.planoCodigo,
          valor_centavos: plano?.preco_mensal_centavos ?? 0,
        })
        .eq("conta_id", data.contaId);
    }

    if (data.acao === "conceder_trial") {
      const dias = data.dias && data.dias > 0 ? data.dias : 14;
      const fim = new Date(agora.getTime() + dias * 86400000);
      await admin
        .from("assinaturas")
        .update({ situacao: "trial", trial_fim: fim.toISOString(), cancelada_em: null })
        .eq("conta_id", data.contaId);
      await admin.from("contas").update({ status: "ativa" }).eq("id", data.contaId);
    }

    if (data.acao === "pagamento_manual") {
      const { data: conta } = await admin
        .from("contas")
        .select("plano_codigo, planos:planos(preco_mensal_centavos)")
        .eq("id", data.contaId)
        .maybeSingle();
      const proxima = new Date(agora);
      proxima.setMonth(proxima.getMonth() + 1);
      await admin
        .from("assinaturas")
        .update({
          situacao: "ativa",
          origem: "manual",
          valor_centavos: conta?.planos?.preco_mensal_centavos ?? 0,
          proxima_renovacao: proxima.toISOString(),
          cancelada_em: null,
          observacao: data.observacao ?? null,
        })
        .eq("conta_id", data.contaId);
      await admin.from("contas").update({ status: "ativa" }).eq("id", data.contaId);
    }

    if (data.acao === "suspender" || data.acao === "reativar") {
      await admin
        .from("contas")
        .update({ status: data.acao === "suspender" ? "suspensa" : "ativa" })
        .eq("id", data.contaId);
    }

    if (data.acao === "cancelar_assinatura") {
      await admin
        .from("assinaturas")
        .update({ situacao: "cancelada", cancelada_em: agora.toISOString() })
        .eq("conta_id", data.contaId);
      await admin.from("contas").update({ plano_codigo: "free" }).eq("id", data.contaId);
    }

    await registrarAcao(admin, context.userId, data.contaId, data.acao, { ...data });
    return { ok: true };
  });

export const reprocessarEventoKiwify = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { eventoId: string }) => data)
  .handler(async ({ data, context }) => {
    await assertAdmin(context.supabase as any, context.userId);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const admin = supabaseAdmin as any;
    const { data: evento } = await admin
      .from("kiwify_eventos")
      .select("*")
      .eq("id", data.eventoId)
      .maybeSingle();
    if (!evento) throw new Error("Evento não encontrado.");
    const { aplicarEventoKiwify } = await import("./kiwify.server");
    const resultado = await aplicarEventoKiwify(admin, evento);
    await registrarAcao(admin, context.userId, evento.conta_id, "kiwify_reprocessado", {
      eventoId: data.eventoId,
      resultado,
    });
    return resultado;
  });
