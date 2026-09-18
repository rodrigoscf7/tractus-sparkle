# Curador score ≥ 5 + alerta admin por falha de agente

## Decisões

- Gravar curadoria quando `score_curadoria >= 5` (antes: `>= 6`).
- Em qualquer `setStatus(agente, "error", …)`, enviar Web Push imediato aos
  usuários com `user_roles.role = 'admin'` e inscrição em `push_subscriptions`.
- Sem quiet hours.
- Dedupe: no máximo 1 push por `(chave, dia America/Sao_Paulo)`, chave =
  `agente:apify|modelo|limite|outro` derivada da mensagem.
- Se o push falhar: só log; sem loop.

## Implementação

- `MIN_SCORE_TO_SAVE = 5` em `curador-agent`.
- Tabela `admin_alertas_push (chave, dia PK)`.
- `alertarAdminFalha` em `_shared/agent-utils.ts`, chamado por `setStatus` no
  ramo `error`.
- Redeploy das edge functions que embutem `_shared`.
