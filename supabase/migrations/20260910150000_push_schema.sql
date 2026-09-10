-- Inscrições de push por dispositivo/navegador, uma por usuário autenticado.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz
);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;

create policy "usuario gerencia as proprias inscricoes push" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- Fila de agregação: um "lote aberto" por perfil + tipo de notificação.
-- Enquanto enviado_em for nulo, novos eventos incrementam o mesmo lote em vez
-- de criar um novo (ver o índice único parcial abaixo).
create table public.push_notificacoes_pendentes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  tipo text not null check (tipo in ('curadoria_pronta', 'pautas_prontas')),
  contagem integer not null default 1,
  primeiro_evento_em timestamptz not null default now(),
  ultimo_evento_em timestamptz not null default now(),
  enviado_em timestamptz
);

grant select on public.push_notificacoes_pendentes to authenticated;
grant all on public.push_notificacoes_pendentes to service_role;
alter table public.push_notificacoes_pendentes enable row level security;

create policy "membros da conta leem suas notificacoes pendentes" on public.push_notificacoes_pendentes
  for select to authenticated
  using (
    exists (
      select 1 from public.conta_membros cm
      where cm.conta_id = push_notificacoes_pendentes.conta_id
        and cm.user_id = auth.uid()
    )
  );

create unique index idx_push_pendentes_lote_aberto
  on public.push_notificacoes_pendentes (perfil_id, tipo)
  where enviado_em is null;

create index idx_push_pendentes_conta on public.push_notificacoes_pendentes(conta_id);

-- Intenção de receber notificações: existe separada da inscrição real porque
-- no iOS o convite acontece antes de o app estar instalado — o usuário pode
-- "querer" notificações antes de ser tecnicamente possível inscrevê-lo.
alter table public.conta_membros add column quer_notificacoes boolean not null default false;

-- Grant de coluna, não de tabela: o membro só pode alterar a própria
-- intenção de notificação, nunca papel/conta_id/user_id da própria linha.
grant update (quer_notificacoes) on public.conta_membros to authenticated;

create policy "membro atualiza a propria intencao de notificacao" on public.conta_membros
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
