-- O FLUX.2 Pro devolve a imagem da capa em ~3 MP (1536×1920), um PNG de
-- ~4 MB: perto do limite de 5 MB do bucket. 10 MB dá folga para imagens com
-- mais detalhe. A imagem enviada pela pessoa continua reduzida no navegador.
update storage.buckets set file_size_limit = 10485760 where id = 'carrossel-imagens';
