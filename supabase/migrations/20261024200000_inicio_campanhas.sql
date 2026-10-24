-- Ajustes do painel admin que precisam sobreviver a deploy (por enquanto, só
-- o início da medição da aba Campanhas). Uma linha por chave.
create table if not exists public.painel_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid references auth.users(id) on delete set null
);

-- A primeira campanha paga começou em 24/10/2026: o que veio antes é teste
-- e cortesia. O admin muda a data na própria aba.
insert into public.painel_config (chave, valor)
values ('campanhas_inicio', to_jsonb('2026-10-24T00:00:00-03:00'::text))
on conflict (chave) do nothing;

grant all on public.painel_config to service_role;
alter table public.painel_config enable row level security;
