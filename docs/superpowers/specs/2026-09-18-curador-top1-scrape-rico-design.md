# Curador: top-1 diário + scrape rico + transcript de reel

## Decisões aprovadas

- **Entrega:** por referência/ciclo, avaliar até 5 posts novos e **sempre gravar o de maior score** (mesmo &lt; 5). Score ≥ 5 é destaque na UI, não condição de gravação.
- **Scrape rico:** no score e em `texto_original`, incluir `caption`, `alt` e textos/`alt` de `childPosts`.
- **Transcript:** só no reel **salvo** (top-1), actor captions-first + Whisper; coluna `transcricao`; falha não desfaz o insert (alerta admin `curador:transcript`).

## Fluxo do worker

1. Apify `instagram-scraper` (como hoje).
2. Filtrar novos por URL; scorear até 5 com texto rico.
3. Ordenar por `score_curadoria` desc; inserir o #1.
4. Se for reel → actor transcript → `UPDATE conteudos_curados SET transcricao`.

## Actor transcript

`scraping_solutions~instagram-reels-transcript-scraper-audio-to-text`  
modo `captions-first` (nativo, senão Whisper).
