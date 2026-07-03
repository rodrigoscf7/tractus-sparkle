# Página de agentes: visão de processo, não só resultado

Hoje `/agentes/:agente` lista os itens produzidos e cada clique leva pra tela de aprovação. Vou transformar essa página no "raio-x" do agente: como ele decide, com o que trabalhou e o que entregou — mantendo o pipeline atual intocado.

## O que muda em cada página de agente

**Topo (fixo, por agente)** — bloco humanizado "Como este agente decide":
- Explicação em português do papel, dos critérios e dos gatilhos.
- Fontes de dados que consulta (perfis de referência, curadoria, pauta etc.).
- Regras concretas (ex.: curador só grava se `score ≥ 7`; ideador gera fallback evergreen quando não há curadoria nova).
- Estatísticas do dia: nº de execuções, aproveitados vs descartados, última rodada.

**Timeline de execuções** — cada item vira um card expansível (accordion), não mais um link direto pra aprovação:

- **Curador** — por conteúdo curado:
  - Post original: handle, formato, link pro Instagram, data, likes, views, comentários.
  - Análise do agente: `tema`, `gancho`, `score`, `motivo do score`.
  - Trecho da caption original (colapsável).
  - Se virou pauta, link "→ ver pauta gerada".
- **Ideador** — por pauta:
  - Origem: card do conteúdo curado que inspirou (ou marca "evergreen / posicionamento" quando é fallback).
  - Pauta: tema, ângulo, formato.
  - Perfil-alvo e diretrizes que pesaram.
  - Link "→ ver roteiro/arte" quando existirem.
- **Copy** — por roteiro:
  - Pauta de entrada (tema/ângulo).
  - Saída humanizada: gancho falado, desenvolvimento, CTA, legenda.
  - Roteiros rejeitados do mesmo perfil que ele evitou repetir (contagem + amostra).
- **Visual** — por briefing:
  - Pauta + roteiro que serviram de base.
  - Direções de gravação em texto corrido.
- **Revisor** — por decisão:
  - Pauta + roteiro + visual revisados.
  - Status final (aprovada / aguardando / rejeitada) e, quando houver, comentário do usuário na aprovação.

O link para `/aprovacao/:pautaId` continua existindo, mas como botão explícito ("Ver na aprovação"), não como o clique inteiro do card.

## Pequeno ajuste de dados (necessário pra "ver métricas do post")

Hoje o curador **analisa** likes/views/comentários mas só persiste `score`, `tema`, `gancho`, `url`, `formato`, `texto_original`. Pra você ver as métricas do reel de referência sem depender de rebuscar no Apify, adiciono 4 colunas em `conteudos_curados`:

- `likes int`, `comentarios int`, `views int`, `postado_em timestamptz`

E passo o curador a gravá-las junto no `insert`. É a única mudança fora da UI, e é aditiva (não quebra nada existente).

## Detalhes técnicos

- Arquivo principal: reescrever `src/routes/_authenticated/agentes.$agente.tsx` — trocar `fetchTimeline` por consultas com joins mais ricos e trocar o card-link por card-accordion (`Collapsible` do shadcn, já disponível).
- Novo componente `AgenteCriterios` (um por agente) com o texto humanizado no topo — conteúdo estático em `src/lib/agente-criterios.ts` (fácil de editar depois).
- Novo componente `ExecucaoCard` (accordion) com variantes por agente para renderizar input / processo / output.
- Estatísticas do topo: `count` por status em cada tabela (uma query só, agregada).
- Migração: `ALTER TABLE public.conteudos_curados ADD COLUMN likes int, ADD COLUMN comentarios int, ADD COLUMN views int, ADD COLUMN postado_em timestamptz;` (todas nulláveis, sem default, sem quebrar RLS/grants existentes).
- Edge function `curador-agent`: incluir `likes: post.likesCount`, `comentarios: post.commentsCount`, `views: post.videoPlayCount`, `postado_em: post.timestamp` no `insert`. Deploy da função.
- Sem mudanças em ideador, copy, visual, revisor, cron, triggers ou schema além do descrito.
- Nada muda em `/pipeline` nem em `/aprovacao/:pautaId`.

## Fora de escopo (posso fazer depois se quiser)

- Persistir o raciocínio bruto do modelo (prompt efetivo, resposta completa, tokens, duração) numa tabela `execucoes_agentes` — é a opção "rastro de raciocínio" que você preferiu deixar de fora agora.
- Métricas históricas antigas: pautas/curadorias já gravadas não terão likes/views/comentários preenchidos retroativamente; só valem daqui pra frente.
