-- Lançamento com um plano só (Starter, R$ 47,90) e desligamento da curadoria diária.

-- ============ 1) Plano único ============
-- Limites dimensionados pelo custo do plano semanal: a coleta no Apify cresce com
-- o número de referências; roteiros cobrem postar todo dia com folga para regerar.
-- limite_curadorias_mes deixa de valer: a curadoria diária foi desligada abaixo.
update public.planos
set preco_mensal_centavos = 4790,
    limite_referencias = 5,
    limite_roteiros_mes = 30,
    limite_carrosseis_mes = 10,
    limite_perfis = 1,
    publico = true,
    ativo = true
where codigo = 'starter';

-- Pro fica ativo só para as contas que já estão nele; Free é o estado de trial
-- expirado (expirar_trials). Nenhum dos dois aparece na oferta.
update public.planos set publico = false where codigo in ('pro', 'free');

-- ============ 2) Custo real do Apify ============
-- US$ 2,70 por mil resultados = 0,27 centavo de dólar por item coletado.
update public.custo_precos
set custo_execucao_centavos = 0.27,
    atualizado_em = now()
where chave = 'apify';

-- ============ 3) Curadoria diária desligada ============
-- O plano semanal substitui a coleta diária por referência. conteudos_curados
-- fica como histórico; o curador-agent continua deployado, mas sem cron.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'curador-lote') then
    perform cron.unschedule('curador-lote');
  end if;
end;
$$;

-- ============ 4) Plano semanal só para quem paga ============
-- Trial expirado volta para 'free' com status 'ativa'; sem este filtro o cron de
-- domingo geraria plano (e custo) para quem não assina.
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
    and c.plano_codigo <> 'free'
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
