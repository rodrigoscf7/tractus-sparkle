DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'curador-diario') THEN
    PERFORM cron.alter_job(
      job_id := (SELECT jobid FROM cron.job WHERE jobname = 'curador-diario' LIMIT 1),
      schedule := '0 10 * * *'
    );
  ELSE
    PERFORM cron.schedule(
      'curador-diario',
      '0 10 * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/curador-agent',
        headers := jsonb_build_object('Content-Type','application/json',
          'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;

  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ideador-diario') THEN
    PERFORM cron.alter_job(
      job_id := (SELECT jobid FROM cron.job WHERE jobname = 'ideador-diario' LIMIT 1),
      schedule := '45 10 * * *',
      command := $cron$
      SELECT net.http_post(
        url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/ideador-agent',
        headers := jsonb_build_object('Content-Type','application/json',
          'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'),
        body := '{}'::jsonb
      );
      $cron$
    );
  ELSE
    PERFORM cron.schedule(
      'ideador-diario',
      '45 10 * * *',
      $cron$
      SELECT net.http_post(
        url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/ideador-agent',
        headers := jsonb_build_object('Content-Type','application/json',
          'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJIUzI1NiIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'),
        body := '{}'::jsonb
      );
      $cron$
    );
  END IF;
END $$;

UPDATE public.agentes_status
SET estado_atual = 'idle',
    ultima_acao = 'ajustado para evitar chamadas paralelas ao ideador',
    atualizado_em = now()
WHERE agente_nome = 'ideador';