/**
 * Fontes do carrossel.
 *
 * A prévia e a exportação precisam da mesma fonte. O `html-to-image` não
 * consegue ler o CSS do Google Fonts (folha de outro domínio), então a imagem
 * sairia na fonte padrão. Aqui o CSS e os arquivos woff2 são baixados e
 * embutidos em data URL: o mesmo CSS vai para a página (prévia) e para o
 * `fontEmbedCSS` da exportação.
 */

export type FonteCarrossel = {
  id: string;
  nome: string;
  familia: string;
  categoria: "sans" | "serif";
  /** Para a lista: o que esta fonte transmite. */
  tom: string;
};

export const FONTES_CARROSSEL: FonteCarrossel[] = [
  { id: "inter", nome: "Inter", familia: "Inter", categoria: "sans", tom: "neutra e limpa" },
  {
    id: "montserrat",
    nome: "Montserrat",
    familia: "Montserrat",
    categoria: "sans",
    tom: "geométrica e firme",
  },
  {
    id: "poppins",
    nome: "Poppins",
    familia: "Poppins",
    categoria: "sans",
    tom: "redonda e próxima",
  },
  { id: "dm-sans", nome: "DM Sans", familia: "DM Sans", categoria: "sans", tom: "moderna e leve" },
  {
    id: "archivo",
    nome: "Archivo",
    familia: "Archivo",
    categoria: "sans",
    tom: "compacta e direta",
  },
  {
    id: "playfair",
    nome: "Playfair Display",
    familia: "Playfair Display",
    categoria: "serif",
    tom: "elegante e editorial",
  },
  {
    id: "dm-serif",
    nome: "DM Serif Display",
    familia: "DM Serif Display",
    categoria: "serif",
    tom: "clássica e marcante",
  },
  { id: "lora", nome: "Lora", familia: "Lora", categoria: "serif", tom: "sóbria e acolhedora" },
  {
    id: "merriweather",
    nome: "Merriweather",
    familia: "Merriweather",
    categoria: "serif",
    tom: "tradicional e legível",
  },
  {
    id: "libre-baskerville",
    nome: "Libre Baskerville",
    familia: "Libre Baskerville",
    categoria: "serif",
    tom: "jurídica e formal",
  },
];

export const FONTE_PADRAO = "inter";

export function fonteDoId(id: string | undefined | null): FonteCarrossel {
  return FONTES_CARROSSEL.find((f) => f.id === id) ?? FONTES_CARROSSEL[0];
}

/** `font-family` com uma alternativa do sistema da mesma categoria. */
export function familiaCss(id: string | undefined | null): string {
  const f = fonteDoId(id);
  const reserva =
    f.categoria === "serif" ? "Georgia, 'Times New Roman', serif" : "Helvetica, Arial, sans-serif";
  return `'${f.familia}', ${reserva}`;
}

/** Subconjuntos que cobrem o português (acentos e cedilha). Os demais não são baixados. */
const SUBCONJUNTOS = new Set(["latin", "latin-ext"]);

const cacheCss = new Map<string, Promise<string>>();

function blobComoDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onloadend = () => resolve(String(leitor.result ?? ""));
    leitor.onerror = () => reject(leitor.error);
    leitor.readAsDataURL(blob);
  });
}

/** @font-face da fonte (pesos 400 e 700) com os arquivos embutidos em data URL. */
function cssEmbutido(f: FonteCarrossel): Promise<string> {
  const emCache = cacheCss.get(f.id);
  if (emCache) return emCache;

  const promessa = (async () => {
    const familia = encodeURIComponent(f.familia).replace(/%20/g, "+");
    const res = await fetch(
      `https://fonts.googleapis.com/css2?family=${familia}:wght@400;700&display=swap`,
    );
    if (!res.ok) throw new Error(`Google Fonts ${res.status}`);
    const css = await res.text();

    const blocos = [...css.matchAll(/\/\*\s*([\w-]+)\s*\*\/\s*(@font-face\s*\{[^}]*\})/g)]
      .filter((m) => SUBCONJUNTOS.has(m[1]))
      .map((m) => m[2]);

    const embutidos = await Promise.all(
      blocos.map(async (bloco) => {
        const url = bloco.match(/url\((https:[^)]+)\)/)?.[1];
        if (!url) return bloco;
        const arquivo = await fetch(url);
        if (!arquivo.ok) throw new Error(`fonte ${arquivo.status}`);
        return bloco.replace(url, await blobComoDataUrl(await arquivo.blob()));
      }),
    );
    return embutidos.join("\n");
  })();

  // Falha não fica em cache: a próxima tentativa baixa de novo.
  promessa.catch(() => cacheCss.delete(f.id));
  cacheCss.set(f.id, promessa);
  return promessa;
}

/**
 * Carrega as fontes na página e devolve o CSS para a exportação.
 * Em falha de rede devolve string vazia: o slide usa a fonte de reserva.
 */
export async function prepararFontes(ids: Array<string | undefined | null>): Promise<string> {
  const fontes = [...new Set(ids.map((id) => fonteDoId(id)))];
  const partes = await Promise.all(
    fontes.map(async (f) => {
      try {
        const css = await cssEmbutido(f);
        const idEstilo = `carrossel-fonte-${f.id}`;
        if (!document.getElementById(idEstilo)) {
          const estilo = document.createElement("style");
          estilo.id = idEstilo;
          estilo.textContent = css;
          document.head.appendChild(estilo);
        }
        await Promise.all([
          document.fonts.load(`400 40px '${f.familia}'`),
          document.fonts.load(`700 40px '${f.familia}'`),
        ]);
        return css;
      } catch (e) {
        console.error("carrossel: fonte não carregou", f.id, e);
        return "";
      }
    }),
  );
  return partes.filter(Boolean).join("\n");
}
