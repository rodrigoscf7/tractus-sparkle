-- Repontamento dos agentes para o projeto Supabase próprio.
--
-- Até aqui a URL do projeto, a anon key e o AGENT_INTERNAL_SECRET ficavam escritos
-- direto nas funções e nos cron jobs. Isso prendia o backend a um único projeto e
-- publicou o segredo interno no repositório. Os três passam a vir do Vault.
--
-- Antes de rodar esta migration, crie os segredos no projeto de destino:
--
--   select vault.create_secret('https://<ref>.supabase.co', 'agent_base_url');
--   select vault.create_secret('<publishable/anon key>',    'agent_apikey');
--   select vault.create_secret('<novo segredo aleatório>',  'agent_internal_secret');
--
-- O valor de agent_internal_secret precisa ser idêntico ao secret AGENT_INTERNAL_SECRET
-- configurado nas Edge Functions. Gere um novo: openssl rand -hex 32

create extension if not exists pg_cron;
create extension if not exists pg_net;
create extension if not exists supabase_vault with schema vault;

do $$
declare
  faltando text[];
begin
  select array_agg(nome)
  into faltando
  from unnest(array['agent_base_url', 'agent_apikey', 'agent_internal_secret']) as nome
  where not exists (select 1 from vault.secrets s where s.name = nome);

  if faltando is not null then
    raise exception 'Segredos ausentes no Vault: %. Crie-os com vault.create_secret() antes de rodar esta migration.', array_to_string(faltando, ', ');
  end if;
end $$;

-- Leitura dos segredos. Fica restrita ao service_role: qualquer EXECUTE concedido a
-- anon/authenticated aqui exporia a anon key e o segredo interno.
create or replace function public.agent_secret(nome text)
returns text
language sql
stable
security definer
set search_path = public, vault
as $$
  select decrypted_secret from vault.decrypted_secrets where name = nome limit 1
$$;

revoke all on function public.agent_secret(text) from public, anon, authenticated;

create or replace function public.agent_function_url(nome text)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select rtrim(public.agent_secret('agent_base_url'), '/') || '/functions/v1/' || nome
$$;

revoke all on function public.agent_function_url(text) from public, anon, authenticated;

-- Deixa de ser IMMUTABLE: o conteúdo agora depende do Vault.
create or replace function public.agent_internal_headers()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', public.agent_secret('agent_apikey'),
    'x-agent-secret', public.agent_secret('agent_internal_secret')
  )
$$;

revoke all on function public.agent_internal_headers() from public, anon, authenticated;
grant execute on function public.agent_internal_headers() to service_role;

-- ===== Funções que disparam as Edge Functions =====

create or replace function public.trigger_ideador()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.aprovacao_humana = 'aprovado'
     and (old.aprovacao_humana is null or old.aprovacao_humana <> 'aprovado') then
    perform net.http_post(
      url := public.agent_function_url('ideador-agent'),
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('conteudo_id', new.id, 'perfil_referencia_id', new.perfil_referencia_id)
    );
  end if;
  return new;
end;
$function$;

create or replace function public.trigger_producao()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
begin
  if new.status = 'em_producao' and (old.status is null or old.status != 'em_producao') then
    perform net.http_post(
      url := public.agent_function_url('copy-agent'),
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', new.id)
    );
    perform net.http_post(
      url := public.agent_function_url('visual-agent'),
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', new.id)
    );
  end if;
  return new;
end;
$function$;

create or replace function public.trigger_revisor_via_arte()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  roteiro_pronto boolean;
begin
  select exists(select 1 from public.roteiros where pauta_id = new.pauta_id and status = 'pronto') into roteiro_pronto;
  if new.status = 'pronto' and roteiro_pronto then
    perform net.http_post(
      url := public.agent_function_url('revisor-agent'),
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', new.pauta_id)
    );
  end if;
  return new;
end;
$function$;

create or replace function public.trigger_revisor_via_roteiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $function$
declare
  arte_pronta boolean;
begin
  select exists(select 1 from public.artes where pauta_id = new.pauta_id and status = 'pronto') into arte_pronta;
  if new.status = 'pronto' and arte_pronta then
    perform net.http_post(
      url := public.agent_function_url('revisor-agent'),
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', new.pauta_id)
    );
  end if;
  return new;
end;
$function$;

create or replace function public.revisar_next_pauta_pronta()
returns void
language plpgsql
security definer
set search_path = public
as $function$
declare
  next_id uuid;
begin
  select p.id into next_id
  from public.pautas_geradas p
  where p.status = 'em_producao'
    and exists (select 1 from public.roteiros r where r.pauta_id = p.id and r.status = 'pronto')
    and exists (select 1 from public.artes a where a.pauta_id = p.id and a.status = 'pronto')
  order by p.criado_em asc nulls last
  limit 1;

  if next_id is not null then
    perform net.http_post(
      url := public.agent_function_url('revisor-agent'),
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', next_id)
    );
  end if;
end;
$function$;

revoke all on function public.revisar_next_pauta_pronta() from public, anon, authenticated;
revoke all on function public.trigger_ideador() from public, anon, authenticated;
revoke all on function public.trigger_producao() from public, anon, authenticated;
revoke all on function public.trigger_revisor_via_arte() from public, anon, authenticated;
revoke all on function public.trigger_revisor_via_roteiro() from public, anon, authenticated;

-- ===== Cron jobs =====
-- O pg_restore do backup do Lovable Cloud não repovoa cron.job, então os quatro
-- jobs são recriados aqui. Reagendar é idempotente: desmarca antes de marcar.

select cron.unschedule(jobname)
from cron.job
where jobname in ('curador-diario', 'ideador-diario', 'promote-pautas', 'revisar-pautas-prontas');

select cron.schedule('curador-diario', '0 11 * * *', $$
  select net.http_post(
    url := public.agent_function_url('curador-agent'),
    headers := public.agent_internal_headers(),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('ideador-diario', '45 11 * * *', $$
  select net.http_post(
    url := public.agent_function_url('ideador-agent'),
    headers := public.agent_internal_headers(),
    body := '{}'::jsonb
  );
$$);

select cron.schedule('promote-pautas', '*/2 * * * *', $$ select public.promote_next_pauta(); $$);

select cron.schedule('revisar-pautas-prontas', '*/3 * * * *', $$ select public.revisar_next_pauta_pronta(); $$);
