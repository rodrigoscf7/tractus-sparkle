ALTER TABLE public.conteudos_curados
  ADD COLUMN IF NOT EXISTS likes integer,
  ADD COLUMN IF NOT EXISTS comentarios integer,
  ADD COLUMN IF NOT EXISTS views integer,
  ADD COLUMN IF NOT EXISTS postado_em timestamptz;