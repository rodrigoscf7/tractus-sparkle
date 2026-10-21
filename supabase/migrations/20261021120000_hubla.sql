-- =========================================================
-- Cobrança pela Hubla no lugar da Kiwify.
--
-- Nenhuma venda passou pela Kiwify: kiwify_eventos e as colunas kiwify_* ficam
-- como histórico, sem uso no código. O webhook novo é
-- /api/public/webhooks/hubla (src/lib/hubla.server.ts).
-- =========================================================

-- ============ 1) Avisos recebidos da Hubla ============
create table if not exists public.hubla_eventos (
  id uuid primary key default gen_random_uuid(),
  evento text not null,
  -- Header x-hubla-idempotency: o mesmo aviso reenviado cai na mesma linha.
  idempotencia text,
  fatura_id text,
  assinatura_externa_id text,
  comprador_email text,
  conta_id uuid references public.contas(id) on delete set null,
  lead_id uuid,
  plano_codigo text,
  valor_centavos integer,
  payload jsonb not null default '{}'::jsonb,
  processado boolean not null default false,
  erro text,
  criado_em timestamptz not null default now(),
  processado_em timestamptz
);

create unique index if not exists hubla_eventos_idempotencia on public.hubla_eventos (idempotencia);
create index if not exists hubla_eventos_conta_idx on public.hubla_eventos (conta_id, criado_em desc);
create index if not exists hubla_eventos_criado_idx on public.hubla_eventos (criado_em desc);

grant all on public.hubla_eventos to service_role;
alter table public.hubla_eventos enable row level security;

create policy "admin le eventos hubla" on public.hubla_eventos
  for select to authenticated
  using (public.has_role(auth.uid(), 'admin'::app_role));
grant select on public.hubla_eventos to authenticated;

-- ============ 2) Identificadores da Hubla ============
alter table public.assinaturas
  add column if not exists hubla_assinatura_id text,
  add column if not exists hubla_fatura_id text;

create index if not exists assinaturas_hubla_assinatura_idx on public.assinaturas (hubla_assinatura_id);

alter table public.planos
  add column if not exists hubla_produto_id text,
  add column if not exists hubla_oferta_id text;

-- ============ 3) O plano à venda: prevIA VIRAL ============
-- Produto e oferta criados e publicados na Hubla em 21/10/2026. O plano passa
-- a se chamar como o produto do checkout; o código interno segue "starter".
update public.planos
set nome = 'prevIA VIRAL',
    hubla_produto_id = 'pM6iQrCIHJtjQdCTWuX5',
    hubla_oferta_id = '55IA4BiomTB6SfgpXleS',
    checkout_url = 'https://pay.hub.la/55IA4BiomTB6SfgpXleS',
    preco_mensal_centavos = 4790,
    preco_de_centavos = 19700
where codigo = 'starter';
