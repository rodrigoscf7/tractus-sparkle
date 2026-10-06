// Assistente de suporte: responde dúvidas de uso, diagnostica a conta e PROPÕE
// ações. Nunca altera a conta da pessoa: a ação proposta é validada aqui contra
// uma lista fechada, gravada na mensagem e só executada pelo app depois que a
// pessoa confirma (src/lib/suporte.functions.ts).
//
// Chamado só pelas server functions de src/lib/suporte.functions.ts
// (x-agent-secret), que tiram conta_id e user_id da sessão: nada aqui confia no
// navegador. Dois modos: responder (padrão) e abrir_chamado (encaminhar para uma
// pessoa, depois que a pessoa confirma).
import {
  alertarAdminFalha,
  chamarModeloComFerramentas,
  corsHeaders,
  type FerramentaModelo,
  formatAgentError,
  getServiceClient,
  type MensagemConversa,
  requireAgentAuth,
  setCustoContexto,
} from "../_shared/agent-utils.ts";
import { MANUAL_DO_APP, ROTAS_ATALHO } from "../_shared/ajuda.ts";

const MODELO = Deno.env.get("OPENROUTER_MODEL_SUPORTE") ?? "anthropic/claude-haiku-4.5";
const HISTORICO_MAX = 20;

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

// Espelho dos ids do app (src/lib/carrossel-template.ts e src/lib/carrossel-fontes.ts).
// O bundle da edge function não alcança src/; ao mudar lá, mude aqui.
const MODELOS_CARROSSEL = ["tweet", "editorial", "marca-texto"];
const FONTES_CARROSSEL: Record<string, string> = {
  "inter": "Inter",
  "montserrat": "Montserrat",
  "poppins": "Poppins",
  "dm-sans": "DM Sans",
  "archivo": "Archivo",
  "playfair": "Playfair Display",
  "dm-serif": "DM Serif Display",
  "lora": "Lora",
  "merriweather": "Merriweather",
  "libre-baskerville": "Libre Baskerville",
};

type Db = ReturnType<typeof getServiceClient>;

const SYSTEM = `Você é o assistente de suporte da prevIA, um app de conteúdo para advogados. Você ajuda a pessoa a usar e configurar o app e resolve o que for possível.

COMO RESPONDER
- Português do Brasil, direto e curto (até umas 120 palavras). Passo a passo em lista numerada.
- Fale só sobre a prevIA. Para qualquer outro assunto, diga em uma frase que você só ajuda com o app.
- Antes de explicar algo genérico, olhe o CONTEXTO DA CONTA: ele tem os dados reais da pessoa. Se ela pergunta "por que meu plano não chegou?", responda com o motivo que está no contexto.
- Nunca invente tela, botão, função, prazo ou limite que não esteja no manual abaixo. Se não souber, diga que não sabe e ofereça falar com uma pessoa.
- Ao dizer onde fica algo, use exatamente o caminho do manual. Não junte telas diferentes num mesmo caminho.
- Datas: use as do contexto. Não calcule dia da semana por conta própria.
- Não mostre IDs técnicos. Não use travessão (—).
- Atalhos: use links em markdown só para estas rotas: ${Object.entries(ROTAS_ATALHO).map(([r, n]) => `${r} (${n})`).join(", ")} e /aprovacao/<id> de um roteiro. Ex.: [Abrir Configurações](/configuracoes).

AÇÕES
- Você tem ferramentas para fazer coisas na conta. Use uma SOMENTE quando a pessoa pedir para você fazer (ex.: "troca a fonte", "muda meus dias", "adiciona esse perfil"). Se ela só perguntar como se faz, explique e ofereça fazer por ela.
- Uma ação por resposta. Ela só acontece depois que a pessoa toca em Confirmar. Diga isso em uma frase ("Confirme abaixo e eu aplico.").
- Não existe ação para: cancelar ou mudar a assinatura, cobrança, nota fiscal, reembolso, trocar e-mail ou senha, apagar dados, editar o texto de um roteiro ou do DNA viral. Nesses casos explique e use falar_com_pessoa.
- Se a pessoa estiver frustrada, pedir um humano ou o problema não estiver no manual, use falar_com_pessoa com um resumo do problema.

MANUAL DO APP
${MANUAL_DO_APP}`;

