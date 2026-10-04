-- Fila de coleta do curador.
--
-- Antes, o cron das 11:00 UTC disparava todas as referências de uma vez. A conta
-- do Apify aceita 5 execuções simultâneas, então com 15 referências 10 voltavam
-- 402 e só seriam tentadas no dia seguinte. Agora o cron roda a cada 5 minutos na
-- janela da manhã e cada tick reserva um lote pequeno do que ainda falta no dia.

alter table public.perfis_referencia
  add column if not exists ultima_coleta_em timestamptz,
  add column if not exists ultima_tentativa_em timestamptz,
  add column if not exists tentativas_hoje smallint not null default 0;

-- Quem já tem conteúdo coletado não é recoletado no mesmo dia da migration.
update public.perfis_referencia r
set ultima_coleta_em = c.ultimo
from (
  select perfil_referencia_id, max(capturado_em) as ultimo
  from public.conteudos_curados
  group by perfil_referencia_id
) c
where c.perfil_referencia_id = r.id;

/**
 * Reserva até `_limite` referências que ainda não foram coletadas hoje (dia de
 * São Paulo) e marca a tentativa na mesma instrução.
 *
 * - FOR UPDATE SKIP LOCKED + marcação atômica: dois ticks do cron sobrepostos
 *   nunca levam a mesma referência.
 * - A reserva vale 20 minutos: o worker que não terminou nesse prazo é dado como
 *   perdido e a referência volta para a fila.
 * - No máximo 3 tentativas por dia: handle inválido ou perfil privado não gasta
 *   Apify o dia inteiro.
 * - Quem tentou há mais tempo vai primeiro.
 */
create or replace function public.reservar_referencias_coleta(_limite integer)
returns table (ref_id uuid, ref_handle text)
language plpgsql
security definer
set search_path = public
as $$
declare
  _inicio timestamptz :=
    date_trunc('day', now() at time zone 'America/Sao_Paulo') at time zone 'America/Sao_Paulo';
begin
  return query
  with alvo as (
    select r.id
    from public.perfis_referencia r
    where r.ativo
      and (r.ultima_coleta_em is null or r.ultima_coleta_em < _inicio)
      and (r.ultima_tentativa_em is null or r.ultima_tentativa_em < now() - interval '20 minutes')
      and (r.ultima_tentativa_em is null or r.ultima_tentativa_em < _inicio or r.tentativas_hoje < 3)
    order by coalesce(r.ultima_tentativa_em, 'epoch'::timestamptz), r.criado_em
    limit greatest(_limite, 0)
    for update skip locked
  )
  update public.perfis_referencia r
  set tentativas_hoje = case
        when r.ultima_tentativa_em >= _inicio then r.tentativas_hoje + 1
        else 1
      end,
      ultima_tentativa_em = now()
  from alvo
  where r.id = alvo.id
  returning r.id, r.handle;
end;
$$;

revoke all on function public.reservar_referencias_coleta(integer) from public, anon, authenticated;
grant execute on function public.reservar_referencias_coleta(integer) to service_role;

-- Cron: de 08:00 a 13:55 em Brasília, a cada 5 minutos. Os ticks sem nada
-- pendente custam uma consulta e nenhuma chamada externa.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'curador-diario') then
    perform cron.unschedule('curador-diario');
  end if;
  if exists (select 1 from cron.job where jobname = 'curador-lote') then
    perform cron.unschedule('curador-lote');
  end if;
end;
$$;

select cron.schedule('curador-lote', '*/5 11-16 * * *', $$
  select net.http_post(
    url := public.agent_function_url('curador-agent'),
    headers := public.agent_internal_headers(),
    body := '{}'::jsonb
  );
$$);
