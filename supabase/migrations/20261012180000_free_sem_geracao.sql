-- =========================================================
-- Plano 'free' deixa de gerar.
--
-- 'free' é para onde vai quem não paga mais: trial expirado (expirar_trials),
-- reembolso, chargeback e cancelamento (webhook da Kiwify). Ele ainda liberava
-- 8 roteiros e 4 carrosséis por mês, então quem pedia reembolso continuava
-- usando de graça. A pessoa mantém o login e o que já produziu; só não gera
-- nada novo até assinar de novo.
-- =========================================================

-- ============ 1) Cotas zeradas ============
update public.planos
set limite_curadorias_mes = 0,
    limite_roteiros_mes = 0,
    limite_carrosseis_mes = 0,
    limite_imagens_mes = 0
where codigo = 'free';

-- ============ 2) Motivo próprio no limite_disponivel ============
-- Recriada a partir de 20261006190000_imagem_capa_ia.sql; só ganhou o desvio
-- para 'free'. Sem ele a tela diria "limite atingido, renova no dia 1" para
-- quem não tem assinatura — e no dia 1 nada renovaria.
create or replace function public.limite_disponivel(_conta_id uuid, _tipo text)
returns jsonb
language plpgsql
stable security definer
set search_path to 'public'
as $function$
declare
  v_plano public.planos;
  v_conta public.contas;
  v_ciclo date;
  v_usado integer;
  v_limite integer;
begin
  select * into v_conta from public.contas where id = _conta_id;
  if v_conta is null then
    return jsonb_build_object('permitido', false, 'motivo', 'conta_inexistente');
  end if;
  if v_conta.status <> 'ativa' then
    return jsonb_build_object('permitido', false, 'motivo', 'conta_suspensa');
  end if;
  if v_conta.plano_codigo = 'free' then
    return jsonb_build_object('permitido', false, 'motivo', 'sem_assinatura', 'tipo', _tipo,
      'plano', 'free');
  end if;

  select * into v_plano from public.planos where codigo = v_conta.plano_codigo;
  v_ciclo := date_trunc('month', now())::date;

  v_limite := case _tipo
    when 'curadoria' then v_plano.limite_curadorias_mes
    when 'roteiro' then v_plano.limite_roteiros_mes
    when 'carrossel' then v_plano.limite_carrosseis_mes
    when 'imagem' then v_plano.limite_imagens_mes
    else null
  end;

  if v_limite is null then
    return jsonb_build_object('permitido', true, 'motivo', 'sem_limite');
  end if;

  select coalesce(quantidade, 0) into v_usado
  from public.uso_mensal where conta_id = _conta_id and ciclo = v_ciclo and tipo = _tipo;
  v_usado := coalesce(v_usado, 0);

  return jsonb_build_object(
    'permitido', v_usado < v_limite,
    'motivo', case when v_usado < v_limite then 'ok' else 'limite_atingido' end,
    'tipo', _tipo,
    'usado', v_usado,
    'limite', v_limite,
    'ciclo', v_ciclo,
    'reset_em', (v_ciclo + interval '1 month')::date,
    'plano', v_plano.codigo
  );
end $function$;

revoke all on function public.limite_disponivel(uuid, text) from public, anon, authenticated;
grant execute on function public.limite_disponivel(uuid, text) to service_role;
