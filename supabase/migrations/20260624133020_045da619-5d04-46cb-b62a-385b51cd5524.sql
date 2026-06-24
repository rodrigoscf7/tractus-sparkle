create trigger trg_pautas_trigger_producao
after update of status on public.pautas_geradas
for each row
execute function public.trigger_producao();

create trigger trg_roteiros_trigger_revisor
after insert or update of status on public.roteiros
for each row
execute function public.trigger_revisor_via_roteiro();

create trigger trg_artes_trigger_revisor
after insert or update of status on public.artes
for each row
execute function public.trigger_revisor_via_arte();

create or replace function public.revisar_next_pauta_pronta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_id uuid;
begin
  select p.id into next_id
  from public.pautas_geradas p
  where p.status = 'em_producao'
    and exists (
      select 1 from public.roteiros r
      where r.pauta_id = p.id and r.status = 'pronto'
    )
    and exists (
      select 1 from public.artes a
      where a.pauta_id = p.id and a.status = 'pronto'
    )
  order by p.criado_em asc nulls last
  limit 1;

  if next_id is not null then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/revisor-agent',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'
      ),
      body := jsonb_build_object('pauta_id', next_id)
    );
  end if;
end;
$$;

select cron.unschedule('revisar-pautas-prontas')
where exists (select 1 from cron.job where jobname = 'revisar-pautas-prontas');

select cron.schedule(
  'revisar-pautas-prontas',
  '*/3 * * * *',
  $$ select public.revisar_next_pauta_pronta(); $$
);

select public.revisar_next_pauta_pronta();