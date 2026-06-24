create or replace function public.promote_next_pauta()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  next_id uuid;
begin
  select id into next_id
  from public.pautas_geradas
  where status = 'gerada'
  order by criado_em asc nulls last
  limit 1
  for update skip locked;

  if next_id is not null then
    update public.pautas_geradas
    set status = 'em_producao'
    where id = next_id;
  end if;
end;
$$;

do $$
begin
  perform cron.unschedule('promote-pautas');
exception when others then null;
end $$;

select cron.schedule(
  'promote-pautas',
  '*/2 * * * *',
  $$ select public.promote_next_pauta(); $$
);

-- Promove imediatamente a primeira pauta do backlog para destravar agora
select public.promote_next_pauta();