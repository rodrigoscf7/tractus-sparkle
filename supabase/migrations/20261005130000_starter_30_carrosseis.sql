-- Starter passa a incluir 30 carrosséis por mês (eram 10 em 20261005120000).
-- O carrossel custa cerca de US$ 0,01 de modelo: o limite é contra abuso, não margem.
update public.planos
set limite_carrosseis_mes = 30
where codigo = 'starter';
