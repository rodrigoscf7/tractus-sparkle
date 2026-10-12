-- =========================================================
-- Convites: link público que cria a conta com cortesia.
--
-- O cadastro público continua desligado no Auth. O convite é uma porta
-- controlada: só cria conta por um código ativo e dentro da validade (e, se
-- tiver, do limite de usos). Quem cria o usuário é o servidor, com a service
-- role; o navegador nunca fala com estas tabelas.
-- =========================================================

CREATE TABLE IF NOT EXISTS public.convites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Vai na URL (/convite/<codigo>): minúsculas, números e hífen.
  codigo text NOT NULL UNIQUE CHECK (codigo ~ '^[a-z0-9-]{3,40}$'),
  descricao text,
  plano_codigo text NOT NULL DEFAULT 'starter',
  dias_cortesia integer NOT NULL DEFAULT 30 CHECK (dias_cortesia BETWEEN 1 AND 365),
  -- NULL = sem limite de usos.
  usos_max integer CHECK (usos_max IS NULL OR usos_max > 0),
  usos integer NOT NULL DEFAULT 0,
  -- NULL = não expira.
  expira_em timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  criado_por uuid,
  criado_em timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.convites IS
  'Códigos do link /convite/<codigo>: cada resgate cria uma conta com cortesia.';

CREATE TABLE IF NOT EXISTS public.convite_resgates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  convite_id uuid NOT NULL REFERENCES public.convites(id) ON DELETE CASCADE,
  conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
  user_id uuid,
  nome text,
  email text NOT NULL,
  -- Só dígitos.
  whatsapp text,
  -- Hash do IP com sal do servidor (nunca o IP): só para limitar tentativas.
  origem_hash text,
  criado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_convite_resgates_convite
  ON public.convite_resgates(convite_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS idx_convite_resgates_origem
  ON public.convite_resgates(origem_hash, criado_em DESC)
  WHERE origem_hash IS NOT NULL;

-- Só o servidor (service role) lê e escreve.
ALTER TABLE public.convites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.convite_resgates ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.convites FROM anon, authenticated;
REVOKE ALL ON public.convite_resgates FROM anon, authenticated;
GRANT ALL ON public.convites TO service_role;
GRANT ALL ON public.convite_resgates TO service_role;

-- Consome um uso do convite, se ele ainda vale. Numa instrução só, para dois
-- resgates simultâneos não passarem do limite.
CREATE OR REPLACE FUNCTION public.reservar_convite(_codigo text)
RETURNS public.convites
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.convites
     SET usos = usos + 1
   WHERE codigo = _codigo
     AND ativo
     AND (expira_em IS NULL OR expira_em > now())
     AND (usos_max IS NULL OR usos < usos_max)
  RETURNING *;
$$;

-- Devolve o uso quando a criação da conta falha depois da reserva.
CREATE OR REPLACE FUNCTION public.liberar_convite(_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  UPDATE public.convites SET usos = GREATEST(usos - 1, 0) WHERE id = _id;
$$;

REVOKE ALL ON FUNCTION public.reservar_convite(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.liberar_convite(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reservar_convite(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.liberar_convite(uuid) TO service_role;
