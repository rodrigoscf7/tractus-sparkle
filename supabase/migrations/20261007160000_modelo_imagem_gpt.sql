-- Imagem da capa passa a usar o GPT Image 2.5 Sunburst (OpenAI, via OpenRouter).
--
-- Em teste, saiu a US$ 0,013 por imagem (qualidade média, JPEG 1152×1536),
-- contra US$ 0,060 do FLUX.2 Pro e US$ 0,067 do Gemini Flash Image. O custo
-- real de cada chamada já vai para custo_eventos.custo_real_centavos; este
-- preço de lista (US$ 8/mi de entrada, US$ 30/mi de imagem) é só a reserva.
insert into public.custo_precos (chave, rotulo, tipo, custo_entrada_mi_centavos, custo_saida_mi_centavos)
values ('openai/gpt-image-2.5-sunburst', 'GPT Image 2.5 Sunburst (OpenRouter, capa do carrossel)', 'modelo', 800, 3000)
on conflict (chave) do update
  set custo_entrada_mi_centavos = excluded.custo_entrada_mi_centavos,
      custo_saida_mi_centavos = excluded.custo_saida_mi_centavos,
      rotulo = excluded.rotulo,
      atualizado_em = now();