// ---------------------------------------------------------------------------
// Retrato da conta
// ---------------------------------------------------------------------------

type PautaPlano = { dia: string; data: string; tema: string; removida?: boolean };

type Retrato = {
  texto: string;
  perfilId: string | null;
  limiteReferencias: number;
  referencias: { id: string; handle: string; ativo: boolean }[];
  plano: { id: string; status: string; pautas: PautaPlano[] } | null;
  aprovadas: { id: string; tema: string }[];
};

/**
 * Data (dd/mm) do próximo domingo em que o cron cria os planos (12h de Brasília).
 * Calculada aqui: o modelo errava ao contar dias da semana sozinho.
 */
function proximoDomingo(): string {
  const agora = new Date();
  const sp = new Date(agora.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  let dias = (7 - sp.getDay()) % 7;
  if (dias === 0 && sp.getHours() >= 12) dias = 7;
  sp.setDate(sp.getDate() + dias);
  return `${String(sp.getDate()).padStart(2, "0")}/${String(sp.getMonth() + 1).padStart(2, "0")}`;
}

function dataCurta(iso: string | null | undefined): string {
  if (!iso) return "?";
  const [, m, d] = String(iso).slice(0, 10).split("-");
  return `${d}/${m}`;
}

async function montarRetrato(db: Db, contaId: string, userId: string, rota: string): Promise<Retrato> {
  const ciclo = new Date().toISOString().slice(0, 8) + "01";
  const [
    { data: conta },
    { data: assinatura },
    { data: uso },
    { data: onboarding },
    { data: refs },
    { data: plano },
    { data: pautasEspera },
    { data: pautasAprovadas },
    { count: aparelhos },
  ] = await Promise.all([
    db.from("contas").select("status, plano_codigo, planos:planos(nome, limite_referencias, limite_roteiros_mes, limite_carrosseis_mes)").eq("id", contaId).maybeSingle(),
    db.from("assinaturas").select("situacao, trial_fim, proxima_renovacao").eq("conta_id", contaId).order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    db.from("uso_mensal").select("tipo, quantidade").eq("conta_id", contaId).eq("ciclo", ciclo),
    db.from("onboarding_respostas").select("concluido_em, perfil_id").eq("conta_id", contaId).maybeSingle(),
    db.from("perfis_referencia").select("id, handle, ativo").eq("conta_id", contaId).order("criado_em"),
    db.from("planos_semanais").select("id, status, erro, semana_inicio, criado_em, relatorio").eq("conta_id", contaId).order("criado_em", { ascending: false }).limit(1).maybeSingle(),
    db.from("pautas_geradas").select("id, tema").eq("conta_id", contaId).eq("status", "aguardando_aprovacao").order("criado_em", { ascending: false }).limit(5),
    db.from("pautas_geradas").select("id, tema, carrosseis:carrosseis(id)").eq("conta_id", contaId).in("status", ["aguardando_aprovacao", "aprovada"]).order("criado_em", { ascending: false }).limit(5),
    db.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", userId),
  ]);

  const perfilId = (onboarding?.perfil_id as string | null) ?? null;
  const { data: perfil } = perfilId
    ? await db.from("perfis").select("nome, ritmo_dias, template_carrossel").eq("id", perfilId).maybeSingle()
    : { data: null };

  const planoInfo = (conta?.planos ?? {}) as Record<string, unknown>;
  const usoMap = Object.fromEntries((uso ?? []).map((u) => [u.tipo, u.quantidade]));
  const referencias = (refs ?? []).map((r) => ({ id: r.id as string, handle: r.handle as string, ativo: Boolean(r.ativo) }));
  const ativas = referencias.filter((r) => r.ativo).length;
  const limiteReferencias = Number(planoInfo.limite_referencias ?? 5);
  const template = (perfil?.template_carrossel ?? {}) as Record<string, string>;
  const pautasPlano = ((plano?.relatorio as { pautas?: PautaPlano[] } | null)?.pautas ?? []);
  const aprovadas = (pautasAprovadas ?? []).map((p) => ({
    id: p.id as string,
    tema: String(p.tema ?? ""),
    temCarrossel: Array.isArray(p.carrosseis) ? p.carrosseis.length > 0 : Boolean(p.carrosseis),
  }));

  const agora = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    dateStyle: "full",
    timeStyle: "short",
  }).format(new Date());

  const linhas = [
    "CONTEXTO DA CONTA (dados reais; use para diagnosticar, não mostre IDs):",
    `- Agora: ${agora} (Brasília). Tela aberta: ${rota || "?"}`,
    `- Próximo plano automático: domingo ${proximoDomingo()} à tarde (só para conta com assinatura ativa)`,
    `- Conta: ${conta?.status ?? "?"}, plano ${planoInfo.nome ?? conta?.plano_codigo ?? "?"}${conta?.plano_codigo === "free" ? " (teste encerrado, sem assinatura ativa: planos semanais parados)" : ""}`,
    `- Assinatura: ${assinatura?.situacao ?? "sem registro"}${assinatura?.trial_fim ? `, teste até ${dataCurta(assinatura.trial_fim as string)}` : ""}`,
    `- Uso do mês: roteiros ${usoMap["roteiro"] ?? 0}/${planoInfo.limite_roteiros_mes ?? "?"}, carrosséis ${usoMap["carrossel"] ?? 0}/${planoInfo.limite_carrosseis_mes ?? "?"}, referências ativas ${ativas}/${limiteReferencias}`,
    `- Onboarding: ${onboarding?.concluido_em ? "concluído" : "NÃO concluído"}`,
    `- Dias de postar: ${((perfil?.ritmo_dias as number[] | null) ?? []).map((d) => DIAS[d]).join(", ") || "não definidos"}`,
    `- Template do carrossel: modelo ${template.modelo ?? "tweet"}, fonte dos títulos ${FONTES_CARROSSEL[template.fonte_titulo] ?? "Inter"}, fonte do texto ${FONTES_CARROSSEL[template.fonte_texto] ?? "Inter"}, fundo ${template.cor_fundo ?? "padrão"}, texto ${template.cor_texto ?? "padrão"}, destaque ${template.cor_destaque ?? "padrão"}, arroba ${template.arroba ? "@" + template.arroba : "não preenchida"}, nome ${template.nome_exibicao || "não preenchido"}`,
    `- Referências: ${referencias.length ? referencias.map((r) => `@${r.handle}${r.ativo ? "" : " (desativada)"}`).join(", ") : "nenhuma"}`,
  ];

  if (plano) {
    linhas.push(
      `- Plano da semana mais recente: status "${plano.status}", semana de ${dataCurta(plano.semana_inicio as string)}, pedido em ${dataCurta(plano.criado_em as string)}${plano.erro ? `, motivo do erro: ${plano.erro}` : ""}`,
    );
    pautasPlano.forEach((p, i) =>
      linhas.push(`  ${i + 1}. ${p.dia} ${dataCurta(p.data)}: ${p.tema}${p.removida ? " (tirada da semana)" : ""}`)
    );
  } else {
    linhas.push("- Plano da semana: nenhum ainda");
  }
  linhas.push(
    `- Roteiros esperando aprovação: ${(pautasEspera ?? []).length ? (pautasEspera ?? []).map((p) => `${p.tema} (/aprovacao/${p.id})`).join("; ") : "nenhum"}`,
    `- Roteiros já escritos recentes (para ler ou aprovados): ${aprovadas.length ? aprovadas.map((p) => `[ref ${p.id}] ${p.tema}, carrossel: ${p.temCarrossel ? "já gerado" : "não gerado"}`).join("; ") : "nenhum"}`,
    `- Notificações: ${aparelhos ? `ativas em ${aparelhos} aparelho(s)` : "não ativadas neste usuário"}`,
  );

  return {
    texto: linhas.join("\n"),
    perfilId,
    limiteReferencias,
    referencias,
    plano: plano ? { id: plano.id as string, status: plano.status as string, pautas: pautasPlano } : null,
    aprovadas,
  };
}

