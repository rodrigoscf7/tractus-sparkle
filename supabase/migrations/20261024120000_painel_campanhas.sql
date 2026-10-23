-- Painel de campanhas (aba Campanhas do admin, src/lib/campanhas.functions.ts).

-- Primeiro clique no botão de compra do relatório. O InitiateCheckout do
-- Pixel fica no Meta; este é o que o painel enxerga para medir quem chegou ao
-- checkout e não pagou.
alter table public.oferta_leads
  add column if not exists checkout_clicado_em timestamptz;

-- Investimento em anúncio, lançado à mão pela equipe (por dia e campanha), até
-- a leitura automática da conta de anúncios existir. A campanha é o mesmo
-- texto que chega em utm_campaign.
create table if not exists public.campanha_investimentos (
  id uuid primary key default gen_random_uuid(),
  dia date not null,
  campanha text not null,
  valor_centavos integer not null check (valor_centavos >= 0),
  criado_por uuid references auth.users(id) on delete set null,
  criado_em timestamptz not null default now(),
  unique (dia, campanha)
);

create index if not exists campanha_investimentos_dia_idx on public.campanha_investimentos (dia);

-- Só service role: o painel lê e grava por server function que confere o admin.
grant all on public.campanha_investimentos to service_role;
alter table public.campanha_investimentos enable row level security;
