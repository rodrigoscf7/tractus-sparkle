// Análise de virais e plano semanal: o núcleo do motor que substitui a curadoria
// diária. Seleciona o que performou acima do normal em cada referência, entende
// por que funcionou (vídeo inteiro ou todos os slides) e transforma isso no plano
// da semana do perfil.
import { callModelo, extractJson, MODEL } from "./agent-utils.ts";
import type { PostInstagram } from "./apify.ts";
import { baixarMidia } from "./midia.ts";

/** Modelo com entrada de vídeo; sobrescreva com o secret OPENROUTER_MODEL_ANALISE. */
export const ANALISE_MODEL = Deno.env.get("OPENROUTER_MODEL_ANALISE") ?? "google/gemini-3.8-flash";

/** Acima disso o vídeo cede a vaga ao próximo do ranking: a memória do worker não comporta. */
const VIDEO_MAX_BYTES = 20 * 1024 * 1024;
const IMAGEM_MAX_BYTES = 5 * 1024 * 1024;
const MIDIA_TIMEOUT_MS = 30_000;
const MAX_SLIDES = 12;

export type Formato = "reel" | "carrossel" | "imagem";

export type Candidato = {
  handle: string;
  post: PostInstagram;
  url: string;
  formato: Formato;
  /** Views (vídeo) ou likes + 3×comentários (estático). */
  metrica: number;
  /** Mediana da mesma métrica nos posts do mesmo tipo daquele perfil. */
  mediana: number;
  /** metrica ÷ mediana: quantas vezes acima do normal do próprio perfil. */
  indice: number;
  postadoEm: string | null;
};

function formatoDe(post: PostInstagram): Formato {
  const tipo = String(post.type ?? "").toLowerCase();
  if (tipo === "video") return "reel";
  if (tipo === "sidecar") return "carrossel";
  return "imagem";
}

function metricaDe(post: PostInstagram, formato: Formato): number {
  if (formato === "reel") {
    return Number(post.videoPlayCount ?? post.videoViewCount ?? 0) || 0;
  }
  const likes = Number(post.likesCount ?? 0) || 0;
  const comentarios = Number(post.commentsCount ?? 0) || 0;
  return likes + comentarios * 3;
}

function mediana(valores: number[]): number {
  const v = valores.filter((x) => x > 0).sort((a, b) => a - b);
  if (!v.length) return 0;
  const meio = Math.floor(v.length / 2);
  return v.length % 2 ? v[meio] : (v[meio - 1] + v[meio]) / 2;
}

function dataDe(post: PostInstagram): string | null {
  const ts = post.timestamp ?? post.taken_at_timestamp;
  if (typeof ts === "number") return new Date(ts * 1000).toISOString();
  const d = Date.parse(String(ts ?? ""));
  return Number.isNaN(d) ? null : new Date(d).toISOString();
}

/**
 * Ranqueia por índice de outlier, não por views absolutas: um post 8x acima do
 * normal de um perfil pequeno ensina mais do que um post mediano de um perfil
 * grande. Vídeo e estático têm medianas separadas (as métricas não se comparam).
 */
export function rankearVirais(
  postsPorPerfil: Map<string, PostInstagram[]>,
  opts: { diasRecencia: number; agora?: Date },
): Candidato[] {
  const limite = (opts.agora ?? new Date()).getTime() - opts.diasRecencia * 86_400_000;
  const todos: Candidato[] = [];

  for (const [handle, posts] of postsPorPerfil) {
    const base = posts
      .filter((p) => typeof p.url === "string")
      .map((post) => {
        const formato = formatoDe(post);
        return { post, formato, metrica: metricaDe(post, formato) };
      });
    const medVideo = mediana(base.filter((b) => b.formato === "reel").map((b) => b.metrica));
    const medEstatico = mediana(base.filter((b) => b.formato !== "reel").map((b) => b.metrica));

    for (const b of base) {
      const postadoEm = dataDe(b.post);
      if (postadoEm && Date.parse(postadoEm) < limite) continue;
      const med = b.formato === "reel" ? medVideo : medEstatico;
      todos.push({
        handle,
        post: b.post,
        url: b.post.url as string,
        formato: b.formato,
        metrica: b.metrica,
        mediana: med,
        indice: med > 0 ? b.metrica / med : 0,
        postadoEm,
      });
    }
  }

  return todos.sort((a, b) => b.indice - a.indice || b.metrica - a.metrica);
}

