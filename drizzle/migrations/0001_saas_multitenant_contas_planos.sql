-- =========================================================
-- Fundação SaaS: contas (workspaces), membros, planos e uso
-- =========================================================

CREATE TABLE public.planos (
  codigo text PRIMARY KEY,
  nome text NOT NULL,
  preco_mensal_centavos integer NOT NULL DEFAULT 0,
  limite_perfis integer NOT NULL DEFAULT 1,
  limite_referencias integer NOT NULL DEFAULT 3,
  limite_curadorias_mes integer NOT NULL DEFAULT 30,
  limite_roteiros_mes integer NOT NULL DEFAULT 8,
  limite_carrosseis_mes integer NOT NULL DEFAULT 4,
  ordem integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.planos TO authenticated;
GRANT ALL ON public.planos TO service_role;
ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "planos legiveis por autenticados" ON public.planos
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "admins gerenciam planos" ON public.planos
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

INSERT INTO public.planos (codigo, nome, preco_mensal_centavos, limite_perfis, limite_referencias, limite_curadorias_mes, limite_roteiros_mes, limite_carrosseis_mes, ordem) VALUES
  ('free',    'Gratuito', 0,     1,  3,  30,  8,   4,  1),
  ('starter', 'Starter',  9700,  3,  12, 150, 40,  25, 2),
  ('pro',     'Pro',      29700, 10, 40, 600, 160, 120, 3);

CREATE TABLE public.contas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  plano_codigo text NOT NULL DEFAULT 'free' REFERENCES public.planos(codigo),
  status text NOT NULL DEFAULT 'ativa',
  ciclo_inicio date NOT NULL DEFAULT date_trunc('month', now())::date,
  criado_em timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.contas TO authenticated;
GRANT ALL ON public.contas TO service_role;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.conta_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  papel text NOT NULL DEFAULT 'member',
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, user_id)
);
GRANT SELECT, INSERT ON public.conta_membros TO authenticated;
GRANT ALL ON public.conta_membros TO service_role;
ALTER TABLE public.conta_membros ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.uso_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_id uuid NOT NULL REFERENCES public.contas(id) ON DELETE CASCADE,
  ciclo date NOT NULL,
  tipo text NOT NULL,
  quantidade integer NOT NULL DEFAULT 0,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_id, ciclo, tipo)
);
GRANT SELECT ON public.uso_mensal TO authenticated;
GRANT ALL ON public.uso_mensal TO service_role;
ALTER TABLE public.uso_mensal ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------
-- Funções de contexto (security definer, sem recursão RLS)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.contas_do_usuario(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conta_id FROM public.conta_membros WHERE user_id = _user_id
$$;

CREATE OR REPLACE FUNCTION public.is_conta_membro(_conta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conta_membros
    WHERE conta_id = _conta_id AND user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_conta_owner(_conta_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conta_membros
    WHERE conta_id = _conta_id AND user_id = auth.uid() AND papel = 'owner'
  )
$$;

CREATE OR REPLACE FUNCTION public.minha_conta()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT conta_id FROM public.conta_membros
  WHERE user_id = auth.uid()
  ORDER BY criado_em
  LIMIT 1
$$;

REVOKE EXECUTE ON FUNCTION public.contas_do_usuario(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.contas_do_usuario(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_conta_membro(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_conta_membro(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.is_conta_owner(uuid) FROM anon;
GRANT EXECUTE ON FUNCTION public.is_conta_owner(uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.minha_conta() FROM anon;
GRANT EXECUTE ON FUNCTION public.minha_conta() TO authenticated, service_role;

-- Políticas de contas / membros / uso
CREATE POLICY "membros leem sua conta" ON public.contas
  FOR SELECT TO authenticated
  USING (public.is_conta_membro(id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "usuario cria conta" ON public.contas
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "owner ou admin atualiza conta" ON public.contas
  FOR UPDATE TO authenticated
  USING (public.is_conta_owner(id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_owner(id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "membros leem membros da conta" ON public.conta_membros
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "entrar na propria conta" ON public.conta_membros
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() OR public.is_conta_owner(conta_id) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "membros leem uso da conta" ON public.uso_mensal
  FOR SELECT TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------
-- conta_id nas tabelas de conteúdo
-- ---------------------------------------------------------
ALTER TABLE public.perfis ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;
ALTER TABLE public.perfis_referencia ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;
ALTER TABLE public.conteudos_curados ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;
ALTER TABLE public.pautas_geradas ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;
ALTER TABLE public.roteiros ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;
ALTER TABLE public.artes ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;
ALTER TABLE public.carrosseis ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;
ALTER TABLE public.publicacoes ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;
ALTER TABLE public.decisoes_aprovacao ADD COLUMN conta_id uuid REFERENCES public.contas(id) ON DELETE CASCADE;

-- Conta inicial com os dados existentes
DO $$
DECLARE
  v_conta uuid;
BEGIN
  INSERT INTO public.contas (nome, plano_codigo, status)
  VALUES ('Tractus', 'pro', 'ativa')
  RETURNING id INTO v_conta;

  INSERT INTO public.conta_membros (conta_id, user_id, papel)
  SELECT v_conta, ur.user_id, CASE WHEN ur.role = 'admin' THEN 'owner' ELSE 'member' END
  FROM public.user_roles ur
  ON CONFLICT (conta_id, user_id) DO NOTHING;

  INSERT INTO public.conta_membros (conta_id, user_id, papel)
  SELECT v_conta, u.id, 'member' FROM auth.users u
  ON CONFLICT (conta_id, user_id) DO NOTHING;

  UPDATE public.perfis SET conta_id = v_conta WHERE conta_id IS NULL;
  UPDATE public.perfis_referencia SET conta_id = v_conta WHERE conta_id IS NULL;
  UPDATE public.conteudos_curados SET conta_id = v_conta WHERE conta_id IS NULL;
  UPDATE public.pautas_geradas SET conta_id = v_conta WHERE conta_id IS NULL;
  UPDATE public.roteiros SET conta_id = v_conta WHERE conta_id IS NULL;
  UPDATE public.artes SET conta_id = v_conta WHERE conta_id IS NULL;
  UPDATE public.carrosseis SET conta_id = v_conta WHERE conta_id IS NULL;
  UPDATE public.publicacoes SET conta_id = v_conta WHERE conta_id IS NULL;
  UPDATE public.decisoes_aprovacao SET conta_id = v_conta WHERE conta_id IS NULL;
END $$;

CREATE INDEX idx_perfis_conta ON public.perfis(conta_id);
CREATE INDEX idx_perfis_referencia_conta ON public.perfis_referencia(conta_id);
CREATE INDEX idx_conteudos_curados_conta ON public.conteudos_curados(conta_id);
CREATE INDEX idx_pautas_conta ON public.pautas_geradas(conta_id);
CREATE INDEX idx_roteiros_conta ON public.roteiros(conta_id);
CREATE INDEX idx_artes_conta ON public.artes(conta_id);
CREATE INDEX idx_carrosseis_conta ON public.carrosseis(conta_id);
CREATE INDEX idx_publicacoes_conta ON public.publicacoes(conta_id);
CREATE INDEX idx_decisoes_conta ON public.decisoes_aprovacao(conta_id);

-- ---------------------------------------------------------
-- RLS por conta nas tabelas de conteúdo
-- ---------------------------------------------------------
DROP POLICY IF EXISTS "admins manage perfis" ON public.perfis;
DROP POLICY IF EXISTS "admins manage perfis_referencia" ON public.perfis_referencia;
DROP POLICY IF EXISTS "admins manage conteudos_curados" ON public.conteudos_curados;
DROP POLICY IF EXISTS "admins manage pautas_geradas" ON public.pautas_geradas;
DROP POLICY IF EXISTS "admins manage roteiros" ON public.roteiros;
DROP POLICY IF EXISTS "admins manage artes" ON public.artes;
DROP POLICY IF EXISTS "admins manage carrosseis" ON public.carrosseis;
DROP POLICY IF EXISTS "admins manage publicacoes" ON public.publicacoes;
DROP POLICY IF EXISTS "admins manage decisoes_aprovacao" ON public.decisoes_aprovacao;

CREATE POLICY "conta gerencia perfis" ON public.perfis FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conta gerencia perfis_referencia" ON public.perfis_referencia FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conta gerencia conteudos_curados" ON public.conteudos_curados FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conta gerencia pautas_geradas" ON public.pautas_geradas FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conta gerencia roteiros" ON public.roteiros FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conta gerencia artes" ON public.artes FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conta gerencia carrosseis" ON public.carrosseis FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conta gerencia publicacoes" ON public.publicacoes FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "conta gerencia decisoes_aprovacao" ON public.decisoes_aprovacao FOR ALL TO authenticated
  USING (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_conta_membro(conta_id) OR public.has_role(auth.uid(), 'admin'));

-- ---------------------------------------------------------
-- Limites de geração (checagem no servidor)
-- ---------------------------------------------------------
CREATE OR REPLACE FUNCTION public.limite_disponivel(_conta_id uuid, _tipo text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_plano public.planos;
  v_conta public.contas;
  v_ciclo date;
  v_usado integer;
  v_limite integer;
BEGIN
  SELECT * INTO v_conta FROM public.contas WHERE id = _conta_id;
  IF v_conta IS NULL THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'conta_inexistente');
  END IF;
  IF v_conta.status <> 'ativa' THEN
    RETURN jsonb_build_object('permitido', false, 'motivo', 'conta_suspensa');
  END IF;

  SELECT * INTO v_plano FROM public.planos WHERE codigo = v_conta.plano_codigo;
  v_ciclo := date_trunc('month', now())::date;

  v_limite := CASE _tipo
    WHEN 'curadoria' THEN v_plano.limite_curadorias_mes
    WHEN 'roteiro' THEN v_plano.limite_roteiros_mes
    WHEN 'carrossel' THEN v_plano.limite_carrosseis_mes
    ELSE NULL
  END;

  IF v_limite IS NULL THEN
    RETURN jsonb_build_object('permitido', true, 'motivo', 'sem_limite');
  END IF;

  SELECT COALESCE(quantidade, 0) INTO v_usado
  FROM public.uso_mensal WHERE conta_id = _conta_id AND ciclo = v_ciclo AND tipo = _tipo;
  v_usado := COALESCE(v_usado, 0);

  RETURN jsonb_build_object(
    'permitido', v_usado < v_limite,
    'motivo', CASE WHEN v_usado < v_limite THEN 'ok' ELSE 'limite_atingido' END,
    'tipo', _tipo,
    'usado', v_usado,
    'limite', v_limite,
    'ciclo', v_ciclo,
    'reset_em', (v_ciclo + interval '1 month')::date,
    'plano', v_plano.codigo
  );
END $$;

CREATE OR REPLACE FUNCTION public.registrar_uso(_conta_id uuid, _tipo text, _qtd integer DEFAULT 1)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.uso_mensal (conta_id, ciclo, tipo, quantidade, atualizado_em)
  VALUES (_conta_id, date_trunc('month', now())::date, _tipo, _qtd, now())
  ON CONFLICT (conta_id, ciclo, tipo)
  DO UPDATE SET quantidade = public.uso_mensal.quantidade + _qtd, atualizado_em = now();
$$;

REVOKE EXECUTE ON FUNCTION public.limite_disponivel(uuid, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.limite_disponivel(uuid, text) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.registrar_uso(uuid, text, integer) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.registrar_uso(uuid, text, integer) TO service_role;

-- Contabiliza uso automaticamente
CREATE OR REPLACE FUNCTION public.tg_uso_curadoria()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.conta_id IS NOT NULL THEN PERFORM public.registrar_uso(NEW.conta_id, 'curadoria', 1); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_uso_roteiro()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.conta_id IS NOT NULL THEN PERFORM public.registrar_uso(NEW.conta_id, 'roteiro', 1); END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_uso_carrossel()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.conta_id IS NOT NULL THEN PERFORM public.registrar_uso(NEW.conta_id, 'carrossel', 1); END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_uso_curadoria AFTER INSERT ON public.conteudos_curados
  FOR EACH ROW EXECUTE FUNCTION public.tg_uso_curadoria();
CREATE TRIGGER trg_uso_roteiro AFTER INSERT ON public.roteiros
  FOR EACH ROW EXECUTE FUNCTION public.tg_uso_roteiro();
CREATE TRIGGER trg_uso_carrossel AFTER INSERT ON public.carrosseis
  FOR EACH ROW EXECUTE FUNCTION public.tg_uso_carrossel();

-- Herança de conta_id ao longo do pipeline
CREATE OR REPLACE FUNCTION public.tg_herdar_conta_de_perfil()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.conta_id IS NULL AND NEW.perfil_id IS NOT NULL THEN
    SELECT conta_id INTO NEW.conta_id FROM public.perfis WHERE id = NEW.perfil_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_herdar_conta_de_pauta()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.conta_id IS NULL AND NEW.pauta_id IS NOT NULL THEN
    SELECT conta_id INTO NEW.conta_id FROM public.pautas_geradas WHERE id = NEW.pauta_id;
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION public.tg_herdar_conta_de_referencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.conta_id IS NULL AND NEW.perfil_referencia_id IS NOT NULL THEN
    SELECT conta_id INTO NEW.conta_id FROM public.perfis_referencia WHERE id = NEW.perfil_referencia_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_conta_pautas BEFORE INSERT ON public.pautas_geradas
  FOR EACH ROW EXECUTE FUNCTION public.tg_herdar_conta_de_perfil();
CREATE TRIGGER trg_conta_publicacoes BEFORE INSERT ON public.publicacoes
  FOR EACH ROW EXECUTE FUNCTION public.tg_herdar_conta_de_perfil();
CREATE TRIGGER trg_conta_decisoes BEFORE INSERT ON public.decisoes_aprovacao
  FOR EACH ROW EXECUTE FUNCTION public.tg_herdar_conta_de_perfil();
CREATE TRIGGER trg_conta_carrosseis BEFORE INSERT ON public.carrosseis
  FOR EACH ROW EXECUTE FUNCTION public.tg_herdar_conta_de_pauta();
CREATE TRIGGER trg_conta_roteiros BEFORE INSERT ON public.roteiros
  FOR EACH ROW EXECUTE FUNCTION public.tg_herdar_conta_de_pauta();
CREATE TRIGGER trg_conta_artes BEFORE INSERT ON public.artes
  FOR EACH ROW EXECUTE FUNCTION public.tg_herdar_conta_de_pauta();
CREATE TRIGGER trg_conta_curados BEFORE INSERT ON public.conteudos_curados
  FOR EACH ROW EXECUTE FUNCTION public.tg_herdar_conta_de_referencia();