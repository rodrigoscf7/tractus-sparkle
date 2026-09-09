# Tractus Content Hub

TanStack Start (SSR) + Supabase, hospedado no Railway. O build usa Nitro no preset
`node-server`; `npm run build` gera `.output/` e `npm start` sobe `.output/server/index.mjs`.

## Configuração

Segredos ficam em `.env.local` (não versionado) a partir de `.env.example`. Nunca
prefixe segredo de servidor com `VITE_`: tudo que começa com `VITE_` é injetado no
bundle do cliente em build-time.

No Railway, as `VITE_*` precisam estar disponíveis também na etapa de build, não só
em runtime.

## Banco

`supabase/migrations/` é a única fonte da verdade do schema — aplique com
`supabase db push`. Não edite migrations já aplicadas; crie uma nova.

A URL do projeto, a apikey e o segredo interno dos agentes vêm do Vault do Supabase
(`agent_base_url`, `agent_apikey`, `agent_internal_secret`), lidos por
`public.agent_secret()`. Não escreva esses valores em SQL versionado.

## Edge Functions

As seis funções em `supabase/functions/` rodam com `verify_jwt = false` porque fazem
a própria autenticação em `_shared/agent-utils.ts`: aceitam o header `x-agent-secret`
(usado pelos cron jobs e triggers via pg_net) ou um JWT de usuário com role admin.