/** Corta o ranking em `total`, com no máximo `maxPorPerfil` de cada referência. */
export function escolherVirais(
  ranking: Candidato[],
  opts: { total: number; maxPorPerfil: number },
): Candidato[] {
  const porPerfil = new Map<string, number>();
  const escolhidos: Candidato[] = [];
  for (const c of ranking) {
    if (escolhidos.length >= opts.total) break;
    const n = porPerfil.get(c.handle) ?? 0;
    if (n >= opts.maxPorPerfil) continue;
    porPerfil.set(c.handle, n + 1);
    escolhidos.push(c);
  }
  return escolhidos;
}

// ---------------------------------------------------------------------------
// Análise de um viral
// ---------------------------------------------------------------------------

export type AnaliseViral = {
  tema: string;
  gancho: { texto: string; tipo: string; por_que_prende: string };
  estrutura: { bloco: string; resumo: string; tempo_ou_slide: string }[];
  desenvolvimento: string;
  retencao: string[];
  cta: { texto: string; tipo: string };
  linguagem_visual: string;
  porque_funcionou: string;
  padrao_replicavel: string;
};

const SYSTEM_ANALISE = `Você é estrategista de conteúdo para Instagram e analisa posts que performaram muito acima do normal do próprio perfil.

Você recebe o post completo: o vídeo inteiro (imagem e áudio) no caso de reel, ou todas as imagens no caso de carrossel/imagem, mais legenda e métricas.

Sua tarefa é explicar POR QUE este post funcionou, de forma que outra pessoa consiga replicar o PADRÃO (não o conteúdo) em outro nicho. Seja concreto: cite o que é dito, mostrado e escrito, com tempos (reel) ou números de slide (carrossel). Nada de genérico como "conteúdo de valor" ou "boa edição".

Retorne APENAS um JSON, sem markdown:
{
  "tema": "assunto em 1 frase",
  "gancho": {
    "texto": "o que é dito/escrito nos primeiros 3 segundos ou no slide 1, literal",
    "tipo": "ex.: erro comum, polêmica, pergunta, número, história, quebra de expectativa",
    "por_que_prende": "1 a 2 frases"
  },
  "estrutura": [
    { "bloco": "gancho | contexto | virada | prova | exemplo | lista | conclusão | cta", "resumo": "o que acontece", "tempo_ou_slide": "0-3s ou slide 1" }
  ],
  "desenvolvimento": "como o argumento avança e mantém tensão, 2 a 3 frases",
  "retencao": ["técnicas concretas observadas: cortes, texto na tela, loop aberto, ritmo de fala, mudança de cenário, promessa no início"],
  "cta": { "texto": "literal, ou vazio se não houver", "tipo": "comentar palavra | salvar | compartilhar | seguir | link na bio | nenhum" },
  "linguagem_visual": "formato de gravação/design: pessoa à câmera, legenda dinâmica, carrossel de texto, etc.",
  "porque_funcionou": "2 a 3 frases ligando o padrão à métrica",
  "padrao_replicavel": "o molde com lacunas, ex.: 'Gancho: [erro que o público comete] → Virada: [consequência que ele não vê] → Prova: [caso real] → CTA: comente [palavra]'"
}`;

// Um vídeo por vez por worker: download, base64 e corpo da requisição somam
// algumas vezes o tamanho do arquivo, e três em paralelo estouravam a memória.
let filaDeVideo: Promise<unknown> = Promise.resolve();
function umVideoPorVez<T>(fn: () => Promise<T>): Promise<T> {
  const vez = filaDeVideo.then(fn, fn);
  filaDeVideo = vez.catch(() => undefined);
  return vez;
}

/**
 * Analisa um viral com o vídeo inteiro (reel) ou todos os slides (carrossel).
 * Falha no download da mídia lança: análise só pela legenda seria pela metade.
 */
export function analisarViral(c: Candidato): Promise<AnaliseViral> {
  return c.formato === "reel" ? umVideoPorVez(() => analisarMidia(c)) : analisarMidia(c);
}

