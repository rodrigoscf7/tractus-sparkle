-- =========================================================
-- Onboarding guiado + manual de marca (DNA)
-- Respostas do wizard, relatorio gerado por IA e catalogo de
-- referencias sugeridas por area de atuacao.
-- =========================================================

-- ---------------------------------------------------------
-- Respostas do wizard (uma por conta)
-- Q1..Q11 alimentam o perfil e os agentes.
-- Q12..Q15 sao aquisicao/qualificacao e ficam somente aqui.
-- ---------------------------------------------------------
CREATE TABLE public.onboarding_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  perfil_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,
  passo_atual integer NOT NULL DEFAULT 1,
  concluido_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id)
);
GRANT SELECT, INSERT, UPDATE ON public.onboarding_respostas TO authenticated;
GRANT ALL ON public.onboarding_respostas TO service_role;
ALTER TABLE public.onboarding_respostas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conta gerencia onboarding" ON public.onboarding_respostas FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_onboarding_conta ON public.onboarding_respostas(conta_id);
CREATE INDEX idx_onboarding_concluido ON public.onboarding_respostas(concluido_em);

-- ---------------------------------------------------------
-- Manual de marca / DNA gerado pelo dna-agent
-- Tabela separada das respostas para permitir regerar sem
-- perder o que o usuario respondeu.
-- ---------------------------------------------------------
CREATE TABLE public.dna_relatorios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  perfil_id uuid REFERENCES public.perfis(id) ON DELETE CASCADE,
  conteudo jsonb NOT NULL,
  modelo text,
  versao integer NOT NULL DEFAULT 1,
  gerado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.dna_relatorios TO authenticated;
GRANT ALL ON public.dna_relatorios TO service_role;
ALTER TABLE public.dna_relatorios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "conta le seu dna" ON public.dna_relatorios FOR SELECT TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_dna_conta ON public.dna_relatorios(conta_id);
CREATE INDEX idx_dna_perfil ON public.dna_relatorios(perfil_id);

-- ---------------------------------------------------------
-- Catalogo de referencias sugeridas por area de atuacao.
-- Catalogo global (nao pertence a nenhuma conta): usado no
-- passo 4 do onboarding para complementar os perfis que o
-- usuario informa, resolvendo o arranque a frio de quem nao
-- sabe quem acompanhar.
--
-- Seed intencionalmente vazio: os handles precisam ser
-- curados pela equipe (perfis reais e ativos no Instagram).
-- Com a tabela vazia o onboarding segue funcionando usando
-- apenas os perfis informados na pergunta 10.
-- ---------------------------------------------------------
CREATE TABLE public.referencias_sugeridas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  area_atuacao text NOT NULL,
  handle text NOT NULL,
  descricao text,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (area_atuacao, handle)
);
GRANT SELECT ON public.referencias_sugeridas TO authenticated;
GRANT ALL ON public.referencias_sugeridas TO service_role;
ALTER TABLE public.referencias_sugeridas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "referencias sugeridas legiveis por autenticados" ON public.referencias_sugeridas
  FOR SELECT TO authenticated USING (ativo);
CREATE POLICY "admins gerenciam referencias sugeridas" ON public.referencias_sugeridas
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_referencias_sugeridas_area ON public.referencias_sugeridas(area_atuacao, ordem);

-- ---------------------------------------------------------
-- Contas que ja estao em uso nao passam pelo wizard: marca
-- como concluido para nao prender quem ja opera.
--
-- So vale para contas que ja tem membro. Num projeto aplicado
-- do zero, a conta semeada pelas migrations nasce sem dono e
-- e adotada pelo primeiro cadastro (bootstrap_primeiro_admin).
-- Marca-la aqui faria esse primeiro usuario pular o onboarding.
-- ---------------------------------------------------------
INSERT INTO public.onboarding_respostas (conta_id, perfil_id, respostas, passo_atual, concluido_em)
SELECT
  c.id,
  (SELECT p.id FROM public.perfis p WHERE p.conta_id = c.id ORDER BY p.criado_em LIMIT 1),
  jsonb_build_object('origem', 'anterior_ao_onboarding'),
  5,
  now()
FROM public.contas c
WHERE EXISTS (SELECT 1 FROM public.conta_membros m WHERE m.conta_id = c.id)
ON CONFLICT (conta_id) DO NOTHING;
