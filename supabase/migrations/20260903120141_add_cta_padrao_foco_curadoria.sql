ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS cta_padrao text;
ALTER TABLE public.perfis ADD COLUMN IF NOT EXISTS foco_curadoria text NOT NULL DEFAULT 'posicionamento';
ALTER TABLE public.perfis_referencia ADD COLUMN IF NOT EXISTS foco_curadoria text;