// ---------------------------------------------------------------------------
// Ações
// ---------------------------------------------------------------------------

const numeroPauta = { type: "integer", minimum: 1, description: "Número do vídeo no plano, como no contexto." };
const hex = { type: "string", pattern: "^#[0-9a-fA-F]{6}$" };

const FERRAMENTAS: FerramentaModelo[] = [
  { nome: "pedir_plano_semana", descricao: "Pede o plano da semana agora, sem esperar o domingo. Só faz sentido sem plano recente ou com o último em erro.", parametros: { type: "object", properties: {} } },
  { nome: "trocar_pauta_do_plano", descricao: "Gera outra opção para um vídeo do plano pronto (antes de aprovar).", parametros: { type: "object", properties: { numero: numeroPauta, pedido: { type: "string", description: "O que a pessoa quer no lugar, se disse." } }, required: ["numero"] } },
  { nome: "tirar_pauta_do_plano", descricao: "Tira um vídeo do plano pronto: ele não vira roteiro.", parametros: { type: "object", properties: { numero: numeroPauta }, required: ["numero"] } },
  { nome: "devolver_pauta_ao_plano", descricao: "Volta para a semana um vídeo que foi tirado do plano.", parametros: { type: "object", properties: { numero: numeroPauta }, required: ["numero"] } },
  { nome: "aprovar_plano", descricao: "Aprova o plano pronto: os vídeos mantidos viram roteiros.", parametros: { type: "object", properties: {} } },
  { nome: "mudar_dias_de_postar", descricao: "Muda os dias de postar (ritmo). Vale a partir do próximo plano.", parametros: { type: "object", properties: { dias: { type: "array", items: { type: "string", enum: DIAS }, minItems: 1, maxItems: 7 } }, required: ["dias"] } },
  { nome: "adicionar_referencia", descricao: "Adiciona um perfil do Instagram como referência.", parametros: { type: "object", properties: { perfil: { type: "string", description: "@ ou link do perfil" } }, required: ["perfil"] } },
  { nome: "desativar_referencia", descricao: "Desativa uma referência: ela deixa de ser lida nos próximos planos.", parametros: { type: "object", properties: { perfil: { type: "string" } }, required: ["perfil"] } },
  {
    nome: "mudar_template_carrossel",
    descricao: `Muda a aparência dos carrosséis. Modelos: tweet, editorial, marca-texto. Fontes (id: nome): ${Object.entries(FONTES_CARROSSEL).map(([id, n]) => `${id}: ${n}`).join(", ")}. Cores em #RRGGBB. Envie só o que mudar.`,
    parametros: {
      type: "object",
      properties: {
        modelo: { type: "string", enum: MODELOS_CARROSSEL },
        fonte_titulo: { type: "string", enum: Object.keys(FONTES_CARROSSEL) },
        fonte_texto: { type: "string", enum: Object.keys(FONTES_CARROSSEL) },
        cor_fundo: hex,
        cor_texto: hex,
        cor_destaque: hex,
        arroba: { type: "string" },
        nome_exibicao: { type: "string" },
      },
    },
  },
  { nome: "gerar_carrossel", descricao: "Gera (ou regera) o carrossel de um roteiro já escrito, aprovado ou não.", parametros: { type: "object", properties: { pauta_ref: { type: "string", description: "A ref do roteiro, do contexto." } }, required: ["pauta_ref"] } },
  { nome: "regerar_manual_de_marca", descricao: "Escreve de novo o DNA viral (o documento de posicionamento, voz e ganchos) a partir das respostas do onboarding.", parametros: { type: "object", properties: {} } },
  { nome: "falar_com_pessoa", descricao: "Encaminha a conversa para a equipe de suporte.", parametros: { type: "object", properties: { resumo: { type: "string", description: "O problema em 1 a 3 frases, para a equipe." } }, required: ["resumo"] } },
];

