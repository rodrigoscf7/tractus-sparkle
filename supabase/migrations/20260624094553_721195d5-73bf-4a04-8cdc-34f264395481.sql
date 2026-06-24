
-- Reset curador status
UPDATE public.agentes_status
SET estado_atual = 'idle',
    ultima_acao = 'reset após travamento (timeout em @liderhub.ai)',
    atualizado_em = now()
WHERE agente_nome = 'curador';

-- Drop per-insert ideador trigger; curador will batch-call ideador per perfil
DROP TRIGGER IF EXISTS on_conteudo_curado_insert ON public.conteudos_curados;
