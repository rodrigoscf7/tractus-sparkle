# Vídeo de demonstração da prevIA (Remotion)

Vídeo com a semana de uma advogada fictícia usando a prevIA, mais pílulas curtas
por funcionalidade, em vertical (1080×1920, WhatsApp) e horizontal (1920×1080,
reuniões; composições com `-16x9`). 30 fps. Fica fora do build do app.

```bash
npm i
npm run dev          # Remotion Studio, para ver e ajustar
npm run voz          # gera a narração (ElevenLabs; ver o topo de gerar-voz.mts)
npm run sfx          # gera os efeitos sonoros (ElevenLabs; ver gerar-sfx.mts)
npx remotion render Mestre out/final/prevIA-Mestre.mp4 --codec=h264 --crf=18
```

`ELEVENLABS_API_KEY` fica em `.env`, que não vai para o Git.

## Onde mexer

- `src/voz/textos.ts`: o texto da narração e da legenda, a emoção de cada fala e o
  frame mínimo em que ela entra. Mudou o texto, rode `npm run voz -- --cenas <cena>`.
- `src/dados.ts`: a persona, o plano, o roteiro, os slides e o link do QR (WhatsApp).
- `src/cenas/`: uma cena por arquivo. Os marcos de cada animação (`T`) são presos ao
  início das falas, então a cena acompanha a voz.
- `src/Mestre.tsx` e `src/Pilula.tsx`: a ordem das cenas nos vídeos.
- `src/marca.ts`: cores e fontes do manual de marca (`docs/manual-de-marca-previa.md`).
- `src/ui/Palco.tsx`: como a cena vertical vira horizontal (fala à esquerda, cena à direita).
- `src/ui/Som.tsx`: volume de cada efeito sonoro; onde cada um toca está nas cenas
  (`<Som>`), nos toques e notificações (`ui/efeitos.tsx`) e nas trocas de cena.

Os slides da cena do carrossel vêm do próprio app (`@/components/CarrosselSlide`,
via o alias em `remotion.config.ts`). Os textos e rótulos das telas seguem o app; ao
mudar uma tela no app, confira a cena correspondente.
