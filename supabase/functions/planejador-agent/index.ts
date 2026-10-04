// Planejador: monta o plano de vídeos da semana a partir dos virais das referências.
//
// Máquina de estados em `planos_semanais.status`, avançada por ticks do cron:
//   coletando  → últimos posts de cada referência (Apify), em lotes por orçamento de tempo
//   analisando → ranking por outlier + análise do top 5 (vídeo inteiro / todos os slides),
//                reaproveitando `analises_virais` quando o post já foi analisado
//   planejando → plano da semana no tom e no nicho do perfil
//   pronto     → aguardando a aprovação do assinante
//
// - Modo orquestrador (sem plano_id): o cron chama a cada 3 min. Reserva até
//   APIFY_CONCORRENCIA planos e dispara um worker por plano.
// - Modo worker (?plano_id=...): executa UM passo de um plano e salva o estado.
import {
  alertarAdminFalha,
  corsHeaders,
  formatAgentError,
  getServiceClient,
  registrarCustoScraping,
  requireAgentAuth,
  setCustoContexto,
  setStatus,
} from "../_shared/agent-utils.ts";
import { postsDoPerfil, type PostInstagram } from "../_shared/apify.ts";
import {
  ANALISE_MODEL,
  type AnaliseViral,
  analisarViral,
  type Candidato,
  diasDoRitmo,
  escolherVirais,
  gerarPlano,
  type PautaDoPlano,
  rankearVirais,
  trocarPautaDoPlano,
} from "../_shared/viral.ts";

/** Execuções simultâneas do Apify que o planejador pode ocupar (o plano da conta permite 5). */
const APIFY_CONCORRENCIA = 4;
const POSTS_POR_PERFIL = 15;
const APIFY_TIMEOUT_MS = 100_000;
/** Só começa a coletar outra referência se o passo ainda estiver dentro deste orçamento. */
const COLETA_ORCAMENTO_MS = 60_000;
const TOTAL_VIRAIS = 5;
/** Reservas além do top 5: entram no lugar de um post cuja mídia não pôde ser lida. */
const VIRAIS_RESERVA = 3;
const ANALISES_SIMULTANEAS = 3;
const DIAS_RECENCIA = 45;
/** Sem posts recentes o bastante, amplia a janela em vez de entregar plano vazio. */
const DIAS_RECENCIA_AMPLIADA = 120;
const RITMO_PADRAO = [1, 3, 5];
/** Quanto o primeiro plano espera o manual de marca, escrito em paralelo no onboarding. */
const ESPERA_MANUAL_MS = 15 * 60_000;

type Db = ReturnType<typeof getServiceClient>;

type Plano = {
  id: string;
  conta_id: string;
  perfil_id: string | null;
  semana_inicio: string;
  status: string;
  etapa_dados: EtapaDados;
  criado_em: string;
};

type AnaliseEscolhida = {
  analise_viral_id: string;
  handle: string;
  url: string;
  formato: Candidato["formato"];
  metrica: number;
  mediana: number;
  indice: number;
};

