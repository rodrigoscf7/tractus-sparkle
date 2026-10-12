-- O DNA Viral também vai por e-mail.
--
-- O e-mail já era pedido no fim do quiz e gravado em oferta_leads.email, mas
-- nada era enviado. O email-agent carimba esta coluna ANTES de chamar o Resend
-- (update ... where email_enviado_em is null), então gerar de novo ou recarregar
-- a página não manda um segundo e-mail. Se o envio falhar, o carimbo é desfeito.
alter table public.oferta_leads
  add column if not exists email_enviado_em timestamptz;

comment on column public.oferta_leads.email_enviado_em is
  'Quando o e-mail com o link do DNA Viral foi enviado. Nulo = ainda não enviado.';
