-- Motor do plano semanal: analisa os posts que performaram acima do normal nas
-- referências da conta e transforma o padrão deles no plano de vídeos da semana.
-- Substitui a curadoria diária (conteudos_curados), que fica como histórico.

-- ============ 1) Cache global de análises ============
-- Um post público analisado serve a todas as contas que seguem a mesma
-- referência: a análise descreve o post, não o perfil de quem vai usá-la.
create table if not exists public.analises_virais (
  id uuid primary key default gen_random_uuid(),
  url text not null unique,
  handle text not null,
  formato text not null check (formato in ('reel', 'carrossel', 'imagem')),
  metrica bigint,
  mediana numeric,
  indice numeric,
  likes integer,
  comentarios integer,
  views bigint,
  postado_em timestamptz,
  legenda text,
  analise jsonb not null,
  modelo text not null,
  analisado_em timestamptz not null default now()
);

create index if not exists idx_analises_virais_handle on public.analises_virais (handle);

alter table public.analises_virais enable row level security;
grant select on public.analises_virais to authenticated;
grant all on public.analises_virais to service_role;
-- Posts públicos do Instagram: qualquer usuário logado pode ler a análise.
create policy "autenticados leem analises" on public.analises_virais
  for select to authenticated using (true);

-- ============ 2) Planos semanais ============
create table if not exists public.planos_semanais (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  perfil_id uuid references public.perfis(id) on delete set null,
  -- Primeiro dia coberto pelo plano; o plano cobre 7 dias a partir dele.
  semana_inicio date not null,
  status text not null default 'coletando'
    check (status in ('coletando', 'analisando', 'planejando', 'pronto', 'aprovado', 'erro')),
  -- Estado intermediário entre os passos (posts coletados, análises escolhidas).
  etapa_dados jsonb not null default '{}'::jsonb,
  relatorio jsonb,
  erro text,
  tentativas smallint not null default 0,
  reservado_em timestamptz,
  -- Plano do onboarding passa na frente dos planos de domingo.
  prioridade smallint not null default 0,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  pronto_em timestamptz,
  aprovado_em timestamptz,
  unique (conta_id, semana_inicio)
);

create index if not exists idx_planos_semanais_fila
  on public.planos_semanais (prioridade desc, criado_em)
  where status in ('coletando', 'analisando', 'planejando');

alter table public.planos_semanais enable row level security;
grant select on public.planos_semanais to authenticated;
grant all on public.planos_semanais to service_role;
-- Leitura pelos membros da conta. Toda escrita passa por server function ou
-- edge function com service role: aprovar um plano cria pautas e dispara custo.
create policy "membros leem planos da conta" on public.planos_semanais
  for select to authenticated
  using (public.is_conta_membro(conta_id) or public.has_role(auth.uid(), 'admin'));

-- ============ 3) Pautas nascidas do plano ============
alter table public.pautas_geradas
  add column if not exists plano_semanal_id uuid references public.planos_semanais(id) on delete set null,
  add column if not exists analise_viral_id uuid references public.analises_virais(id) on delete set null,
  add column if not exists gancho_modelo text,
  add column if not exists estrutura_modelo jsonb,
  add column if not exists data_prevista date;

-- ============ 4) Fila ============
/**
 * Reserva até `_limite` planos com passo pendente e marca a tentativa na mesma
 * instrução (dois ticks sobrepostos nunca levam o mesmo plano).
 *
 * - A reserva vale 10 minutos: worker que não terminou é dado como perdido.
 * - 4 tentativas por passo; o worker zera o contador quando avança de passo.
 *   Esgotadas, o plano vai para 'erro' no tick seguinte.
 */
create or replace function public.reservar_planos_semanais(_limite integer)
returns table (plano_id uuid, plano_status text)
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.planos_semanais
  set status = 'erro',
      erro = coalesce(erro, 'tentativas esgotadas no passo ' || status),
      atualizado_em = now()
  where status in ('coletando', 'analisando', 'planejando')
    and tentativas >= 4
    and (reservado_em is null or reservado_em < now() - interval '10 minutes');

  return query
  with alvo as (
    select p.id
    from public.planos_semanais p
    where p.status in ('coletando', 'analisando', 'planejando')
      and p.tentativas < 4
      and (p.reservado_em is null or p.reservado_em < now() - interval '10 minutes')
    order by p.prioridade desc, p.criado_em
    limit greatest(_limite, 0)
    for update skip locked
  )
  update public.planos_semanais p
  set reservado_em = now(),
      tentativas = p.tentativas + 1,
      atualizado_em = now()
  from alvo
  where p.id = alvo.id
  returning p.id, p.status;
end;
$$;

revoke all on function public.reservar_planos_semanais(integer) from public, anon, authenticated;
grant execute on function public.reservar_planos_semanais(integer) to service_role;

-- ============ 5) Tick do planejador ============
-- A cada 3 minutos, todos os dias: o plano do onboarding não pode esperar o
-- domingo. Tick sem plano pendente custa uma consulta e nenhuma chamada externa.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'planejador-tick') then
    perform cron.unschedule('planejador-tick');
  end if;
end;
$$;

select cron.schedule('planejador-tick', '*/3 * * * *', $$
  select net.http_post(
    url := public.agent_function_url('planejador-agent'),
    headers := public.agent_internal_headers(),
    body := '{}'::jsonb
  );
$$);

-- Preço do modelo de análise de vídeo (centavos de dólar por milhão de tokens).
insert into public.custo_precos (chave, rotulo, tipo, custo_entrada_mi_centavos, custo_saida_mi_centavos)
values ('google/gemini-3.8-flash', 'Gemini Flash (OpenRouter, vídeo)', 'modelo', 75, 375)
on conflict (chave) do nothing;
