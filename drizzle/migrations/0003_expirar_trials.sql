CREATE OR REPLACE FUNCTION public.expirar_trials()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  afetadas integer;
BEGIN
  WITH expiradas AS (
    UPDATE public.assinaturas a
    SET situacao = 'cancelada',
        cancelada_em = now(),
        plano_codigo = 'free',
        valor_centavos = 0
    WHERE a.situacao = 'trial'
      AND a.trial_fim IS NOT NULL
      AND a.trial_fim < now()
    RETURNING a.conta_id
  )
  UPDATE public.contas c
  SET plano_codigo = 'free'
  WHERE c.id IN (SELECT conta_id FROM expiradas);

  GET DIAGNOSTICS afetadas = ROW_COUNT;
  RETURN afetadas;
END;
$$;

REVOKE ALL ON FUNCTION public.expirar_trials() FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.expirar_trials() TO service_role;

CREATE OR REPLACE FUNCTION public.iniciar_conta_trial(_user_id uuid, _nome text, _plano text DEFAULT 'starter')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_conta uuid;
  v_dias integer;
  v_preco integer;
BEGIN
  SELECT conta_id INTO v_conta FROM public.conta_membros WHERE user_id = _user_id ORDER BY criado_em LIMIT 1;
  IF v_conta IS NOT NULL THEN
    RETURN v_conta;
  END IF;

  SELECT COALESCE(trial_dias, 14), COALESCE(preco_mensal_centavos, 0)
    INTO v_dias, v_preco
  FROM public.planos WHERE codigo = _plano;

  IF v_dias IS NULL THEN
    v_dias := 14;
    v_preco := 0;
    _plano := 'free';
  END IF;

  INSERT INTO public.contas (nome, plano_codigo) VALUES (COALESCE(NULLIF(_nome, ''), 'Minha conta'), _plano)
  RETURNING id INTO v_conta;

  INSERT INTO public.conta_membros (conta_id, user_id, papel) VALUES (v_conta, _user_id, 'owner');

  INSERT INTO public.assinaturas (conta_id, plano_codigo, situacao, origem, valor_centavos, trial_fim, proxima_renovacao)
  VALUES (
    v_conta, _plano,
    CASE WHEN v_dias > 0 THEN 'trial' ELSE 'ativa' END,
    'kiwify', v_preco,
    CASE WHEN v_dias > 0 THEN now() + (v_dias || ' days')::interval ELSE NULL END,
    now() + (GREATEST(v_dias, 30) || ' days')::interval
  )
  ON CONFLICT (conta_id) DO NOTHING;

  RETURN v_conta;
END;
$$;

REVOKE ALL ON FUNCTION public.iniciar_conta_trial(uuid, text, text) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.iniciar_conta_trial(uuid, text, text) TO service_role;