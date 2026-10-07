-- Imagem da capa gerada por IA: cota mensal por plano e preço do modelo.
--
-- A cota acompanha a de carrosséis (uma imagem por carrossel do mês). O uso
-- é registrado pelo imagem-agent com registrar_uso(conta, 'imagem', 1).

-- ============ 1) Cota por plano ============
alter table public.planos
  add column if not exists limite_imagens_mes integer not null default 4;

update public.planos set limite_imagens_mes = limite_carrosseis_mes;

comment on column public.planos.limite_imagens_mes is
  'Imagens de capa geradas por IA por mês. Imagem enviada pela pessoa não conta.';

-- ============ 2) limite_disponivel conhece 'imagem' ============
-- Recriada a partir da definição em produção; só o CASE ganhou a linha nova.
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

-- ============ 3) Preço do modelo de imagem ============
-- Centavos de dólar por milhão de tokens (US$ 0,50 de entrada, US$ 3,00 de
-- saída). A imagem gerada é cobrada como tokens de saída.
insert into public.custo_precos (chave, rotulo, tipo, custo_entrada_mi_centavos, custo_saida_mi_centavos)
values ('google/gemini-3.1-flash-image', 'Gemini Flash Image (OpenRouter, capa do carrossel)', 'modelo', 50, 300)
on conflict (chave) do nothing;
