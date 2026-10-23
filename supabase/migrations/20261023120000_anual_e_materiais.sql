-- =========================================================
-- Plano anual (upsell) e materiais avulsos (order bumps), pela Hubla.
--
-- O anual é outra oferta do mesmo produto: o plano continua "starter", com os
-- mesmos limites por mês; muda só o ciclo de cobrança. Na Hubla ele vira uma
-- assinatura separada da mensal, então quem aceita o upsell fica com duas até
-- a equipe cancelar a mensal no painel (o webhook avisa por e-mail).
--
-- Os materiais são pagamento único e não dependem da assinatura: quem cancela
-- o plano continua com eles. O conteúdo fica no código do servidor
-- (src/lib/materiais.server.ts) e só sai por server function, para quem tem
-- o material liberado.
-- =========================================================

-- ============ 1) Ciclo de cobrança ============
alter table public.assinaturas
  add column if not exists ciclo_meses integer not null default 1;

alter table public.planos
  add column if not exists hubla_oferta_anual_id text,
  -- Preço de tabela do anual: o total da fatura inclui juros do parcelamento.
  add column if not exists preco_anual_centavos integer;

-- Oferta criada em 23/10/2026: R$ 247 por ano, até 12x no cartão ou Pix.
update public.planos
set hubla_oferta_anual_id = 'mqQdWDnY78VdZtfEd4Rc',
    preco_anual_centavos = 24700
where codigo = 'starter';

-- ============ 2) Materiais à venda ============
create table if not exists public.materiais (
  codigo text primary key,
  nome text not null,
  hubla_produto_id text,
  hubla_oferta_id text,
  preco_centavos integer,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

insert into public.materiais (codigo, nome, hubla_produto_id, hubla_oferta_id, preco_centavos)
values
  ('ganchos_previdenciario', 'Banco de Ganchos · Direito Previdenciário',
   '3wK3ILMCPZg7q4E9wE5u', '3Ub1maVir105pxXs4juW', 2700),
  ('gravando_celular', 'Gravando com o Celular',
   '00f6piXkSHMP7R3CHLYM', 'nTQsTXG4Wrb9vR0wm4I6', 1700)
on conflict (codigo) do update
set nome = excluded.nome,
    hubla_produto_id = excluded.hubla_produto_id,
    hubla_oferta_id = excluded.hubla_oferta_id,
    preco_centavos = excluded.preco_centavos;

-- ============ 3) Materiais de cada conta ============
create table if not exists public.conta_materiais (
  conta_id uuid not null references public.contas(id) on delete cascade,
  material_codigo text not null references public.materiais(codigo),
  -- hubla (order bump) ou manual (liberado pela equipe).
  origem text not null default 'hubla',
  hubla_fatura_id text,
  liberado_em timestamptz not null default now(),
  -- Reembolso ou chargeback da fatura do material.
  revogado_em timestamptz,
  primary key (conta_id, material_codigo)
);

-- Leitura e escrita só por service role (server functions e webhook).
grant all on public.materiais to service_role;
grant all on public.conta_materiais to service_role;
alter table public.materiais enable row level security;
alter table public.conta_materiais enable row level security;
