SELECT cron.schedule('curador-diario', '0 11 * * *', $$
  SELECT net.http_post(
    url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/curador-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'
    ),
    body := '{}'::jsonb
  ) AS request_id;
$$);

SELECT cron.schedule('ideador-diario', '45 11 * * *', $$
  SELECT net.http_post(
    url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/ideador-agent',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'
    ),
    body := '{}'::jsonb
  ) AS request_id;
$$);