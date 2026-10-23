-- Papel "comercial": a equipe de social selling.
--
-- Vê, só para leitura, os leads do quiz, as contas, o onboarding e os chamados
-- de suporte, na área /equipe. Não vê financeiro, custos nem planos, e não age
-- sobre conta nenhuma. Os dados saem por server functions com service role,
-- que conferem o papel antes de ler (src/lib/equipe.functions.ts); nenhuma
-- policy nova abre tabela para esse papel.
alter type public.app_role add value if not exists 'comercial';
