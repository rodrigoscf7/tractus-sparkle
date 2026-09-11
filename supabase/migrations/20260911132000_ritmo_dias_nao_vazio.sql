-- Corrige a checagem de `perfis.ritmo_dias` introduzida em 20260911093000.
--
-- `array_length(ARRAY[]::smallint[], 1)` devolve NULL, não 0. Como CHECK só
-- reprova quando a expressão é FALSE — NULL passa —, a restrição original
-- aceitava lista vazia, e um perfil sem nenhum dia deixa a pauta da semana sem
-- nenhuma linha. `cardinality()` devolve 0 para array vazio e fecha o buraco.

-- Rede de segurança: qualquer linha que tenha escapado volta ao padrão antes de
-- a restrição passar a valer, senão o ALTER falha na validação.
UPDATE public.perfis
  SET ritmo_dias = '{1,3,5}'
  WHERE cardinality(ritmo_dias) = 0;

ALTER TABLE public.perfis
  DROP CONSTRAINT IF EXISTS perfis_ritmo_dias_validos;

ALTER TABLE public.perfis
  ADD CONSTRAINT perfis_ritmo_dias_validos CHECK (
    cardinality(ritmo_dias) BETWEEN 1 AND 7
    AND ritmo_dias <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  );
