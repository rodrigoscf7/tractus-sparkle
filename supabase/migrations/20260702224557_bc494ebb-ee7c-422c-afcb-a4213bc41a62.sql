
ALTER TABLE public.perfis DROP CONSTRAINT perfis_tipo_check;
ALTER TABLE public.perfis ADD CONSTRAINT perfis_tipo_check
  CHECK (tipo = ANY (ARRAY['institucional'::text, 'socio'::text, 'cliente'::text]));
