/**
 * Score determinístico do DNA Viral.
 *
 * Nenhum número vem do modelo: a página rotula isto como leitura das próprias
 * respostas, não como auditoria do perfil. É a regra de [quiz-oferta.ts]:
 * "número que a gente não mediu, não" — aqui medimos o que a pessoa disse.
 */

import type { Respostas } from "@/lib/onboarding-perguntas";

export type FaixaScore = "vermelha" | "amarela" | "verde";

export type DimensaoScore = {
  chave: "clareza" | "frequencia" | "potencial_viral" | "conexao";
  rotulo: string;
  valor: number;
  faixa: FaixaScore;
};

export function faixaDe(valor: number): FaixaScore {
  if (valor < 40) return "vermelha";
  if (valor < 70) return "amarela";
  return "verde";
}

function clamp(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

/** Cliente ideal específico o bastante para alimentar o diagnóstico. */
function especificidadeCliente(texto: string | undefined): number {
  const t = (texto ?? "").trim();
  if (!t) return 0;
  const palavras = t.split(/\s+/).filter(Boolean).length;
  if (palavras >= 6) return 40;
  if (palavras >= 3) return 25;
  return 10;
}

const FREQUENCIA_PONTOS: Record<string, number> = {
  diaria: 90,
  "3_5": 75,
  "1_2": 50,
  raramente: 25,
  parado: 10,
};

const TEMPO_PONTOS: Record<string, number> = {
  ate_15: 85,
  "15_30": 70,
  "30_60": 50,
  mais_2h: 25,
  travo: 10,
};

const OBJETIVOS_POSICIONAMENTO = new Set([
  "autoridade",
  "clientes",
  "leads",
  "contratos",
  "tudo",
]);

/**
 * Calcula as quatro dimensões a partir das respostas do quiz.
 *
 * Ordem fixa na página: Clareza, Frequência, Potencial Viral, Conexão.
 */
export function calcularScore(r: Respostas): DimensaoScore[] {
  const clareza = scoreClareza(r);
  const frequencia = scoreFrequencia(r);
  const potencial = scorePotencialViral(r);
  const conexao = scoreConexao(r);

  return [
    dim("clareza", "Clareza", clareza),
    dim("frequencia", "Frequência", frequencia),
    dim("potencial_viral", "Potencial Viral", potencial),
    dim("conexao", "Conexão com o Público", conexao),
  ];
}

function dim(
  chave: DimensaoScore["chave"],
  rotulo: string,
  valor: number,
): DimensaoScore {
  const v = clamp(valor);
  return { chave, rotulo, valor: v, faixa: faixaDe(v) };
}

function scoreClareza(r: Respostas): number {
  let n = 30;
  n += especificidadeCliente(r.cliente_ideal);
  if (r.percepcao) n += 20;
  if (r.area_atuacao && r.area_atuacao !== "outro") n += 10;
  if (r.area_atuacao === "outro" && r.area_outro?.trim()) n += 10;
  if (r.situacao === "nao_sei_postar") n -= 20;
  if (r.situacao === "ideias_sem_conteudo") n -= 10;
  return n;
}

function scoreFrequencia(r: Respostas): number {
  return FREQUENCIA_PONTOS[r.frequencia_atual ?? ""] ?? 35;
}

function scorePotencialViral(r: Respostas): number {
  let n = 40;
  const canais = r.canais ?? [];
  const videoCurto = canais.some((c) =>
    ["instagram", "tiktok", "youtube_shorts"].includes(c),
  );
  if (videoCurto) n += 20;
  if (canais.includes("nenhum") || canais.length === 0) n -= 15;

  n += (TEMPO_PONTOS[r.tempo_producao ?? ""] ?? 40) * 0.25;

  if (r.situacao === "poucas_views") n -= 15;
  if (r.situacao === "sem_constancia") n -= 10;
  return n;
}

function scoreConexao(r: Respostas): number {
  let n = 25;
  n += especificidadeCliente(r.cliente_ideal) * 0.75;

  const objetivos = r.objetivos ?? [];
  if (objetivos.some((o) => OBJETIVOS_POSICIONAMENTO.has(o))) n += 20;
  if (objetivos.includes("seguidores") && !objetivos.some((o) => OBJETIVOS_POSICIONAMENTO.has(o))) {
    n -= 5;
  }

  if (r.situacao === "views_sem_cliente") n -= 35;
  if (r.situacao === "poucas_views") n -= 10;
  return n;
}

/**
 * Frase curta de status a partir da dimensão mais baixa.
 * Usada no cabeçalho do relatório ("Eficiência comprometida por…").
 */
export function statusDoScore(score: DimensaoScore[]): string {
  if (!score.length) return "Eficiência em análise";
  const pior = [...score].sort((a, b) => a.valor - b.valor)[0]!;
  const porChave: Record<DimensaoScore["chave"], string> = {
    clareza: "Eficiência Comprometida por Falta de Clareza",
    frequencia: "Eficiência Comprometida por Frequência Baixa",
    potencial_viral: "Eficiência Comprometida por Retenção Baixa",
    conexao: "Eficiência Comprometida por Baixa Conexão com o Público",
  };
  if (pior.valor >= 70) return "Eficiência em Bom Caminho";
  return porChave[pior.chave];
}
