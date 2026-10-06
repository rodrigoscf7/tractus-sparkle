-- Assistente de suporte dentro do app: conversas, mensagens (com a ação que a IA
-- propôs e o que aconteceu com ela) e chamados encaminhados para uma pessoa.
--
-- Toda escrita passa pelo service role (server functions e suporte-agent). O
-- usuário só lê o que é dele; o admin lê os chamados.

create table if not exists public.suporte_conversas (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'aberta' check (status in ('aberta', 'encaminhada', 'encerrada')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create index if not exists idx_suporte_conversas_usuario
  on public.suporte_conversas (user_id, atualizado_em desc);

create table if not exists public.suporte_mensagens (
  id uuid primary key default gen_random_uuid(),
  conversa_id uuid not null references public.suporte_conversas(id) on delete cascade,
  papel text not null check (papel in ('usuario', 'assistente')),
  conteudo text not null default '',
  -- Ação proposta pela IA: { tipo, args, descricao, status, resultado }.
  -- status: proposta | executada | cancelada | erro. Só a server function muda.
  acao jsonb,
  criado_em timestamptz not null default now()
);

create index if not exists idx_suporte_mensagens_conversa
  on public.suporte_mensagens (conversa_id, criado_em);

create table if not exists public.suporte_chamados (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  conversa_id uuid references public.suporte_conversas(id) on delete set null,
  resumo text not null,
  status text not null default 'aberto' check (status in ('aberto', 'resolvido')),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);

create index if not exists idx_suporte_chamados_abertos
  on public.suporte_chamados (criado_em desc) where status = 'aberto';

alter table public.suporte_conversas enable row level security;
alter table public.suporte_mensagens enable row level security;
alter table public.suporte_chamados enable row level security;

grant select on public.suporte_conversas, public.suporte_mensagens, public.suporte_chamados to authenticated;
grant all on public.suporte_conversas, public.suporte_mensagens, public.suporte_chamados to service_role;

create policy "usuario le suas conversas" on public.suporte_conversas
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

create policy "usuario le mensagens das suas conversas" on public.suporte_mensagens
  for select to authenticated
  using (
    exists (
      select 1 from public.suporte_conversas c
      where c.id = conversa_id
        and (c.user_id = auth.uid() or public.has_role(auth.uid(), 'admin'))
    )
  );

create policy "usuario e admin leem chamados" on public.suporte_chamados
  for select to authenticated
  using (user_id = auth.uid() or public.has_role(auth.uid(), 'admin'));

-- Admin marca chamado como resolvido pela tela de administração.
grant update (status, resolvido_em) on public.suporte_chamados to authenticated;
create policy "admin resolve chamados" on public.suporte_chamados
  for update to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Preço do modelo do assistente (centavos de dólar por milhão de tokens).
insert into public.custo_precos (chave, rotulo, tipo, custo_entrada_mi_centavos, custo_saida_mi_centavos)
values ('anthropic/claude-haiku-4.5', 'Claude Haiku (OpenRouter)', 'modelo', 100, 500)
on conflict (chave) do nothing;
