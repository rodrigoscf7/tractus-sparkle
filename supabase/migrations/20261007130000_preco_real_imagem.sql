-- Preço real do modelo de imagem da capa.
--
-- A lista do OpenRouter mostrava US$ 3 por milhão de tokens de saída, mas a
-- cobrança real (usage.cost) da imagem saiu em ~US$ 0,067 para 1.120 tokens:
-- a saída de imagem custa ~US$ 60 por milhão. Os eventos já têm o custo real
-- gravado; este preço só vale para os que ficaram sem ele (as primeiras
-- imagens de teste) e para quem consultar a tabela.
update public.custo_precos
set custo_saida_mi_centavos = 6000,
    rotulo = 'Gemini Flash Image (OpenRouter, capa do carrossel; saída de imagem ~US$ 60/mi)',
    atualizado_em = now()
where chave = 'google/gemini-3.1-flash-image';