async function analisarMidia(c: Candidato): Promise<AnaliseViral> {
  const post = c.post;
  const imagens: string[] = [];
  const videos: string[] = [];

  if (c.formato === "reel") {
    const videoUrl = typeof post.videoUrl === "string" ? post.videoUrl : null;
    if (!videoUrl) throw new Error("reel sem videoUrl no resultado do Apify");
    videos.push(await baixarMidia(videoUrl, {
      prefixo: "video/",
      maxBytes: VIDEO_MAX_BYTES,
      timeoutMs: MIDIA_TIMEOUT_MS,
    }));
  } else {
    const filhos = Array.isArray(post.childPosts) ? post.childPosts : [];
    const urls = [
      ...filhos.map((f) => (f as PostInstagram)?.displayUrl),
      ...(filhos.length ? [] : Array.isArray(post.images) ? post.images : [post.displayUrl]),
    ].filter((u): u is string => typeof u === "string" && u.startsWith("http"))
      .slice(0, MAX_SLIDES);
    if (!urls.length) throw new Error("post sem imagens no resultado do Apify");
    imagens.push(...await Promise.all(urls.map((u) =>
      baixarMidia(u, { prefixo: "image/", maxBytes: IMAGEM_MAX_BYTES, timeoutMs: MIDIA_TIMEOUT_MS })
    )));
  }

  const prompt = `Post de @${c.handle} (${c.formato}):
- url: ${c.url}
- métrica: ${c.metrica.toLocaleString("pt-BR")} ${c.formato === "reel" ? "views" : "pontos de engajamento"}
- mediana do perfil: ${Math.round(c.mediana).toLocaleString("pt-BR")} → ${c.indice.toFixed(1)}x acima do normal dele
- likes: ${post.likesCount ?? "n/a"} | comentários: ${post.commentsCount ?? "n/a"}
- legenda:
${String(post.caption ?? "").slice(0, 2000) || "(sem legenda)"}`;

  const text = await callModelo(SYSTEM_ANALISE, prompt, 4000, {
    model: ANALISE_MODEL,
    imagens,
    videos,
  });
  return extractJson<AnaliseViral>(text);
}

// ---------------------------------------------------------------------------
// Plano semanal
// ---------------------------------------------------------------------------

const DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];

/** Datas (AAAA-MM-DD) da semana a partir de `inicio` que caem nos dias do ritmo. */
export function diasDoRitmo(inicio: Date, ritmoDias: number[]): { dia: string; data: string }[] {
  const out: { dia: string; data: string }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(inicio.getTime() + i * 86_400_000);
    if (ritmoDias.includes(d.getUTCDay())) {
      out.push({ dia: DIAS[d.getUTCDay()], data: d.toISOString().slice(0, 10) });
    }
  }
  return out;
}

export type PlanoSemanal = {
  resumo_da_semana: string;
  padroes: { nome: string; o_que_e: string; evidencias: number[]; como_usar: string }[];
  pautas: {
    dia: string;
    data: string;
    tema: string;
    angulo: string;
    gancho: string;
    estrutura: string[];
    inspirado_em: number;
    por_que_vai_funcionar: string;
  }[];
};

/** Regras comuns ao plano inteiro e à troca de uma pauta. */
const REGRAS_PAUTA = `Regras:
- NICHO: toda pauta fica dentro do nicho e do público declarados no perfil. Os pilares do manual variam o assunto DENTRO do nicho, nunca para fora dele.
- FATOS: não afirme mudança de lei, de entendimento do INSS ou dos tribunais, número, estatística ou notícia que não esteja no manual ou nos posts analisados. Ele é advogado e responde pelo que fala. Se a pauta depender de um fato, escreva-a como opinião, pergunta ou erro comum, nunca como novidade inventada.
- Ignore como inspiração posts que são anúncio, promoção, lançamento de produto ou evento: eles performam por oferta, não por padrão replicável.
- Formato: Reel falado, pessoa à câmera, 30 a 60 segundos.
- Ângulo = tese de posicionamento em 1 frase: se ninguém razoável discordaria, não é tese.
- Escreva para o público REAL dele, com o vocabulário desse público.
- Publicidade da advocacia: nada de prometer resultado, nada de preço, promoção ou "consulta grátis", nada de captação direta. Gancho forte e opinião defensável são permitidos.
- PROIBIDO travessão (—) e traço médio (–) em qualquer campo.`;

const FORMATO_PAUTA = `{
    "dia": "segunda", "data": "AAAA-MM-DD",
    "tema": "curto", "angulo": "tese em 1 frase",
    "gancho": "a frase dos 3 primeiros segundos, pronta",
    "estrutura": ["Gancho: ...", "Virada: ...", "Prova/exemplo: ...", "CTA: ..."],
    "inspirado_em": número do post,
    "por_que_vai_funcionar": "1 frase ligando ao padrão"
  }`;

