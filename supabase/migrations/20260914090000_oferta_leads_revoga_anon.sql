-- =========================================================
-- Fecha os privilegios de `oferta_leads` no nivel do GRANT.
--
-- POR QUE ISTO EXISTE: a migration anterior afirmava, num comentario, que a
-- tabela nascia "sem GRANT para anon". Errado. Este projeto tem DEFAULT
-- PRIVILEGES que concedem ALL em toda tabela nova do schema public para `anon`
-- e `authenticated` -- entao `oferta_leads` nasceu com INSERT, UPDATE, DELETE
-- e SELECT abertos para visitante anonimo.
--
-- Na pratica a tabela nao estava exposta: a RLS esta ligada e a unica policy e
-- de SELECT para admin, entao INSERT anonimo e recusado ("new row violates
-- row-level security policy") e UPDATE anonimo atinge zero linhas. Foi
-- verificado contra o projeto, pelas duas rotas.
--
-- Mas isso deixa a RLS como unica linha de defesa. Uma policy permissiva
-- adicionada por engano no futuro abriria escrita anonima numa tabela que
-- guarda e-mail e respostas de lead. O GRANT e o cinto; a RLS, o suspensorio.
--
-- Escopo deliberado: so esta tabela. As outras tabelas do projeto estao na
-- mesma situacao por causa dos mesmos default privileges, e mexer nelas sem
-- pedido seria uma mudanca de seguranca ampla, fora do que foi combinado.
-- =========================================================

-- Visitante anonimo nao tem nada a fazer aqui: todo acesso do quiz passa por
-- server function com service role.
REVOKE ALL ON public.oferta_leads FROM anon;

-- Usuario logado so le, e a RLS ainda restringe a admin da plataforma.
REVOKE ALL ON public.oferta_leads FROM authenticated;
GRANT SELECT ON public.oferta_leads TO authenticated;

-- A causa raiz continua de pe: os DEFAULT PRIVILEGES do projeto. Toda tabela
-- criada daqui em diante nasce com o mesmo GRANT aberto. Corrigi-los e uma
-- decisao separada, que precisa ser tomada olhando as tabelas existentes de
-- uma vez -- nao de carona numa migration de funil.
