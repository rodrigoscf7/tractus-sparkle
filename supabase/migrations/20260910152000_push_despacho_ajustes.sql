-- Ajustes pós-revisão da Task 3:
-- 1. Fallback noturno às 20h BRT (= 23h UTC; pg_cron agenda em UTC)
-- 2. Idempotência nos cron jobs (unschedule antes de schedule)
-- 3. REVOKE nas funções trigger internas

revoke all on function public.trigger_notificar_curadoria_pronta() from public, anon, authenticated;
revoke all on function public.trigger_notificar_pauta_pronta() from public, anon, authenticated;

select cron.unschedule(jobname)
from cron.job
where jobname in ('despachar-notificacoes-push', 'forcar-notificacoes-push-noturnas');

select cron.schedule(
  'despachar-notificacoes-push',
  '*/2 * * * *',
  $$ select public.despachar_notificacoes_pendentes(false); $$
);

select cron.schedule(
  'forcar-notificacoes-push-noturnas',
  '0 23 * * *',
  $$ select public.despachar_notificacoes_pendentes(true); $$
);