const SYSTEM_PLANO = `Você é o estrategista de conteúdo de um advogado e monta o plano de Reels da semana dele.

Você recebe:
1. O manual de marca dele (posicionamento, como ele soa, público, pilares, fórmulas de gancho, o que evitar).
2. Os dados do perfil (nicho, público, foco).
3. A análise dos posts que mais performaram acima do normal nas referências que ele acompanha, numerados.
4. Os dias em que ele se comprometeu a postar.

Sua tarefa:
- Identificar de 2 a 4 PADRÕES que explicam os virais da semana (não resuma post por post: ache o que se repete).
- Criar UMA pauta para cada dia do ritmo, adaptando um padrão que funcionou ao nicho, ao público e à voz DELE. Nunca copie o tema do post de referência: transporte o mecanismo.
- Cada pauta traz o gancho já escrito (como ele falaria nos 3 primeiros segundos) e a estrutura em blocos, modelada no padrão que funcionou.
- Varie os padrões, os pilares e os temas ao longo da semana: duas pautas não podem tratar do mesmo assunto.

${REGRAS_PAUTA}

Retorne APENAS um JSON, sem markdown:
{
  "resumo_da_semana": "2 a 3 frases: o que está funcionando no nicho e como ele vai usar isso",
  "padroes": [ { "nome": "nome curto", "o_que_e": "1 a 2 frases", "evidencias": [números dos posts], "como_usar": "1 frase para o caso dele" } ],
  "pautas": [ ${FORMATO_PAUTA} ]
}`;

const SYSTEM_TROCA = `Você é o estrategista de conteúdo de um advogado. Ele recebeu o plano de Reels da semana e pediu para TROCAR uma das pautas.

Você recebe o manual de marca, o perfil, os posts analisados (numerados), as outras pautas da semana e, às vezes, um pedido dele.

Crie UMA pauta nova para o mesmo dia, adaptando um padrão que funcionou nos posts analisados. Ela precisa ser diferente da pauta trocada e das outras pautas da semana, em tema e em ângulo. Se ele fez um pedido, siga o pedido dentro das regras.

${REGRAS_PAUTA}

Retorne APENAS um JSON, sem markdown, com a pauta:
${FORMATO_PAUTA}`;

type EntradaPlano = {
  manual: unknown;
  perfil: { nome: string; nicho?: string | null; publico?: string | null; area?: string | null; foco?: string | null };
  analises: {
    candidato: Pick<Candidato, "handle" | "formato" | "indice">;
    analise: AnaliseViral;
  }[];
};

function contextoDoPlano(input: EntradaPlano): string {
  const posts = input.analises.map(({ candidato: c, analise }, i) => ({
    numero: i + 1,
    perfil: `@${c.handle}`,
    formato: c.formato,
    acima_do_normal: `${Number(c.indice).toFixed(1)}x`,
    analise,
  }));
  return `MANUAL DE MARCA:
${JSON.stringify(input.manual ?? {}, null, 2)}

PERFIL:
${JSON.stringify(input.perfil, null, 2)}

POSTS ANALISADOS:
${JSON.stringify(posts, null, 2)}`;
}

export async function gerarPlano(
  input: EntradaPlano & { dias: { dia: string; data: string }[] },
): Promise<PlanoSemanal> {
  const prompt = `${contextoDoPlano(input)}

DIAS DA SEMANA (uma pauta para cada):
${JSON.stringify(input.dias)}

Monte o plano agora.`;

  const text = await callModelo(SYSTEM_PLANO, prompt, 8000, { model: MODEL });
  return extractJson<PlanoSemanal>(text);
}

export type PautaDoPlano = PlanoSemanal["pautas"][number];

/** Gera uma pauta nova para o lugar de `trocada`, sem repetir as demais. */
export async function trocarPautaDoPlano(
  input: EntradaPlano & {
    trocada: PautaDoPlano;
    outras: PautaDoPlano[];
    pedido?: string | null;
  },
): Promise<PautaDoPlano> {
  const prompt = `${contextoDoPlano(input)}

PAUTA A TROCAR (dia ${input.trocada.dia}, ${input.trocada.data}):
${JSON.stringify({ tema: input.trocada.tema, angulo: input.trocada.angulo })}

OUTRAS PAUTAS DA SEMANA (não repita):
${JSON.stringify(input.outras.map((p) => ({ dia: p.dia, tema: p.tema, angulo: p.angulo })))}

PEDIDO DELE: ${input.pedido?.trim() || "(nenhum, só quer outra opção)"}

Crie a pauta nova para ${input.trocada.dia}, ${input.trocada.data}.`;

  const text = await callModelo(SYSTEM_TROCA, prompt, 3000, { model: MODEL });
  const nova = extractJson<PautaDoPlano>(text);
  // Dia e data são do lugar trocado, não do que o modelo devolver.
  return { ...nova, dia: input.trocada.dia, data: input.trocada.data };
}
