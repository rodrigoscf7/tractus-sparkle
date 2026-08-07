-- Internal token shared with the agent functions (AGENT_INTERNAL_SECRET)
CREATE OR REPLACE FUNCTION public.agent_internal_headers()
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'Content-Type', 'application/json',
    'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc',
    'x-agent-secret', '695754b6786bfa66ab1a959b46b6c255a66e23799bdcf958b000f25108138f52'
  )
$$;

REVOKE ALL ON FUNCTION public.agent_internal_headers() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.agent_internal_headers() TO service_role;

CREATE OR REPLACE FUNCTION public.trigger_ideador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  if new.aprovacao_humana = 'aprovado'
     and (old.aprovacao_humana is null or old.aprovacao_humana <> 'aprovado') then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/ideador-agent',
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('conteudo_id', new.id, 'perfil_referencia_id', new.perfil_referencia_id)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_producao()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
begin
  if new.status = 'em_producao' and (old.status is null or old.status != 'em_producao') then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/copy-agent',
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', new.id)
    );
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/visual-agent',
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', new.id)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_revisor_via_arte()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  roteiro_pronto boolean;
begin
  select exists(select 1 from public.roteiros where pauta_id = new.pauta_id and status = 'pronto') into roteiro_pronto;
  if new.status = 'pronto' and roteiro_pronto then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/revisor-agent',
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', new.pauta_id)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.trigger_revisor_via_roteiro()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
declare
  arte_pronta boolean;
begin
  select exists(select 1 from public.artes where pauta_id = new.pauta_id and status = 'pronto') into arte_pronta;
  if new.status = 'pronto' and arte_pronta then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/revisor-agent',
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', new.pauta_id)
    );
  end if;
  return new;
end;
$function$;

CREATE OR REPLACE FUNCTION public.revisar_next_pauta_pronta()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
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
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/revisor-agent',
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('pauta_id', next_id)
    );
  end if;
end;
$function$;

-- Cron jobs: reenviar com o header interno
SELECT cron.unschedule('curador-diario') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'curador-diario');
SELECT cron.unschedule('ideador-diario') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ideador-diario');

SELECT cron.schedule('curador-diario', '0 11 * * *', $$
  SELECT net.http_post(
    url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/curador-agent',
    headers := public.agent_internal_headers(),
    body := '{}'::jsonb
  );
$$);

SELECT cron.schedule('ideador-diario', '45 11 * * *', $$
  SELECT net.http_post(
    url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/ideador-agent',
    headers := public.agent_internal_headers(),
    body := '{}'::jsonb
  );
$$);