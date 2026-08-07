-- 1. Roles infrastructure
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('admin', 'member');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  role public.app_role NOT NULL,
  criado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users can read own roles" ON public.user_roles;
CREATE POLICY "users can read own roles"
ON public.user_roles FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;

-- 2. Existing users keep their current access
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role FROM auth.users
ON CONFLICT (user_id, role) DO NOTHING;

-- 3. Replace blanket policies with admin-scoped ones
DROP POLICY IF EXISTS "auth users full access agentes_status" ON public.agentes_status;
CREATE POLICY "admins manage agentes_status" ON public.agentes_status FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access artes" ON public.artes;
CREATE POLICY "admins manage artes" ON public.artes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access carrosseis" ON public.carrosseis;
CREATE POLICY "admins manage carrosseis" ON public.carrosseis FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access conteudos_curados" ON public.conteudos_curados;
CREATE POLICY "admins manage conteudos_curados" ON public.conteudos_curados FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access decisoes_aprovacao" ON public.decisoes_aprovacao;
CREATE POLICY "admins manage decisoes_aprovacao" ON public.decisoes_aprovacao FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access pautas_geradas" ON public.pautas_geradas;
CREATE POLICY "admins manage pautas_geradas" ON public.pautas_geradas FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access perfis" ON public.perfis;
CREATE POLICY "admins manage perfis" ON public.perfis FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access perfis_referencia" ON public.perfis_referencia;
CREATE POLICY "admins manage perfis_referencia" ON public.perfis_referencia FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access publicacoes" ON public.publicacoes;
CREATE POLICY "admins manage publicacoes" ON public.publicacoes FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

DROP POLICY IF EXISTS "auth users full access roteiros" ON public.roteiros;
CREATE POLICY "admins manage roteiros" ON public.roteiros FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 4. Storage: perfil-fotos restricted to team admins
DROP POLICY IF EXISTS "auth read perfil fotos" ON storage.objects;
DROP POLICY IF EXISTS "auth insert perfil fotos" ON storage.objects;
DROP POLICY IF EXISTS "auth update perfil fotos" ON storage.objects;
DROP POLICY IF EXISTS "auth delete perfil fotos" ON storage.objects;

CREATE POLICY "admins read perfil fotos" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'perfil-fotos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins insert perfil fotos" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'perfil-fotos' AND public.has_role(auth.uid(), 'admin') AND owner = auth.uid());

CREATE POLICY "admins update perfil fotos" ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'perfil-fotos' AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (bucket_id = 'perfil-fotos' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins delete perfil fotos" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'perfil-fotos' AND public.has_role(auth.uid(), 'admin'));

-- 5. Revoke direct EXECUTE on internal SECURITY DEFINER functions
REVOKE ALL ON FUNCTION public.promote_next_pauta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revisar_next_pauta_pronta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_ideador() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_producao() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_revisor_via_arte() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.trigger_revisor_via_roteiro() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC, anon, authenticated;