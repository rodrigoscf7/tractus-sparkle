-- API de Conversões do Meta (src/lib/meta-capi.server.ts).
--
-- Os identificadores do Pixel e o navegador de quem respondeu o quiz ficam
-- no lead, para a compra, que chega depois pelo webhook da Hubla, ser ligada
-- ao anúncio. O IP não é guardado: vai só no Lead, lido na hora.
alter table public.oferta_leads
  add column if not exists meta_fbp text,
  add column if not exists meta_fbc text,
  add column if not exists meta_user_agent text,
  -- Um Lead por lead: o quiz grava a cada passo.
  add column if not exists meta_lead_enviado_em timestamptz;
