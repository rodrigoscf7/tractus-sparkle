/**
 * Meta Pixel nas páginas do funil (quiz, processando, relatório, boas-vindas).
 *
 * Carrega só no navegador e só quando `VITE_META_PIXEL_ID` existe, então
 * desenvolvimento e o app logado não disparam nada. A compra (Purchase) não
 * sai daqui: quem a registra é a integração de Pixel do próprio checkout da Hubla, que
 * enxerga o pagamento aprovado.
 */

type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: Fbq;
  loaded: boolean;
  version: string;
};

declare global {
  interface Window {
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

const PIXEL_ID = (import.meta.env.VITE_META_PIXEL_ID as string | undefined)?.trim() || "";

/** Rotas públicas do funil. O app logado não é rastreado. */
export function rotaDoFunil(caminho: string): boolean {
  return (
    caminho === "/" ||
    caminho.startsWith("/oferta") ||
    caminho.startsWith("/dna-viral") ||
    caminho.startsWith("/boas-vindas")
  );
}

/** O snippet oficial, sem o `<script>` inline: mesma fila, mesmo carregamento. */
function iniciar(): boolean {
  if (!PIXEL_ID || typeof window === "undefined") return false;
  if (window.fbq) return true;

  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args);
    else fbq.queue.push(args);
  } as Fbq;
  fbq.push = fbq;
  fbq.loaded = true;
  fbq.version = "2.0";
  fbq.queue = [];
  window.fbq = fbq;
  window._fbq = fbq;

  const script = document.createElement("script");
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);

  fbq("init", PIXEL_ID);
  return true;
}

let ultimoPageView = "";

/** PageView, uma vez por caminho — a navegação entre passos do quiz conta. */
export function registrarPageView(caminhoComBusca: string) {
  if (caminhoComBusca === ultimoPageView) return;
  if (!iniciar()) return;
  ultimoPageView = caminhoComBusca;
  window.fbq?.("track", "PageView");
}

/**
 * Evento padrão do Meta. `eventId` deduplica contra o envio do servidor
 * (API de Conversões, src/lib/meta-capi.server.ts): para o Lead, o id do lead.
 */
export function rastrear(
  evento: "Lead" | "ViewContent" | "InitiateCheckout",
  dados: Record<string, unknown> = {},
  eventId?: string,
) {
  if (!iniciar()) return;
  try {
    window.fbq?.("track", evento, dados, eventId ? { eventID: eventId } : undefined);
  } catch {
    // Rastreamento nunca pode derrubar a página do funil.
  }
}

/**
 * Cookies do Pixel, para a API de Conversões ligar o evento do servidor ao
 * mesmo navegador e ao clique do anúncio. Sem o cookie _fbc (Pixel bloqueado
 * ou ainda carregando), monta o valor a partir do fbclid guardado da visita.
 */
export function identificadoresMeta(fbclid?: string): { fbp?: string; fbc?: string } {
  if (typeof document === "undefined") return {};
  const cookie = (nome: string) =>
    document.cookie
      .split("; ")
      .find((c) => c.startsWith(`${nome}=`))
      ?.slice(nome.length + 1);
  const fbp = cookie("_fbp");
  const fbc = cookie("_fbc") ?? (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);
  return { ...(fbp ? { fbp } : {}), ...(fbc ? { fbc } : {}) };
}
