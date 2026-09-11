/**
 * Página servida quando o SSR falha antes do app montar. É HTML solto: não
 * alcança styles.css, então os tokens do manual de marca estão repetidos aqui
 * como literais. Mantida em pt-BR como o resto do produto.
 */
export function renderErrorPage(): string {
  return `<!doctype html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Esta página não carregou | prevIA - CONTENT</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      :root {
        color-scheme: light dark;
        --bg: #F4F4F2;
        --surface: #FFFFFF;
        --fg: #0D0D0F;
        --muted: #6E6E76;
        --border: #E4E4E0;
        --primary: #F4DB0B;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: #1A1A1E;
          --surface: #26262B;
          --fg: #F7F7F5;
          --muted: #A8A8B0;
          --border: #3F3F47;
        }
      }
      * { box-sizing: border-box; }
      body {
        font: 15px/1.5 "Inter", system-ui, -apple-system, sans-serif;
        background: var(--bg);
        color: var(--fg);
        display: grid;
        place-items: center;
        min-height: 100vh;
        margin: 0;
        padding: 16px;
      }
      .card {
        max-width: 28rem;
        width: 100%;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        padding: 32px 24px;
      }
      h1 {
        font-family: "Space Grotesk", "Inter", system-ui, sans-serif;
        letter-spacing: -0.02em;
        font-size: 1.25rem;
        margin: 0 0 8px;
      }
      p { color: var(--muted); margin: 0 0 24px; }
      .actions { display: flex; gap: 8px; flex-wrap: wrap; }
      button, a {
        min-height: 44px;
        display: inline-flex;
        align-items: center;
        padding: 0 16px;
        border-radius: 8px;
        font: inherit;
        font-weight: 500;
        cursor: pointer;
        text-decoration: none;
        border: 1px solid transparent;
      }
      button:focus-visible, a:focus-visible {
        outline: 2px solid var(--primary);
        outline-offset: 2px;
      }
      .primary { background: var(--primary); color: #0D0D0F; }
      .secondary { background: transparent; color: var(--fg); border-color: var(--border); }
    </style>
  </head>
  <body>
    <div class="card">
      <h1>Esta página não carregou</h1>
      <p>A falha foi do nosso lado, não sua. Seus dados estão a salvo — tente de novo em instantes.</p>
      <div class="actions">
        <button class="primary" onclick="location.reload()">Tentar de novo</button>
        <a class="secondary" href="/">Ir para o início</a>
      </div>
    </div>
  </body>
</html>`;
}
