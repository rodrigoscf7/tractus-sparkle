-- Preço do modelo de visão do curador (leitura do texto escrito nas imagens).
--
-- O curador registra cada chamada em custo_eventos com o nome do modelo usado; sem
-- uma linha aqui o painel financeiro não saberia precificar essas chamadas.
-- Valores em centavos por milhão de tokens: US$ 1,00 de entrada e US$ 5,00 de saída.
insert into public.custo_precos (chave, rotulo, tipo, custo_entrada_mi_centavos, custo_saida_mi_centavos)
values ('anthropic/claude-haiku-4.5', 'Claude Haiku (OpenRouter, visão)', 'modelo', 100, 500)
on conflict (chave) do nothing;
