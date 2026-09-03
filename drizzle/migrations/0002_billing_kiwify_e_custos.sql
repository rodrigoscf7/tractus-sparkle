-- ============ 1) Campos comerciais nos planos ============
ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL',
  ADD COLUMN IF NOT EXISTS preco_anual_centavos integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS trial_dias integer NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS checkout_url text,
  ADD COLUMN IF NOT EXISTS kiwify_produto_id text,
  ADD COLUMN IF NOT EXISTS kiwify_oferta_id text,
  ADD COLUMN IF NOT EXISTS descricao text,
  ADD COLUMN IF NOT EXISTS beneficios jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS publico boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS recomendado boolean NOT NULL DEFAULT false;

-- ============ 2) Assinaturas ============
CREATE TABLE IF NOT EXISTS public.assinaturas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL UNIQUE REFERENCES public.contas(id) ON DELETE CASCADE,
  plano_codigo text NOT NULL REFERENCES public.planos(codigo),
  situacao text NOT NULL DEFAULT 'trial',
  origem text NOT NULL DEFAULT 'kiwify',
  iniciada_em timestamptz NOT NULL DEFAULT now(),
  trial_fim timestamptz,
  proxima_renovacao timestamptz,
  cancelada_em timestamptz,
  valor_centavos integer NOT NULL DEFAULT 0,
  comprador_email text,
  kiwify_assinatura_id text,
  kiwify_pedido_id text,
  observacao text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.assinaturas TO authenticated;
GRANT ALL ON public.assinaturas TO service_role;
ALTER TABLE public.assinaturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "membros leem assinatura da conta" ON public.assinaturas
  FOR SELECT TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_assinaturas_atualizado_em
  BEFORE UPDATE ON public.assinaturas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ 3) Eventos recebidos da Kiwify ============
CREATE TABLE IF NOT EXISTS public.kiwify_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  evento text NOT NULL,
  pedido_id text,
  assinatura_externa_id text,
  comprador_email text,
  conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
  plano_codigo text,
  valor_centavos integer,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  processado boolean NOT NULL DEFAULT false,
  erro text,
  criado_em timestamptz NOT NULL DEFAULT now(),
  processado_em timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS kiwify_eventos_idempotencia
  ON public.kiwify_eventos (pedido_id, evento) WHERE pedido_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS kiwify_eventos_conta_idx ON public.kiwify_eventos (conta_id, criado_em DESC);

GRANT ALL ON public.kiwify_eventos TO service_role;
ALTER TABLE public.kiwify_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin le eventos kiwify" ON public.kiwify_eventos
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
GRANT SELECT ON public.kiwify_eventos TO authenticated;

-- ============ 4) Preços de insumos ============
CREATE TABLE IF NOT EXISTS public.custo_precos (
  chave text PRIMARY KEY,
  rotulo text NOT NULL,
  tipo text NOT NULL DEFAULT 'modelo',
  custo_entrada_mi_centavos numeric(14,4) NOT NULL DEFAULT 0,
  custo_saida_mi_centavos numeric(14,4) NOT NULL DEFAULT 0,
  custo_execucao_centavos numeric(14,4) NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.custo_precos TO authenticated;
GRANT ALL ON public.custo_precos TO service_role;
ALTER TABLE public.custo_precos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "autenticados leem precos" ON public.custo_precos
  FOR SELECT TO authenticated USING (true);

-- ============ 5) Eventos de custo ============
CREATE TABLE IF NOT EXISTS public.custo_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
  perfil_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  agente text NOT NULL,
  tipo text NOT NULL,
  modelo text,
  tokens_entrada integer NOT NULL DEFAULT 0,
  tokens_saida integer NOT NULL DEFAULT 0,
  itens integer NOT NULL DEFAULT 0,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS custo_eventos_conta_idx ON public.custo_eventos (conta_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS custo_eventos_tipo_idx ON public.custo_eventos (tipo);

GRANT SELECT ON public.custo_eventos TO authenticated;
GRANT ALL ON public.custo_eventos TO service_role;
ALTER TABLE public.custo_eventos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conta le seus custos" ON public.custo_eventos
  FOR SELECT TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'::app_role));

-- ============ 6) Auditoria de ações administrativas ============
CREATE TABLE IF NOT EXISTS public.admin_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ator_user_id uuid,
  conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
  acao text NOT NULL,
  detalhes jsonb NOT NULL DEFAULT '{}'::jsonb,
  criado_em timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.admin_acoes TO authenticated;
