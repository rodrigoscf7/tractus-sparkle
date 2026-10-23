-- Gasto da conta de anúncios do Meta, lido pela API de Marketing
-- (src/lib/meta-ads.server.ts) para a aba Campanhas do admin.
--
-- Uma linha por anúncio por dia. A ligação com o funil é pelo nome: a
-- campanha chega em utm_campaign e o anúncio em utm_content, pelos parâmetros
-- de URL colados nos anúncios. O Meta revisa números dos últimos dias, então a
-- sincronização regrava o período inteiro.
create table if not exists public.meta_anuncios_diario (
  dia date not null,
  anuncio_id text not null,
  anuncio text,
  conjunto text,
  campanha_id text,
  campanha text,
  gasto_centavos integer not null default 0,
  impressoes integer not null default 0,
  cliques_link integer not null default 0,
  atualizado_em timestamptz not null default now(),
  primary key (dia, anuncio_id)
);

create index if not exists meta_anuncios_diario_dia_idx on public.meta_anuncios_diario (dia);

-- Cada leitura da API: o painel só relê se a última tiver mais de uma hora.
create table if not exists public.meta_ads_sincronizacoes (
  id bigint generated always as identity primary key,
  desde date not null,
  ate date not null,
  linhas integer not null default 0,
  erro text,
  criado_em timestamptz not null default now()
);

grant all on public.meta_anuncios_diario to service_role;
grant all on public.meta_ads_sincronizacoes to service_role;
alter table public.meta_anuncios_diario enable row level security;
alter table public.meta_ads_sincronizacoes enable row level security;
