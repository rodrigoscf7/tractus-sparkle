/**
 * Os arquivos da marca, em um lugar só.
 *
 * Substituem os `src/assets/*.asset.json` que vieram do Lovable. Aqueles
 * apontavam para `/__l5e/assets-v1/…`, um caminho que só existia naquele
 * ambiente — no Railway a URL não resolve e a logo simplesmente não aparecia
 * em lugar nenhum do app.
 *
 * Agora são arquivos em `public/`, servidos pelo próprio app, sem
 * intermediário. Como é `public/` e não `src/assets/`, o caminho é literal e
 * não passa pelo hash do bundler: trocar a arte é substituir o arquivo, sem
 * rebuild.
 */

/**
 * Logo para fundo claro (letra grafite). É a de quase todo lugar: as páginas
 * públicas — oferta, relatório, entrar, onboarding — não têm alternador de
 * tema e são sempre claras.
 */
export const LOGO_FUNDO_CLARO = "/logo-fundo-claro.png";

/** Logo para fundo escuro (letra branca). Só o app autenticado alterna tema. */
export const LOGO_FUNDO_ESCURO = "/logo-fundo-escuro.png";

/** A marca sozinha, sem o texto. Usada onde não cabe a logo inteira. */
export const ICONE_MARCA = "/icon-192.png";

/** O texto alternativo. Um só, para a marca ser lida sempre do mesmo jeito. */
export const MARCA_ALT = "prevIA";