type EtapaDados = {
  posts?: Record<string, PostInstagram[]>;
  erros_coleta?: Record<string, string>;
  analises?: AnaliseEscolhida[];
  falhas_analise?: { url: string; erro: string }[];
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Só o que o ranking e a análise usam: o resultado bruto do Apify é grande demais para guardar. */
function reduzirPost(p: PostInstagram): PostInstagram {
  const filhos = Array.isArray(p.childPosts) ? p.childPosts : [];
  return {
    url: p.url,
    type: p.type,
    productType: p.productType,
    videoPlayCount: p.videoPlayCount,
    videoViewCount: p.videoViewCount,
    likesCount: p.likesCount,
    commentsCount: p.commentsCount,
    timestamp: p.timestamp,
    caption: String(p.caption ?? "").slice(0, 2200),
    videoUrl: p.videoUrl,
    displayUrl: p.displayUrl,
    images: p.images,
    childPosts: filhos.map((f) => ({ displayUrl: (f as PostInstagram)?.displayUrl })),
  };
}

/** Avança o plano: novo status, estado salvo, tentativas zeradas e reserva liberada. */
async function avancar(db: Db, id: string, campos: Record<string, unknown>) {
  const { error } = await db
    .from("planos_semanais")
    .update({
      ...campos,
      tentativas: 0,
      reservado_em: null,
      erro: null,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", id);
  if (error) throw new Error(`salvar plano: ${error.message}`);
}

/** Falha definitiva (não adianta tentar de novo): o plano vai para 'erro'. */
async function falhar(db: Db, plano: Plano, motivo: string) {
  await db
    .from("planos_semanais")
    .update({ status: "erro", erro: motivo, reservado_em: null, atualizado_em: new Date().toISOString() })
    .eq("id", plano.id);
  await alertarAdminFalha("planejador", `plano ${plano.id.slice(0, 8)}: ${motivo}`);
}

async function respostasDoOnboarding(db: Db, contaId: string) {
  const { data } = await db
    .from("onboarding_respostas")
    .select("respostas")
    .eq("conta_id", contaId)
    .maybeSingle();
  return (data?.respostas ?? {}) as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Passo 1: coletar
// ---------------------------------------------------------------------------

async function handlesDaConta(db: Db, contaId: string): Promise<string[]> {
  const { data: refs } = await db
    .from("perfis_referencia")
    .select("handle")
    .eq("conta_id", contaId)
    .eq("ativo", true);
  const proprias = (refs ?? []).map((r) => String(r.handle)).filter(Boolean);
  if (proprias.length) return proprias;

  // Sem referências próprias: usa o catálogo da área de atuação.
  const respostas = await respostasDoOnboarding(db, contaId);
  const { data: sugeridas } = await db
    .from("referencias_sugeridas")
    .select("handle")
    .eq("area_atuacao", String(respostas.area_atuacao ?? ""))
    .eq("ativo", true)
    .order("ordem");
  return (sugeridas ?? []).map((s) => String(s.handle)).filter(Boolean);
}

async function coletar(db: Db, plano: Plano, apifyToken: string) {
  const inicio = Date.now();
  const dados = plano.etapa_dados;
  const posts = { ...(dados.posts ?? {}) };
  const erros = { ...(dados.erros_coleta ?? {}) };

  const handles = await handlesDaConta(db, plano.conta_id);
  if (!handles.length) {
    return await falhar(db, plano, "conta sem referências próprias nem sugeridas para a área");
  }

  const pendentes = handles.filter((h) => !(h in posts) && !(h in erros));
  for (const handle of pendentes) {
    if (Date.now() - inicio > COLETA_ORCAMENTO_MS) break;
    try {
      const brutos = await postsDoPerfil(apifyToken, handle, POSTS_POR_PERFIL, APIFY_TIMEOUT_MS);
      posts[handle] = brutos.map(reduzirPost);
      await registrarCustoScraping(plano.conta_id, plano.perfil_id, brutos.length, "planejador");
    } catch (e) {
      erros[handle] = formatAgentError(e);
    }
  }

  const faltam = handles.filter((h) => !(h in posts) && !(h in erros)).length;
  const etapa = { ...dados, posts, erros_coleta: erros };

  if (faltam > 0) {
    // Progresso parcial: salva e o próximo tick continua de onde parou.
    await avancar(db, plano.id, { etapa_dados: etapa });
    return { passo: "coletando", coletadas: Object.keys(posts).length, faltam };
  }
  if (!Object.keys(posts).length) {
    return await falhar(db, plano, `nenhuma referência pôde ser lida (${Object.values(erros)[0]})`);
  }
  await avancar(db, plano.id, { status: "analisando", etapa_dados: etapa });
  return { passo: "coletando→analisando", coletadas: Object.keys(posts).length, erros: Object.keys(erros).length };
}

// ---------------------------------------------------------------------------
// Passo 2: analisar
// ---------------------------------------------------------------------------

async function analiseDoCache(db: Db, url: string): Promise<string | null> {
  const { data } = await db.from("analises_virais").select("id").eq("url", url).maybeSingle();
  return (data?.id as string | undefined) ?? null;
}

async function salvarAnalise(db: Db, c: Candidato, analise: AnaliseViral): Promise<string> {
  const post = c.post;
  const { error } = await db.from("analises_virais").upsert({
    url: c.url,
    handle: c.handle,
    formato: c.formato,
    metrica: Math.round(c.metrica),
    mediana: c.mediana,
    indice: c.indice,
    likes: typeof post.likesCount === "number" ? post.likesCount : null,
    comentarios: typeof post.commentsCount === "number" ? post.commentsCount : null,
    views: typeof post.videoPlayCount === "number" ? post.videoPlayCount : null,
    postado_em: c.postadoEm,
    legenda: String(post.caption ?? "").slice(0, 2200) || null,
    analise,
    modelo: ANALISE_MODEL,
  }, { onConflict: "url", ignoreDuplicates: true });
  if (error) throw new Error(`salvar análise: ${error.message}`);
  const id = await analiseDoCache(db, c.url);
  if (!id) throw new Error("análise salva mas não encontrada");
  return id;
}

async function analisar(db: Db, plano: Plano) {
  const posts = new Map(Object.entries(plano.etapa_dados.posts ?? {}));
  let ranking = rankearVirais(posts, { diasRecencia: DIAS_RECENCIA });
  if (ranking.length < TOTAL_VIRAIS) {
    ranking = rankearVirais(posts, { diasRecencia: DIAS_RECENCIA_AMPLIADA });
  }
  if (!ranking.length) {
    return await falhar(db, plano, "referências sem posts nos últimos meses");
  }

  // Com poucas referências, o teto por perfil sobe para ainda fechar os 5.
  const fila = escolherVirais(ranking, {
    total: TOTAL_VIRAIS + VIRAIS_RESERVA,
    maxPorPerfil: Math.max(2, Math.ceil((TOTAL_VIRAIS + VIRAIS_RESERVA) / posts.size)),
  });

  const escolhidas: AnaliseEscolhida[] = [];
  const falhas: { url: string; erro: string }[] = [];
  let proximo = 0;
  let emAndamento = 0;

  // Só dispara uma nova análise se as concluídas mais as em andamento ainda não fecham o total.
  await Promise.all(Array.from({ length: ANALISES_SIMULTANEAS }, async () => {
    while (proximo < fila.length && escolhidas.length + emAndamento < TOTAL_VIRAIS) {
      const c = fila[proximo++];
      emAndamento++;
      try {
        const id = (await analiseDoCache(db, c.url)) ?? (await salvarAnalise(db, c, await analisarViral(c)));
        escolhidas.push({
          analise_viral_id: id,
          handle: c.handle,
          url: c.url,
          formato: c.formato,
          metrica: c.metrica,
          mediana: c.mediana,
          indice: c.indice,
        });
      } catch (e) {
        console.error("planejador análise", c.url, e);
        falhas.push({ url: c.url, erro: formatAgentError(e) });
      } finally {
        emAndamento--;
      }
    }
  }));

  if (!escolhidas.length) {
    // Nenhuma mídia pôde ser lida: lança para o tick seguinte tentar de novo.
    throw new Error(`nenhum post pôde ser analisado (${falhas[0]?.erro ?? "sem candidatos"})`);
  }

  // Mantém a ordem do ranking, que é a numeração que o plano vai citar.
  escolhidas.sort((a, b) => b.indice - a.indice);
  await avancar(db, plano.id, {
    status: "planejando",
    // Os posts brutos já cumpriram o papel: o estado fica só com o que o plano usa.
    etapa_dados: { analises: escolhidas, falhas_analise: falhas, erros_coleta: plano.etapa_dados.erros_coleta },
  });
  return { passo: "analisando→planejando", analisadas: escolhidas.length, falhas: falhas.length };
}

// ---------------------------------------------------------------------------
// Passo 3: planejar
// ---------------------------------------------------------------------------

/** Manual, perfil e análises: o que o modelo precisa para planejar ou trocar uma pauta. */
async function contextoDoPlano(db: Db, plano: Plano, escolhidas: AnaliseEscolhida[]) {
  const [{ data: linhas }, { data: manual }, { data: perfil }, respostas] = await Promise.all([
    db.from("analises_virais").select("id, analise").in("id", escolhidas.map((e) => e.analise_viral_id)),
    db.from("dna_relatorios")
      .select("conteudo")
      .eq("conta_id", plano.conta_id)
      .order("versao", { ascending: false })
      .limit(1)
      .maybeSingle(),
    db.from("perfis")
      .select("nome, foco_curadoria, ritmo_dias")
      .eq("id", plano.perfil_id ?? "")
      .maybeSingle(),
    respostasDoOnboarding(db, plano.conta_id),
  ]);

  const porId = new Map((linhas ?? []).map((l) => [l.id as string, l.analise as AnaliseViral]));
  const analises = escolhidas
    .filter((e) => porId.has(e.analise_viral_id))
    .map((e) => ({ escolhida: e, analise: porId.get(e.analise_viral_id)! }));

  return {
    analises,
    ritmo: (perfil?.ritmo_dias as number[] | null)?.length ? perfil!.ritmo_dias as number[] : RITMO_PADRAO,
    entrada: {
      manual: manual?.conteudo,
      perfil: {
        nome: (perfil?.nome as string) ?? "",
        nicho: (respostas.nicho as string) ?? null,
        publico: (respostas.cliente_ideal as string) ?? null,
        area: (respostas.area_atuacao as string) ?? null,
        foco: (perfil?.foco_curadoria as string) ?? null,
      },
      analises: analises.map(({ escolhida, analise }) => ({ candidato: escolhida, analise })),
    },
  };
}

/** Cada pauta aponta para a análise que a inspirou: é o que leva o padrão ao roteiro. */
function ligarAnalise(p: PautaDoPlano, analises: { escolhida: AnaliseEscolhida }[]) {
  const ref = analises[Number(p.inspirado_em) - 1];
  return { ...p, analise_viral_id: ref?.escolhida.analise_viral_id ?? null };
}

async function planejar(db: Db, plano: Plano) {
  const escolhidas = plano.etapa_dados.analises ?? [];
  if (!escolhidas.length) return await falhar(db, plano, "plano sem análises para planejar");

  const { analises, ritmo, entrada } = await contextoDoPlano(db, plano, escolhidas);

  // No onboarding o manual é escrito em paralelo. Sem ele as pautas saem genéricas,
  // então o plano espera alguns ticks; depois do prazo segue sem o manual.
  const idadeMs = Date.now() - Date.parse(plano.criado_em);
  if (!entrada.manual && idadeMs < ESPERA_MANUAL_MS) {
    await avancar(db, plano.id, {});
    return { passo: "planejando", aguardando: "manual de marca" };
  }
  const dias = diasDoRitmo(new Date(`${plano.semana_inicio}T00:00:00Z`), ritmo);
  const gerado = await gerarPlano({ ...entrada, dias });

  if (!Array.isArray(gerado.pautas) || !gerado.pautas.length) {
    throw new Error("plano gerado sem pautas");
  }

  const relatorio = {
    resumo_da_semana: gerado.resumo_da_semana,
    padroes: gerado.padroes ?? [],
    pautas: gerado.pautas.map((p) => ligarAnalise(p, analises)),
    dias,
    posts: analises.map(({ escolhida, analise }, i) => ({
      numero: i + 1,
      ...escolhida,
      gancho: analise.gancho?.texto ?? null,
      porque_funcionou: analise.porque_funcionou ?? null,
      padrao_replicavel: analise.padrao_replicavel ?? null,
    })),
  };

  await avancar(db, plano.id, {
    status: "pronto",
    relatorio,
    pronto_em: new Date().toISOString(),
  });

  // Avisa o assinante. O despacho agrupa e respeita o horário (7h às 22h).
  const { error: pushError } = await db.rpc("enfileirar_notificacao_push", {
    p_perfil_id: plano.perfil_id,
    p_conta_id: plano.conta_id,
    p_tipo: "plano_pronto",
  });
  if (pushError) console.error("planejador push", pushError);

  return { passo: "planejando→pronto", pautas: relatorio.pautas.length };
}

/**
 * Troca uma pauta de um plano pronto, a pedido do assinante. Síncrona: a tela
 * espera a pauta nova (uns 20 segundos).
 */
async function trocarPauta(planoId: string, indice: number, pedido: string | null) {
  const db = getServiceClient();
  const { data } = await db
    .from("planos_semanais")
    .select("id, conta_id, perfil_id, semana_inicio, status, etapa_dados, relatorio, criado_em")
    .eq("id", planoId)
    .maybeSingle();
  if (!data) throw new Error("plano não encontrado");
  if (data.status !== "pronto") throw new Error("só dá para trocar pautas antes de aprovar o plano");

  const plano = data as Plano & { relatorio: Record<string, any> };
  const pautas = (plano.relatorio?.pautas ?? []) as (PautaDoPlano & { removida?: boolean })[];
  const trocada = pautas[indice];
  if (!trocada) throw new Error("pauta não encontrada no plano");

  setCustoContexto({
    contaId: plano.conta_id,
    perfilId: plano.perfil_id,
    agente: "planejador",
    tipo: "troca_pauta",
  });

  const escolhidas = (plano.relatorio.posts ?? []) as AnaliseEscolhida[];
  const { analises, entrada } = await contextoDoPlano(db, plano, escolhidas);
  const nova = ligarAnalise(
    await trocarPautaDoPlano({
      ...entrada,
      trocada,
      outras: pautas.filter((p, i) => i !== indice && !p.removida),
      pedido,
    }),
    analises,
  );

  const atualizadas = pautas.map((p, i) => (i === indice ? nova : p));
  const { error } = await db
    .from("planos_semanais")
    .update({
      relatorio: { ...plano.relatorio, pautas: atualizadas },
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", plano.id)
    .eq("status", "pronto");
  if (error) throw new Error(`salvar troca: ${error.message}`);
  return nova;
}

// ---------------------------------------------------------------------------
// Worker e orquestrador
// ---------------------------------------------------------------------------

async function processarPlano(planoId: string) {
  const db = getServiceClient();
  const { data, error } = await db
    .from("planos_semanais")
    .select("id, conta_id, perfil_id, semana_inicio, status, etapa_dados, criado_em")
    .eq("id", planoId)
    .maybeSingle();
  if (error || !data) throw new Error(`plano ${planoId} não encontrado`);
  const plano = data as Plano;

  setCustoContexto({
    contaId: plano.conta_id,
    perfilId: plano.perfil_id,
    agente: "planejador",
    tipo: "plano_semanal",
  });

  try {
    switch (plano.status) {
      case "coletando": {
        const apifyToken = Deno.env.get("APIFY_API_TOKEN");
        if (!apifyToken) throw new Error("APIFY_API_TOKEN missing");
        return await coletar(db, plano, apifyToken);
      }
      case "analisando":
        return await analisar(db, plano);
      case "planejando":
        return await planejar(db, plano);
      default:
        return { passo: "nenhum", status: plano.status };
    }
  } catch (e) {
    // Falha transitória: guarda o motivo e libera a reserva; o contador de
    // tentativas da reserva decide quando desistir.
    const motivo = formatAgentError(e);
    await db
      .from("planos_semanais")
      .update({ erro: motivo, reservado_em: null, atualizado_em: new Date().toISOString() })
      .eq("id", plano.id);
    throw e;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  const planoId = new URL(req.url).searchParams.get("plano_id");
  const corpo = await req.json().catch(() => ({})) as {
    acao?: string;
    plano_id?: string;
    indice?: number;
    pedido?: string | null;
  };

  // ============ TROCA DE UMA PAUTA (chamada pelo app) ============
  if (corpo.acao === "trocar_pauta") {
    try {
      if (!corpo.plano_id || typeof corpo.indice !== "number") throw new Error("plano_id e indice obrigatórios");
      const pauta = await trocarPauta(corpo.plano_id, corpo.indice, corpo.pedido ?? null);
      return json({ ok: true, pauta });
    } catch (e) {
      console.error("planejador troca", e);
      return json({ ok: false, error: formatAgentError(e) }, 500);
    }
  }

  // ============ MODO WORKER (1 passo de 1 plano) ============
  if (planoId) {
    try {
      const resultado = await processarPlano(planoId);
      return json({ ok: true, plano_id: planoId, ...resultado });
    } catch (e) {
      console.error("planejador worker", planoId, e);
      await setStatus("planejador", "error", `plano ${planoId.slice(0, 8)}: ${formatAgentError(e)}`);
      return json({ ok: false, plano_id: planoId, error: formatAgentError(e) }, 500);
    }
  }

  // ============ MODO ORQUESTRADOR ============
  try {
    const db = getServiceClient();
    const { data: reservados, error } = await db.rpc("reservar_planos_semanais", {
      _limite: APIFY_CONCORRENCIA,
    });
    if (error) throw new Error(`reservar_planos_semanais: ${error.message}`);

    const planos: { plano_id: string; plano_status: string }[] = reservados ?? [];
    // Nada pendente: não toca no status do agente (o tick roda a cada 3 minutos).
    if (!planos.length) return json({ ok: true, disparados: 0 });

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const internalSecret = Deno.env.get("AGENT_INTERNAL_SECRET") ?? "";
    const fnUrl = `${supabaseUrl}/functions/v1/planejador-agent`;

    const workers = Promise.all(planos.map((p) =>
      fetch(`${fnUrl}?plano_id=${p.plano_id}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: anonKey,
          Authorization: `Bearer ${anonKey}`,
          "x-agent-secret": internalSecret,
        },
        body: "{}",
      }).then(async (res) => ({ ok: res.ok, body: (await res.text()).slice(0, 300) }))
        .catch((e) => ({ ok: false, body: String(e) }))
    ));

    const resumir = async () => {
      const resultados = await workers;
      const ok = resultados.filter((r) => r.ok).length;
      await setStatus(
        "planejador",
        ok === resultados.length ? "idle" : "error",
        `${ok}/${resultados.length} planos avançaram${
          ok < resultados.length ? `; falha: ${resultados.find((r) => !r.ok)?.body}` : ""
        }`.slice(0, 180),
      );
    };

    await setStatus("planejador", "working", `${planos.length} plano(s) em andamento`);
    const edgeRuntime = (globalThis as any).EdgeRuntime;
    if (edgeRuntime?.waitUntil) edgeRuntime.waitUntil(resumir());
    else await resumir();

    return json({ ok: true, disparados: planos.length });
  } catch (e) {
    console.error("planejador orquestrador", e);
    await setStatus("planejador", "error", formatAgentError(e));
    return json({ ok: false, error: formatAgentError(e) }, 500);
  }
});
