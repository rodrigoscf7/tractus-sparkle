-- Imagem da capa passa a usar o FLUX.2 Pro (Black Forest Labs, via OpenRouter).
--
-- Preço de lista: US$ 7,32 por milhão de tokens de imagem (~US$ 0,03 por
-- megapixel). O custo real de cada chamada já é gravado em
-- custo_eventos.custo_real_centavos; este preço é só a reserva da estimativa.
insert into public.custo_precos (chave, rotulo, tipo, custo_entrada_mi_centavos, custo_saida_mi_centavos)
values ('black-forest-labs/flux.2-pro', 'FLUX.2 Pro (OpenRouter, capa do carrossel)', 'modelo', 0, 732.4219)
on conflict (chave) do update
  set custo_saida_mi_centavos = excluded.custo_saida_mi_centavos,
      rotulo = excluded.rotulo,
      atualizado_em = now();
