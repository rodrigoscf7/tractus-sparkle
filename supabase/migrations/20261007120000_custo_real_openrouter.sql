-- Custo real das chamadas de modelo.
--
-- Até aqui o custo era estimado: tokens × preço em custo_precos. Para modelos
-- de imagem isso não bate (a saída de imagem é cobrada diferente da de texto),
-- e qualquer preço desatualizado distorcia o painel. O OpenRouter devolve o
-- valor cobrado em cada resposta (usage.cost, em dólares); os agentes passam a
-- gravá-lo aqui, em centavos de dólar, na mesma unidade de custo_precos.

alter table public.custo_eventos
  add column if not exists custo_real_centavos numeric(14, 6);

comment on column public.custo_eventos.custo_real_centavos is
  'Valor cobrado pelo OpenRouter, em centavos de dólar. Nulo = evento antigo ou sem o dado; o custo é estimado por tokens.';

-- Mesma view, com o custo real na frente da estimativa. As colunas novas vão
-- no fim (exigência do create or replace view).
create or replace view public.vw_custo_eventos
with (security_invoker = true)
as
with medias as (
  select
    custo_eventos.tipo,
    avg(custo_eventos.tokens_entrada) filter (where custo_eventos.tokens_entrada > 0) as ent,
    avg(custo_eventos.tokens_saida) filter (where custo_eventos.tokens_saida > 0) as sai
  from public.custo_eventos
  group by custo_eventos.tipo
), base as (
  select
    e.id,
    e.conta_id,
    e.perfil_id,
    e.agente,
    e.tipo,
    e.modelo,
    e.itens,
    e.criado_em,
    coalesce(nullif(e.tokens_entrada, 0), round(m.ent)::integer, 0) as tokens_entrada,
    coalesce(nullif(e.tokens_saida, 0), round(m.sai)::integer, 0) as tokens_saida,
    (e.tipo <> 'scraping' and e.tokens_entrada = 0 and e.tokens_saida = 0) as estimado,
    e.custo_real_centavos
  from public.custo_eventos e
  left join medias m on m.tipo = e.tipo
)
select
  b.id,
  b.conta_id,
  b.perfil_id,
  b.agente,
  b.tipo,
  b.modelo,
  b.itens,
  b.criado_em,
  b.tokens_entrada,
  b.tokens_saida,
  b.estimado,
  date_trunc('month', b.criado_em)::date as ciclo,
  case
    when b.custo_real_centavos is not null then b.custo_real_centavos
    when b.tipo = 'scraping' then coalesce(p.custo_execucao_centavos, 0)
    else coalesce(p.custo_entrada_mi_centavos, 0) * b.tokens_entrada / 1000000.0
      + coalesce(p.custo_saida_mi_centavos, 0) * b.tokens_saida / 1000000.0
  end as custo_centavos,
  b.custo_real_centavos,
  (b.custo_real_centavos is not null) as custo_real
from base b
left join public.custo_precos p on p.chave = b.modelo;