GRANT ALL ON public.admin_acoes TO service_role;
ALTER TABLE public.admin_acoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin le auditoria" ON public.admin_acoes
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- ============ 7) Custo calculado, com fallback estimado ============
CREATE OR REPLACE VIEW public.vw_custo_eventos WITH (security_invoker = true) AS
WITH medias AS (
  SELECT tipo,
         AVG(tokens_entrada) FILTER (WHERE tokens_entrada > 0) AS ent,
         AVG(tokens_saida) FILTER (WHERE tokens_saida > 0) AS sai
  FROM public.custo_eventos
  GROUP BY tipo
), base AS (
  SELECT e.id, e.conta_id, e.perfil_id, e.agente, e.tipo, e.modelo, e.itens, e.criado_em,
         COALESCE(NULLIF(e.tokens_entrada, 0), ROUND(m.ent)::int, 0) AS tokens_entrada,
         COALESCE(NULLIF(e.tokens_saida, 0), ROUND(m.sai)::int, 0) AS tokens_saida,
         (e.tipo <> 'scraping' AND e.tokens_entrada = 0 AND e.tokens_saida = 0) AS estimado
  FROM public.custo_eventos e
  LEFT JOIN medias m ON m.tipo = e.tipo
)
SELECT b.id, b.conta_id, b.perfil_id, b.agente, b.tipo, b.modelo, b.itens,
       b.criado_em, b.tokens_entrada, b.tokens_saida, b.estimado,
       date_trunc('month', b.criado_em)::date AS ciclo,
       CASE
         WHEN b.tipo = 'scraping' THEN COALESCE(p.custo_execucao_centavos, 0)
         ELSE COALESCE(p.custo_entrada_mi_centavos, 0) * b.tokens_entrada / 1000000.0
            + COALESCE(p.custo_saida_mi_centavos, 0) * b.tokens_saida / 1000000.0
       END AS custo_centavos
FROM base b
LEFT JOIN public.custo_precos p ON p.chave = b.modelo;

GRANT SELECT ON public.vw_custo_eventos TO authenticated;
GRANT SELECT ON public.vw_custo_eventos TO service_role;

-- ============ 8) Economia por conta e por mês ============
CREATE OR REPLACE VIEW public.vw_conta_economia_mensal WITH (security_invoker = true) AS
SELECT conta_id,
       ciclo,
       SUM(custo_centavos) FILTER (WHERE tipo <> 'scraping') AS custo_ia_centavos,
       SUM(custo_centavos) FILTER (WHERE tipo = 'scraping') AS custo_scraping_centavos,
       SUM(custo_centavos) AS custo_total_centavos,
       COUNT(*) FILTER (WHERE tipo <> 'scraping') AS geracoes,
       COUNT(*) FILTER (WHERE estimado) AS geracoes_estimadas,
       CASE WHEN COUNT(*) FILTER (WHERE tipo <> 'scraping') > 0
            THEN SUM(custo_centavos) / COUNT(*) FILTER (WHERE tipo <> 'scraping')
            ELSE 0 END AS custo_medio_geracao_centavos
FROM public.vw_custo_eventos
GROUP BY conta_id, ciclo;

GRANT SELECT ON public.vw_conta_economia_mensal TO authenticated;
GRANT SELECT ON public.vw_conta_economia_mensal TO service_role;

CREATE OR REPLACE VIEW public.vw_plataforma_mensal WITH (security_invoker = true) AS
SELECT ciclo,
       COUNT(DISTINCT conta_id) AS contas_ativas,
       SUM(custo_ia_centavos) AS custo_ia_centavos,
       SUM(custo_scraping_centavos) AS custo_scraping_centavos,
       SUM(custo_total_centavos) AS custo_total_centavos,
       SUM(geracoes) AS geracoes
FROM public.vw_conta_economia_mensal
GROUP BY ciclo;

GRANT SELECT ON public.vw_plataforma_mensal TO authenticated;
GRANT SELECT ON public.vw_plataforma_mensal TO service_role;

-- ============ 9) Custo médio por tipo de geração (para projeção de plano) ============
CREATE OR REPLACE VIEW public.vw_custo_medio_tipo WITH (security_invoker = true) AS
SELECT tipo,
       COUNT(*) AS eventos,
       AVG(custo_centavos) AS custo_medio_centavos,
       MAX(custo_centavos) AS custo_max_centavos
FROM public.vw_custo_eventos
GROUP BY tipo;

GRANT SELECT ON public.vw_custo_medio_tipo TO authenticated;
GRANT SELECT ON public.vw_custo_medio_tipo TO service_role;

-- ============ 10) Backfill: assinatura para contas existentes ============
INSERT INTO public.assinaturas (conta_id, plano_codigo, situacao, origem, valor_centavos, proxima_renovacao)
SELECT c.id, c.plano_codigo, 'ativa', 'manual', COALESCE(p.preco_mensal_centavos, 0),
       (date_trunc('month', now()) + interval '1 month')
FROM public.contas c
LEFT JOIN public.planos p ON p.codigo = c.plano_codigo
ON CONFLICT (conta_id) DO NOTHING;