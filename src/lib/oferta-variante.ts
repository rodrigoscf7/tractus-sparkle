/**
 * Infraestrutura da página de oferta: qual braço do teste mostrar e de onde
 * veio a visita. Não tem copy nem pergunta aqui — só o encanamento que vale
 * para qualquer conteúdo que a gente coloque em cima.
 */

export type Variante = "quiz" | "lp";

/**
 * Hoje só existe o braço do quiz, então `/` renderiza ele sem sorteio.
 *
 * Quando a LP entrar, o sorteio NÃO pode ser feito aqui no cliente: `/` é
 * renderizada no servidor e ler localStorage na hidratação daria mismatch e
 * um flash trocando a página debaixo de quem veio do anúncio. O caminho certo
 * é o servidor sortear uma vez, gravar um cookie e devolver já o braço certo
 * — aí o SSR e o cliente concordam desde o primeiro byte.
 */
export const VARIANTE_ATIVA: Variante = "quiz";

/** Parâmetros que o anúncio carrega e que precisam chegar até o checkout. */
const CHAVES_ORIGEM = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
] as const;

export type Origem = Partial<Record<(typeof CHAVES_ORIGEM)[number], string>>;

const CHAVE_ORIGEM = "previa.oferta.origem";
const CHAVE_LEAD = "previa.oferta.lead";

/**
 * Lê os parâmetros da URL na primeira visita e guarda.
 *
 * Guardar importa porque o quiz tem várias telas e a navegação entre passos
 * reescreve a query string: sem isso, a origem se perde no passo 2 e a venda
 * chega no checkout sem atribuição nenhuma.
 */
export function capturarOrigem(): Origem {
  if (typeof window === "undefined") return {};

  const guardada = lerJson<Origem>(CHAVE_ORIGEM) ?? {};
  const params = new URLSearchParams(window.location.search);

  const nova: Origem = {};
  for (const chave of CHAVES_ORIGEM) {
    const valor = params.get(chave);
    if (valor) nova[chave] = valor;
  }

  // A primeira origem vence: quem voltou por link direto não apaga o anúncio
  // que trouxe a pessoa da primeira vez.
  if (Object.keys(guardada).length > 0) return guardada;
  if (Object.keys(nova).length === 0) return {};

  gravarJson(CHAVE_ORIGEM, nova);
  return nova;
}

/**
 * Identificador anônimo da visita. É o fio que vai costurar
 * quiz -> checkout -> conta quando o webhook da Kiwify avisar a compra.
 */
export function obterLeadId(): string {
  if (typeof window === "undefined") return "";

  const existente = lerTexto(CHAVE_LEAD);
  if (existente) return existente;

  const novo = crypto.randomUUID();
  gravarTexto(CHAVE_LEAD, novo);
  return novo;
}

// localStorage pode lançar (aba anônima, storage bloqueado). Nenhuma dessas
// leituras vale derrubar a página de oferta.
function lerTexto(chave: string): string | null {
  try {
    return window.localStorage.getItem(chave);
  } catch {
    return null;
  }
}

function gravarTexto(chave: string, valor: string): void {
  try {
    window.localStorage.setItem(chave, valor);
  } catch {
    // segue sem persistir
  }
}

function lerJson<T>(chave: string): T | null {
  const bruto = lerTexto(chave);
  if (!bruto) return null;
  try {
    return JSON.parse(bruto) as T;
  } catch {
    return null;
  }
}

function gravarJson(chave: string, valor: unknown): void {
  gravarTexto(chave, JSON.stringify(valor));
}
