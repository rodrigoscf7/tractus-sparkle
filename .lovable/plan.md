# Plano

Duas frentes, ambas só de frontend (não mexer em agentes/edge functions).

## 1. Saída final amigável na tela de aprovação

Arquivo: `src/routes/_authenticated/aprovacao.$pautaId.tsx`

Trocar os dois `<pre>{JSON.stringify(...)}</pre>` por renderização estruturada.

**Roteiro** (`roteiros.conteudo` = `{ gancho, corpo, cta, legenda_sugerida }`):
- Bloco "Gancho" — texto destacado, fonte maior.
- Bloco "Corpo" — se `corpo` for string, parágrafo único; se array (carrossel), lista numerada "Slide 1, Slide 2…" cada um em card leve.
- Bloco "CTA" — destacado com badge.
- Bloco "Legenda sugerida" — caixa monoespaço pronta pra copiar, com botão **Copiar**.

**Briefing visual** (`artes.briefing` = `{ estilo_geral, paleta_cores, estrutura_por_slide_ou_frame, tipografia, observacoes_producao }`):
- "Estilo geral" — parágrafo.
- "Paleta" — swatches coloridos com hex ao lado.
- "Estrutura por slide/frame" — lista numerada.
- "Tipografia" e "Observações de produção" — parágrafos rotulados.
- Botão **Copiar briefing** que copia versão texto plano.

Fallback defensivo: se a chave esperada não existir (LLM saiu fora do schema), mostrar o JSON cru num `<details>` recolhido em vez de quebrar a tela.

Nenhuma mudança de lógica/decisão — só apresentação.

## 2. Página de detalhe por agente com timeline

**Rota nova:** `src/routes/_authenticated/agentes.$agente.tsx` (`/agentes/curador`, `/agentes/ideador`, etc.)

**Ajuste em `agentes.tsx`:** envolver cada card num `<Link to="/agentes/$agente" params={{ agente: nome }}>` para virar clicável (manter visual atual; só adicionar hover sutil).

**Página de detalhe** mostra:
- Header com nome do agente, estado atual e última ação (mesmos dados de `agentes_status`).
- Timeline cronológica decrescente (mais recente primeiro), paginada client-side (50 por página).
- Cada item: data/hora, "perfil" relacionado quando aplicável, título curto e preview de 2 linhas do conteúdo produzido. Cards do copy/visual/revisor linkam para a página de aprovação da pauta.

**Fonte de dados por agente:**

| Agente | Tabela | Campos exibidos |
|---|---|---|
| curador | `conteudos_curados` (ordenar por `capturado_em`) | tema, gancho, score, perfil de referência |
| ideador | `pautas_geradas` (ordenar por `criado_em`) | tema, ângulo, formato, perfil |
| copy | `roteiros` join `pautas_geradas` | tema da pauta + gancho do roteiro |
| visual | `artes` join `pautas_geradas` | tema da pauta + estilo_geral do briefing |
| revisor | `pautas_geradas` filtrado por status in (`aguardando_aprovacao`, `aprovada`, `rejeitada`), ordenar por `criado_em` | tema, status final |

Observação para o revisor: não existe timestamp da transição em si; usamos `criado_em` da pauta como aproximação e exibimos o status atual ao lado. Suficiente pra acompanhar produção; se depois quisermos timestamp exato, adicionamos uma coluna `revisado_em` numa migration separada.

Realtime: subscribe na tabela do agente para atualizar a timeline sem refresh (mesma lógica de `agentes-realtime` já existente).

## Itens técnicos

- Sem mudança de schema, sem mudança em edge functions.
- Reutilizar componentes `Card`, `Badge`, `Button` existentes.
- Botão Copiar usa `navigator.clipboard.writeText` + `toast.success`.
- Paleta de cores no briefing: `<div style={{ background: hex }}>` com label hex — única exceção tolerada a cor inline, por ser conteúdo de dado, não tema.
