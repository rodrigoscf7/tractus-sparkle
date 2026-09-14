-- =========================================================
-- Leads do quiz da oferta (publico, anonimo, pre-compra)
--
-- Guarda as respostas do quiz publico e o relatorio "DNA Viral"
-- gerado para ele. Existe separada de `onboarding_respostas`
-- porque aquela tabela e por conta, e aqui a pessoa ainda nao
-- tem conta nenhuma.
--
-- As respostas usam EXATAMENTE o mesmo formato de
-- `onboarding_respostas.respostas` (o type Respostas de
-- src/lib/onboarding-perguntas.ts). E isso que permite, depois
-- da compra, semear o onboarding sem a pessoa responder duas
-- vezes as mesmas perguntas.
-- =========================================================

CREATE TABLE public.oferta_leads (
  -- Vem do navegador (crypto.randomUUID em lib/oferta-variante.ts) e viaja
  -- ate o checkout no parametro s3 da Kiwify. E a chave que costura
  -- quiz -> compra -> onboarding.
  id uuid PRIMARY KEY,

  -- URL publica do relatorio (/dna-viral/$token). Aleatorio e nao
  -- adivinhavel: e a unica credencial de leitura do relatorio.
  token text NOT NULL UNIQUE,

  respostas jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- O DNA Viral. Nulo ate a geracao terminar.
  relatorio jsonb,
  relatorio_gerado_em timestamptz,
  -- 'ia' quando o agente respondeu, 'curado' quando caiu no fallback.
  relatorio_origem text,

  nome text,
  -- So quando a pessoa pede para salvar/baixar. O relatorio nunca
  -- e refem do e-mail.
  email text,

  -- sha256(ip + segredo). Serve ao limite de geracoes por origem.
  -- O IP cru nunca e gravado.
  ip_hash text,

  -- utm_*, fbclid, gclid capturados na chegada do anuncio.
  origem jsonb NOT NULL DEFAULT '{}'::jsonb,

  -- Preenchido pelo webhook da Kiwify quando a compra e casada.
  conta_id uuid REFERENCES public.contas(id) ON DELETE SET NULL,
  -- Marcado quando as respostas ja foram copiadas para o onboarding,
  -- para o webhook ser idempotente em reentrega.
  importado_em timestamptz,

  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);

-- Sem GRANT para anon e sem policy para anon, de proposito. O visitante do
-- quiz nunca fala com o Postgres: toda leitura e escrita passa por server
-- function com service role (src/lib/quiz-oferta.functions.ts), que e o mesmo
-- padrao de onboarding.functions.ts. Abrir insert publico aqui daria a
-- qualquer um uma tabela para encher.
GRANT ALL ON public.oferta_leads TO service_role;
ALTER TABLE public.oferta_leads ENABLE ROW LEVEL SECURITY;

-- Admin da plataforma le os leads no painel. Ninguem mais, nem o dono da
-- conta que nasceu do lead: o registro e da operacao, nao do cliente.
GRANT SELECT ON public.oferta_leads TO authenticated;
CREATE POLICY "admin le os leads" ON public.oferta_leads FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_oferta_leads_token ON public.oferta_leads(token);
CREATE INDEX idx_oferta_leads_email ON public.oferta_leads(email) WHERE email IS NOT NULL;
CREATE INDEX idx_oferta_leads_conta ON public.oferta_leads(conta_id) WHERE conta_id IS NOT NULL;
-- Sustenta a contagem por origem na janela do limite de geracoes.
CREATE INDEX idx_oferta_leads_ip_janela ON public.oferta_leads(ip_hash, criado_em DESC)
  WHERE ip_hash IS NOT NULL;