type AcaoProposta = { tipo: string; args: Record<string, unknown>; descricao: string; status: "proposta" };

/** Mesmo critério de src/lib/onboarding-perguntas.ts (normalizarHandle). */
function normalizarHandle(bruto: string): string {
  return bruto.trim()
    .replace(/^(https?:\/\/)?(www\.)?instagram\.com\//i, "")
    .replace(/[/?#].*$/, "")
    .replace(/^@+/, "")
    .trim()
    .toLowerCase();
}

/** Valida a ação e escreve o que vai acontecer em linguagem simples. Erro devolve o motivo. */
function validarAcao(
  chamada: { nome: string; args: Record<string, unknown> },
  r: Retrato,
): AcaoProposta | { erro: string } {
  const a = chamada.args ?? {};
  const pautaDoNumero = (n: unknown): { erro: string } | { i: number; p: PautaPlano } => {
    if (!r.plano || r.plano.status !== "pronto") return { erro: "o plano não está pronto para alterar" };
    const i = Number(n) - 1;
    const p = r.plano.pautas[i];
    if (!Number.isInteger(i) || !p) return { erro: "esse vídeo não existe no plano" };
    return { i, p };
  };
  const ok = (tipo: string, args: Record<string, unknown>, descricao: string): AcaoProposta =>
    ({ tipo, args, descricao, status: "proposta" });

  switch (chamada.nome) {
    case "pedir_plano_semana":
      return ok("pedir_plano_semana", {}, "Pedir o plano da semana agora (fica pronto em uns 5 minutos)");
    case "trocar_pauta_do_plano": {
      const x = pautaDoNumero(a.numero);
      if ("erro" in x) return x;
      const pedido = String(a.pedido ?? "").trim().slice(0, 300);
      return ok("trocar_pauta_do_plano", { plano_id: r.plano!.id, indice: x.i, pedido }, `Trocar o vídeo de ${x.p.dia} ("${x.p.tema}") por outra opção${pedido ? `: ${pedido}` : ""}`);
    }
    case "tirar_pauta_do_plano":
    case "devolver_pauta_ao_plano": {
      const x = pautaDoNumero(a.numero);
      if ("erro" in x) return x;
      const tirar = chamada.nome === "tirar_pauta_do_plano";
      if (tirar && x.p.removida) return { erro: "esse vídeo já está fora da semana" };
      if (!tirar && !x.p.removida) return { erro: "esse vídeo já está na semana" };
      if (tirar && r.plano!.pautas.filter((p) => !p.removida).length <= 1) {
        return { erro: "a semana precisa de pelo menos um vídeo" };
      }
      return ok(chamada.nome, { plano_id: r.plano!.id, indice: x.i, removida: tirar }, `${tirar ? "Tirar da semana" : "Voltar para a semana"} o vídeo de ${x.p.dia} ("${x.p.tema}")`);
    }
    case "aprovar_plano": {
      if (!r.plano || r.plano.status !== "pronto") return { erro: "não há plano pronto para aprovar" };
      const n = r.plano.pautas.filter((p) => !p.removida).length;
      return ok("aprovar_plano", { plano_id: r.plano.id }, `Aprovar o plano: ${n} vídeo(s) viram roteiro`);
    }
    case "mudar_dias_de_postar": {
      const dias = [...new Set((Array.isArray(a.dias) ? a.dias : []).map((d) => DIAS.indexOf(String(d))))]
        .filter((d) => d >= 0)
        .sort((x, y) => x - y);
      if (!dias.length) return { erro: "nenhum dia válido" };
      return ok("mudar_dias_de_postar", { dias }, `Mudar seus dias de postar para: ${dias.map((d) => DIAS[d]).join(", ")}`);
    }
    case "adicionar_referencia": {
      const handle = normalizarHandle(String(a.perfil ?? ""));
      if (!handle || !/^[a-z0-9._]{1,30}$/.test(handle)) return { erro: "esse @ não parece um perfil do Instagram" };
      if (r.referencias.some((ref) => ref.handle === handle && ref.ativo)) return { erro: `@${handle} já é uma referência ativa` };
      if (r.referencias.filter((ref) => ref.ativo).length >= r.limiteReferencias) {
        return { erro: `o plano permite até ${r.limiteReferencias} referências ativas; desative uma antes` };
      }
      return ok("adicionar_referencia", { handle }, `Adicionar @${handle} às suas referências`);
    }
    case "desativar_referencia": {
      const handle = normalizarHandle(String(a.perfil ?? ""));
      const ref = r.referencias.find((x) => x.handle === handle && x.ativo);
      if (!ref) return { erro: `@${handle} não está entre as referências ativas` };
      return ok("desativar_referencia", { referencia_id: ref.id, handle }, `Desativar a referência @${handle}`);
    }
    case "mudar_template_carrossel": {
      const mudancas: Record<string, string> = {};
      const partes: string[] = [];
      if (a.modelo !== undefined) {
        if (!MODELOS_CARROSSEL.includes(String(a.modelo))) return { erro: "modelo inexistente" };
        mudancas.modelo = String(a.modelo);
        partes.push(`modelo ${a.modelo}`);
      }
      for (const campo of ["fonte_titulo", "fonte_texto"] as const) {
        if (a[campo] === undefined) continue;
        const id = String(a[campo]);
        if (!FONTES_CARROSSEL[id]) return { erro: "fonte fora da lista" };
        mudancas[campo] = id;
        partes.push(`${campo === "fonte_titulo" ? "fonte dos títulos" : "fonte do texto"} ${FONTES_CARROSSEL[id]}`);
      }
      for (const campo of ["cor_fundo", "cor_texto", "cor_destaque"] as const) {
        if (a[campo] === undefined) continue;
        const cor = String(a[campo]);
        if (!/^#[0-9a-fA-F]{6}$/.test(cor)) return { erro: "cor inválida" };
        mudancas[campo] = cor.toUpperCase();
        partes.push(`${campo.replace("cor_", "cor de ")} ${cor.toUpperCase()}`);
      }
      if (a.arroba !== undefined) {
        mudancas.arroba = String(a.arroba).replace(/^@/, "").trim().slice(0, 40);
        partes.push(`arroba @${mudancas.arroba}`);
      }
      if (a.nome_exibicao !== undefined) {
        mudancas.nome_exibicao = String(a.nome_exibicao).trim().slice(0, 40);
        partes.push(`nome de exibição "${mudancas.nome_exibicao}"`);
      }
      if (!partes.length) return { erro: "nada para mudar" };
      if (!r.perfilId) return { erro: "perfil não encontrado" };
      return ok("mudar_template_carrossel", { perfil_id: r.perfilId, mudancas }, `Mudar o template do carrossel: ${partes.join(", ")}`);
    }
    case "gerar_carrossel": {
      const pauta = r.aprovadas.find((p) => p.id === String(a.pauta_ref ?? ""));
      if (!pauta) return { erro: "esse roteiro não está entre os já escritos" };
      return ok("gerar_carrossel", { pauta_id: pauta.id }, `Gerar o carrossel do roteiro "${pauta.tema}"`);
    }
    case "regerar_manual_de_marca":
      return ok("regerar_manual_de_marca", {}, "Escrever de novo o seu DNA viral (leva cerca de 2 minutos)");
    case "falar_com_pessoa": {
      const resumo = String(a.resumo ?? "").trim().slice(0, 500);
      return ok("falar_com_pessoa", { resumo }, "Enviar esta conversa para a equipe de suporte");
    }
    default:
      return { erro: "ação desconhecida" };
  }
}

/** Atalho fora da lista vira texto simples: o widget só segue rotas conhecidas. */
function limparLinks(texto: string): string {
  return texto.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (inteiro, rotulo: string, alvo: string) => {
    const rota = alvo.trim();
    const permitida = rota in ROTAS_ATALHO || /^\/aprovacao\/[0-9a-f-]{36}$/.test(rota);
    return permitida ? inteiro : rotulo;
  });
}

// ---------------------------------------------------------------------------

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  try {
    const { acao: modo, conversa_id, conta_id, user_id, rota, resumo } = await req.json() as {
      acao?: string;
      conversa_id: string;
      conta_id: string;
      user_id: string;
      rota?: string;
      resumo?: string;
    };
    if (!conversa_id || !conta_id || !user_id) return json({ ok: false, error: "parâmetros obrigatórios" }, 400);

    const db = getServiceClient();
    const { data: conversa } = await db
      .from("suporte_conversas")
      .select("id")
      .eq("id", conversa_id)
      .eq("conta_id", conta_id)
      .eq("user_id", user_id)
      .maybeSingle();
    if (!conversa) return json({ ok: false, error: "conversa não encontrada" }, 404);

    // ============ ENCAMINHAR PARA UMA PESSOA ============
    if (modo === "abrir_chamado") {
      const texto = String(resumo ?? "").trim().slice(0, 500) || "Pediu para falar com uma pessoa.";
      const { data: chamado, error } = await db
        .from("suporte_chamados")
        .insert({ conta_id, user_id, conversa_id, resumo: texto })
        .select("id")
        .single();
      if (error) throw new Error(`abrir chamado: ${error.message}`);
      await db
        .from("suporte_conversas")
        .update({ status: "encaminhada", atualizado_em: new Date().toISOString() })
        .eq("id", conversa_id);
      const { data: conta } = await db.from("contas").select("nome").eq("id", conta_id).maybeSingle();
      // O alerta de admin é por push e agrupa por texto no dia: cada chamado tem o seu.
      await alertarAdminFalha(
        "suporte",
        `chamado de ${conta?.nome ?? "conta"}: ${texto}`,
        `suporte:chamado:${chamado.id}`,
      );
      return json({ ok: true, chamado_id: chamado.id });
    }

    const { data: linhas } = await db
      .from("suporte_mensagens")
      .select("papel, conteudo, acao")
      .eq("conversa_id", conversa_id)
      .order("criado_em", { ascending: false })
      .limit(HISTORICO_MAX);

    // O modelo vê o que aconteceu com cada ação proposta antes.
    const mensagens: MensagemConversa[] = (linhas ?? []).reverse().map((m) => {
      const acao = m.acao as { descricao?: string; status?: string; resultado?: string } | null;
      const nota = acao
        ? `\n[Ação proposta: ${acao.descricao} | situação: ${acao.status}${acao.resultado ? ` | ${acao.resultado}` : ""}]`
        : "";
      return { papel: m.papel as "usuario" | "assistente", texto: `${m.conteudo}${nota}`.trim() || "(vazio)" };
    });

    const retrato = await montarRetrato(db, conta_id, user_id, rota ?? "");
    setCustoContexto({ contaId: conta_id, perfilId: retrato.perfilId, agente: "suporte", tipo: "suporte" });

    const resposta = await chamarModeloComFerramentas({
      system: SYSTEM,
      contexto: retrato.texto,
      mensagens,
      ferramentas: FERRAMENTAS,
      model: MODELO,
    });

    let acao: AcaoProposta | null = null;
    let texto = limparLinks(resposta.texto);
    if (resposta.chamada) {
      const validada = validarAcao(resposta.chamada, retrato);
      if ("erro" in validada) {
        // Ação inválida não chega à pessoa: ela recebe a explicação.
        texto = `${texto ? texto + "\n\n" : ""}Não consigo fazer isso agora: ${validada.erro}.`;
      } else {
        acao = validada;
        if (!texto) texto = "Posso fazer isso por você. Confirme abaixo e eu aplico.";
      }
    }

    const { data: salva, error } = await db
      .from("suporte_mensagens")
      .insert({ conversa_id, papel: "assistente", conteudo: texto, acao })
      .select("id, papel, conteudo, acao, criado_em")
      .single();
    if (error) throw new Error(`salvar resposta: ${error.message}`);

    await db.from("suporte_conversas").update({ atualizado_em: new Date().toISOString() }).eq("id", conversa_id);
    return json({ ok: true, mensagem: salva });
  } catch (e) {
    console.error("suporte-agent", e);
    return json({ ok: false, error: formatAgentError(e) }, 500);
  }
});
