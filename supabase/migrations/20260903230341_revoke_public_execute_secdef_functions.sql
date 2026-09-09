-- Revoke implicit PUBLIC EXECUTE (anon + authenticated) on internal SECURITY DEFINER functions.
REVOKE ALL ON FUNCTION public.contas_do_usuario(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.expirar_trials() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.iniciar_conta_trial(uuid, text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.limite_disponivel(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.minha_conta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.registrar_uso(uuid, text, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_herdar_conta_de_pauta() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_herdar_conta_de_perfil() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_herdar_conta_de_referencia() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_uso_carrossel() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_uso_curadoria() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tg_uso_roteiro() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_conta_membro(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_conta_owner(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;

-- Keep only the permission checkers that RLS policies need for signed-in users.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conta_membro(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_conta_owner(uuid) TO authenticated;

-- Service role (server functions, triggers, edge functions) keeps full access.
GRANT EXECUTE ON FUNCTION public.contas_do_usuario(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.expirar_trials() TO service_role;
GRANT EXECUTE ON FUNCTION public.iniciar_conta_trial(uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.limite_disponivel(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.minha_conta() TO service_role;
GRANT EXECUTE ON FUNCTION public.registrar_uso(uuid, text, integer) TO service_role;
