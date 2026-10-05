-- Entrega do plano semanal: notificação de plano pronto e criação automática do
-- plano de cada conta aos domingos.

-- ============ 1) Tipos de notificação ============
-- A restrição original só aceitava 'curadoria_pronta' e 'pautas_prontas'. O
-- 'ritmo_hoje' (lembrete do dia de gravar, 20260911140000) violava a restrição e o
-- cron cobranca-ritmo falhava a cada hora sem enviar nada. 'plano_pronto' é novo.
alter table public.push_notificacoes_pendentes
  drop constraint if exists push_notificacoes_pendentes_tipo_check;
alter table public.push_notificacoes_pendentes
  add constraint push_notificacoes_pendentes_tipo_check
  check (tipo in ('curadoria_pronta', 'pautas_prontas', 'ritmo_hoje', 'plano_pronto'));

-- O planejador (service role) enfileira o aviso de plano pronto.
grant execute on function public.enfileirar_notificacao_push(uuid, uuid, text) to service_role;

-- ============ 2) Plano da semana de cada conta ============
/**
 * Cria o plano da próxima semana (começando na segunda) para cada conta ativa com
 * onboarding concluído. Os ticks do planejador fazem o resto.
 *
 * Pula quem ganhou um plano nos últimos 3 dias: quem acabou de fazer o onboarding
 * já está com o plano da semana corrente.
 */
create or replace function public.criar_planos_da_semana()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  _hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  _segunda date;
  _criados integer;
begin
  -- Próxima segunda-feira; rodando numa segunda, a da semana seguinte.
  _segunda := _hoje + ((8 - extract(isodow from _hoje)::int) % 7);
  if _segunda = _hoje then
    _segunda := _hoje + 7;
  end if;

  insert into public.planos_semanais (conta_id, perfil_id, semana_inicio)
  select o.conta_id, o.perfil_id, _segunda
  from public.onboarding_respostas o
  join public.contas c on c.id = o.conta_id
  where o.concluido_em is not null
    and o.perfil_id is not null
    and c.status = 'ativa'
    and not exists (
      select 1 from public.planos_semanais p
      where p.conta_id = o.conta_id
        and p.criado_em > now() - interval '3 days'
    )
  on conflict (conta_id, semana_inicio) do nothing;

  get diagnostics _criados = row_count;
  return _criados;
end;
$$;

revoke all on function public.criar_planos_da_semana() from public, anon, authenticated;
grant execute on function public.criar_planos_da_semana() to service_role;

-- Domingo, 12:00 em Brasília: os planos ficam prontos à tarde e o aviso chega
-- dentro da janela de notificação (7h às 22h).
do $$
begin
  if exists (select 1 from cron.job where jobname = 'planos-da-semana') then
    perform cron.unschedule('planos-da-semana');
  end if;
end;
$$;

select cron.schedule('planos-da-semana', '0 15 * * 0', $$ select public.criar_planos_da_semana(); $$);
