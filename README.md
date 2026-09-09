# Tractus Content Hub

Pipeline de produção de conteúdo com curadoria humana e agentes de IA.

Stack: TanStack Start (React 19, SSR) no Railway, Supabase para banco, auth, storage
e Edge Functions, Anthropic Claude para os agentes e Apify para a curadoria.

## Desenvolvimento

Requer Node.js 22+.

```sh
npm install
cp .env.example .env.local   # preencha com as credenciais do seu projeto Supabase
npm run dev
```

Outros comandos:

```sh
npm run build   # gera .output/
npm start       # sobe o build de produção
npm run lint
```

## Arquitetura

O app serve SSR e expõe o webhook da Kiwify em `/api/public/webhooks/kiwify`. A
lógica de negócio de billing fica em server functions (`src/lib/*.functions.ts`),
autenticadas pelo middleware em `src/integrations/supabase/auth-middleware.ts`.

Os seis agentes rodam como Edge Functions no Supabase e são orquestrados pelo próprio
banco: `pg_cron` dispara a curadoria e a promoção de pautas, e triggers em
`conteudos_curados`, `pautas_geradas`, `roteiros` e `artes` encadeiam o restante do
pipeline via `pg_net`.

```
curador -> ideador -> copy + visual -> revisor -> carrossel
```

## Banco de dados

`supabase/migrations/` é a fonte da verdade. Para provisionar um projeto novo:

```sh
supabase link --project-ref <ref>
supabase db push
supabase functions deploy
```

Antes do `db push`, crie os segredos que os agentes usam para chamar as Edge Functions:

```sql
select vault.create_secret('https://<ref>.supabase.co', 'agent_base_url');
select vault.create_secret('<publishable key>',         'agent_apikey');
select vault.create_secret('<openssl rand -hex 32>',    'agent_internal_secret');
```

O valor de `agent_internal_secret` precisa ser o mesmo do secret `AGENT_INTERNAL_SECRET`
configurado nas Edge Functions, junto com `ANTHROPIC_API_KEY` e `APIFY_API_TOKEN`.

O primeiro usuário que se cadastrar vira admin da instância e assume a conta semeada
pelas migrations.
