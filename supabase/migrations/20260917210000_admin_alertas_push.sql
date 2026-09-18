-- Dedupe diário de alertas push para admins da plataforma (falhas de agentes).
create table public.admin_alertas_push (
  chave text not null,
  dia date not null,
  primeiro_em timestamptz not null default now(),
  primary key (chave, dia)
);

comment on table public.admin_alertas_push is
  'Controla 1 alerta push por chave/dia (America/Sao_Paulo) para falhas de agentes.';

grant all on public.admin_alertas_push to service_role;
alter table public.admin_alertas_push enable row level security;
-- Sem policies para authenticated: só service_role (edge functions) escreve/lê.
