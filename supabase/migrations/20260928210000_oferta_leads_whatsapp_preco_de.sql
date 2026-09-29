-- Contato obrigatório no quiz da oferta + preço âncora na página de diagnóstico.
--
-- whatsapp: espelhado da última pergunta do quiz (junto com email).
-- preco_de_centavos: o "DE R$ 197" riscado na oferta; null = não mostrar âncora.

ALTER TABLE public.oferta_leads
  ADD COLUMN IF NOT EXISTS whatsapp text;

COMMENT ON COLUMN public.oferta_leads.whatsapp IS
  'WhatsApp coletado no fim do quiz (só dígitos). Espelhado de respostas.whatsapp.';

CREATE INDEX IF NOT EXISTS idx_oferta_leads_whatsapp
  ON public.oferta_leads(whatsapp)
  WHERE whatsapp IS NOT NULL;

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS preco_de_centavos integer;

COMMENT ON COLUMN public.planos.preco_de_centavos IS
  'Preço âncora (riscado) na página pública do DNA Viral. Null = não exibir.';
