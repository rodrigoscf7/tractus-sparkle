-- O webhook da Kiwify grava com ON CONFLICT (pedido_id, evento), e o Postgres não
-- aceita um índice parcial para satisfazer essa especificação: todo evento com
-- assinatura válida falhava com "no unique or exclusion constraint matching".
-- Sem o WHERE o comportamento é o mesmo, porque NULLs continuam distintos entre si
-- e eventos sem pedido_id seguem podendo se repetir.
drop index if exists public.kiwify_eventos_idempotencia;

create unique index kiwify_eventos_idempotencia
  on public.kiwify_eventos (pedido_id, evento);
