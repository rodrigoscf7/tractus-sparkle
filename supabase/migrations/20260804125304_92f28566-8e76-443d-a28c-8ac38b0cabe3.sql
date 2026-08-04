ALTER TABLE public.conteudos_curados
  ADD COLUMN IF NOT EXISTS aprovacao_humana text NOT NULL DEFAULT 'pendente',
  ADD COLUMN IF NOT EXISTS decidido_em timestamp with time zone;

CREATE INDEX IF NOT EXISTS idx_conteudos_curados_aprovacao
  ON public.conteudos_curados (aprovacao_humana, capturado_em DESC);

UPDATE public.conteudos_curados c
SET aprovacao_humana = 'aprovado', decidido_em = now()
WHERE EXISTS (
  SELECT 1 FROM public.pautas_geradas p WHERE p.origem_curadoria_id = c.id
);

CREATE OR REPLACE FUNCTION public.trigger_ideador()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
begin
  if new.aprovacao_humana = 'aprovado'
     and (old.aprovacao_humana is null or old.aprovacao_humana <> 'aprovado') then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/ideador-agent',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'
      ),
      body := jsonb_build_object('conteudo_id', new.id, 'perfil_referencia_id', new.perfil_referencia_id)
    );
  end if;
  return new;
end;
$function$;

DROP TRIGGER IF EXISTS trg_curados_trigger_ideador ON public.conteudos_curados;
CREATE TRIGGER trg_curados_trigger_ideador
AFTER UPDATE ON public.conteudos_curados
FOR EACH ROW EXECUTE FUNCTION public.trigger_ideador();