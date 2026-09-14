-- =========================================================
-- Estado do acesso pos-compra.
--
-- O comprador da Kiwify nao consegue se cadastrar: `enable_signup` esta
-- desligado no Auth do projeto, de proposito. Entao quem cria a conta dele e o
-- webhook, e ele define a senha numa tela propria -- a pagina de obrigado da
-- Kiwify aponta para la.
--
-- Essas duas colunas sao o que torna aquela tela segura: ela so aceita definir
-- senha uma vez, e so dentro de uma janela curta depois da compra.
-- =========================================================

ALTER TABLE public.oferta_leads
  -- Quando o webhook criou (ou encontrou) a conta do comprador. E o inicio da
  -- janela em que a tela de boas-vindas aceita definir a senha.
  ADD COLUMN IF NOT EXISTS conta_criada_em timestamptz,

  -- Quando o comprador definiu a propria senha. Preenchido, consome o convite:
  -- a tela passa a mandar a pessoa para o login normal. E o que impede que um
  -- lead_id vazado (ele viaja na query do checkout) vire acesso a conta de
  -- alguem que pagou.
  ADD COLUMN IF NOT EXISTS senha_definida_em timestamptz;

COMMENT ON COLUMN public.oferta_leads.conta_criada_em IS
  'Inicio da janela para definir a senha inicial na tela de boas-vindas.';
COMMENT ON COLUMN public.oferta_leads.senha_definida_em IS
  'Consome o convite de senha inicial. Uma vez preenchido, nao aceita de novo.';
