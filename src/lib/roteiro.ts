/**
 * Etapas em que o roteiro já está escrito. Daqui em diante dá para copiar,
 * gravar e gerar o carrossel — sem esperar a aprovação do roteiro.
 */
export const STATUS_COM_ROTEIRO = ["aguardando_aprovacao", "aprovada"] as const;

export function temRoteiroEscrito(status: string | null | undefined) {
  return (STATUS_COM_ROTEIRO as readonly string[]).includes(status ?? "");
}

export type TextoDoRoteiro = {
  gancho: string | null;
  desenvolvimento: string | null;
  cta: string | null;
  /** Só a fala, na ordem de gravar: gancho, desenvolvimento e CTA. */
  fala: string;
  legenda: string | null;
  /** Roteiro antigo, em slides. */
  slides: string[] | null;
  /** Tudo junto, pronto para colar: fala, slides e legenda. */
  completo: string;
};

const textoOuNulo = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

/**
 * Lê qualquer formato de roteiro salvo (reel falado atual, campos antigos
 * `gancho`/`corpo`/`cta` e o formato em slides) e devolve os textos.
 * Devolve `null` quando o conteúdo não tem nenhuma parte reconhecível.
 */
export function textoDoRoteiro(conteudo: unknown): TextoDoRoteiro | null {
  if (!conteudo || typeof conteudo !== "object") return null;
  const c = conteudo as Record<string, unknown>;

  const gancho = textoOuNulo(c.gancho_falado ?? c.gancho);
  const desenvolvimento = textoOuNulo(c.desenvolvimento_falado ?? c.corpo);
  const cta = textoOuNulo(c.cta_falado ?? c.cta);
  const legenda = textoOuNulo(c.legenda_sugerida);
  const slides = Array.isArray(c.corpo)
    ? c.corpo.map((s) => (typeof s === "string" ? s : JSON.stringify(s)))
    : null;

  if (!gancho && !desenvolvimento && !cta && !legenda && !slides) return null;

  const fala = [gancho, desenvolvimento, cta].filter(Boolean).join("\n\n");
  const completo = [
    fala && `ROTEIRO PARA GRAVAR:\n\n${fala}`,
    slides?.map((s, i) => `Slide ${i + 1}: ${s}`).join("\n\n"),
    legenda && `\nLegenda:\n${legenda}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return { gancho, desenvolvimento, cta, fala, legenda, slides, completo };
}

/** Onde um roteiro está, do ponto de vista de quem grava. */
export type Etapa = "escrevendo" | "para-ler" | "para-gravar" | "postados" | "recusados";

export function etapaDoRoteiro(
  status: string | null | undefined,
  publicacoes: { status: string | null }[] = [],
): Etapa | null {
  if (status === "gerada" || status === "em_producao") return "escrevendo";
  if (status === "aguardando_aprovacao") return "para-ler";
  if (status === "rejeitada") return "recusados";
  if (status === "aprovada") {
    return publicacoes.some((pub) => pub.status === "postado") ? "postados" : "para-gravar";
  }
  return null;
}

/** O mais recente: um roteiro regerado não apaga o anterior. */
export function roteiroMaisRecente<T extends { criado_em: string | null }>(roteiros: T[]) {
  return [...roteiros].sort((a, b) => (b.criado_em ?? "").localeCompare(a.criado_em ?? ""))[0];
}
