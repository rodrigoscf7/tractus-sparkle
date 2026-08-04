CREATE TABLE public.carrosseis (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pauta_id uuid REFERENCES public.pautas_geradas(id) ON DELETE CASCADE,
  perfil_id uuid REFERENCES public.perfis(id) ON DELETE SET NULL,
  copy jsonb,
  visual jsonb,
  status text NOT NULL DEFAULT 'gerando',
  erro text,
  criado_em timestamp with time zone NOT NULL DEFAULT now(),
  atualizado_em timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.carrosseis TO authenticated;
GRANT ALL ON public.carrosseis TO service_role;

ALTER TABLE public.carrosseis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth users full access carrosseis" ON public.carrosseis
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX carrosseis_pauta_id_idx ON public.carrosseis(pauta_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.atualizado_em = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_carrosseis_atualizado_em
  BEFORE UPDATE ON public.carrosseis
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS template_carrossel jsonb NOT NULL DEFAULT '{"arroba":"","nome_exibicao":"","foto_url":"","verificado":true,"cor_fundo":"#0F172A","cor_texto":"#FFFFFF"}'::jsonb;