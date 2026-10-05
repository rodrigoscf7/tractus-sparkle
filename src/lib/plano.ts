/**
 * Formato do plano semanal gravado em `planos_semanais.relatorio` pelo
 * planejador-agent (supabase/functions/planejador-agent). A tela e as server
 * functions leem o mesmo contrato.
 */

export type PautaPlano = {
  dia: string;
  data: string;
  tema: string;
  angulo: string;
  gancho: string;
  estrutura: string[];
  inspirado_em: number;
  por_que_vai_funcionar: string;
  analise_viral_id: string | null;
  /** Marcada pelo assinante: não vira roteiro quando o plano for aprovado. */
  removida?: boolean;
};

export type PadraoPlano = {
  nome: string;
  o_que_e: string;
  evidencias: number[];
  como_usar: string;
};

export type PostAnalisado = {
  numero: number;
  analise_viral_id: string;
  handle: string;
  url: string;
  formato: "reel" | "carrossel" | "imagem";
  metrica: number;
  mediana: number;
  indice: number;
  gancho: string | null;
  porque_funcionou: string | null;
  padrao_replicavel: string | null;
};

export type RelatorioPlano = {
  resumo_da_semana: string;
  padroes: PadraoPlano[];
  pautas: PautaPlano[];
  dias: { dia: string; data: string }[];
  posts: PostAnalisado[];
};

export type StatusPlano =
  "coletando" | "analisando" | "planejando" | "pronto" | "aprovado" | "erro";

export const PLANO_EM_ANDAMENTO: StatusPlano[] = ["coletando", "analisando", "planejando"];

/** O que dizer enquanto o plano é montado, por passo. */
export const ETAPA_DO_PLANO: Record<StatusPlano, string> = {
  coletando: "Lendo os últimos posts dos perfis que você acompanha",
  analisando: "Assistindo aos vídeos que mais performaram e entendendo por quê",
  planejando: "Transformando os padrões em vídeos para a sua semana",
  pronto: "Pronto",
  aprovado: "Aprovado",
  erro: "Não foi possível montar",
};
