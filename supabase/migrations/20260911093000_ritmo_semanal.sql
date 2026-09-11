-- Ritmo semanal de publicação.
--
-- O produto passa a vender constância: o usuário se compromete com os dias em
-- que vai postar e a prevIA garante que sempre existe conteúdo pronto para
-- esses dias. As colunas ficam em `perfis` porque é onde já mora a configuração
-- da marca (tom de voz, diretrizes, CTA) e, para o advogado solo, perfil e
-- assinante são a mesma coisa.
--
-- `ritmo_dias` usa a convenção de `extract(dow)` do Postgres: 0=domingo … 6=sábado.
-- O padrão 1,3,5 (seg/qua/sex) é o ritmo recomendado para quem está começando.

ALTER TABLE public.perfis
  ADD COLUMN IF NOT EXISTS ritmo_dias smallint[] NOT NULL DEFAULT '{1,3,5}',
  ADD COLUMN IF NOT EXISTS ritmo_hora time NOT NULL DEFAULT '09:00',
  ADD COLUMN IF NOT EXISTS ritmo_fuso text NOT NULL DEFAULT 'America/Sao_Paulo';

-- Nem lista vazia, nem dia fora da semana: a pauta da semana e o futuro disparo
-- de notificação leem isto direto.
--
-- Dia repetido não entra na checagem porque CHECK não aceita subconsulta no
-- Postgres, e é inofensivo: quem lê o array percorre a ordem canônica da semana
-- (`pautaDaSemana` em src/lib/ritmo.ts), então uma repetição não duplica linha.
ALTER TABLE public.perfis
  DROP CONSTRAINT IF EXISTS perfis_ritmo_dias_validos;

ALTER TABLE public.perfis
  ADD CONSTRAINT perfis_ritmo_dias_validos CHECK (
    array_length(ritmo_dias, 1) BETWEEN 1 AND 7
    AND ritmo_dias <@ ARRAY[0,1,2,3,4,5,6]::smallint[]
  );

COMMENT ON COLUMN public.perfis.ritmo_dias IS
  'Dias da semana em que o usuário se comprometeu a postar (0=dom … 6=sáb).';
COMMENT ON COLUMN public.perfis.ritmo_hora IS
  'Hora local do lembrete de gravação no fuso de ritmo_fuso.';
