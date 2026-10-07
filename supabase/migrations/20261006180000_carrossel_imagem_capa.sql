-- Imagem opcional na capa do carrossel, e acesso por conta à foto do template.
--
-- 1) A imagem fica em colunas próprias, fora de `copy` e `visual`: o
--    carrossel-agent reescreve essas duas ao regerar, e a capa precisa
--    continuar com a imagem que a pessoa escolheu.
-- 2) Bucket privado `carrossel-imagens`, uma pasta por conta.
-- 3) `perfil-fotos` estava restrito a admins (20260807165039) e nunca foi
--    aberto por conta: clientes não conseguiam enviar a foto do template.

-- ============ 1) Colunas ============
alter table public.carrosseis
  add column if not exists imagem_capa_path text,
  add column if not exists imagem_capa_foco smallint not null default 50,
  add column if not exists imagem_capa_origem text;

alter table public.carrosseis
  drop constraint if exists carrosseis_imagem_capa_foco_check,
  add constraint carrosseis_imagem_capa_foco_check check (imagem_capa_foco between 0 and 100),
  drop constraint if exists carrosseis_imagem_capa_origem_check,
  add constraint carrosseis_imagem_capa_origem_check check (imagem_capa_origem in ('envio', 'ia'));

comment on column public.carrosseis.imagem_capa_path is
  'Caminho no bucket carrossel-imagens ({conta_id}/{carrossel_id}/{arquivo}). Nulo = capa sem imagem.';
comment on column public.carrosseis.imagem_capa_foco is
  'Enquadramento vertical da imagem na capa, em % (0 = alto, 50 = centro, 100 = baixo).';

-- ============ 2) Bucket carrossel-imagens ============
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'carrossel-imagens',
  'carrossel-imagens',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- A primeira pasta do caminho é a conta. Comparação em texto: um caminho fora
-- do padrão não quebra a consulta, só não dá acesso.
drop policy if exists "conta le imagens do carrossel" on storage.objects;
drop policy if exists "conta envia imagens do carrossel" on storage.objects;
drop policy if exists "conta atualiza imagens do carrossel" on storage.objects;
drop policy if exists "conta apaga imagens do carrossel" on storage.objects;

create policy "conta le imagens do carrossel" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'carrossel-imagens'
    and (
      exists (
        select 1 from public.conta_membros m
        where m.user_id = auth.uid() and m.conta_id::text = (storage.foldername(name))[1]
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "conta envia imagens do carrossel" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'carrossel-imagens'
    and (
      exists (
        select 1 from public.conta_membros m
        where m.user_id = auth.uid() and m.conta_id::text = (storage.foldername(name))[1]
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "conta atualiza imagens do carrossel" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'carrossel-imagens'
    and (
      exists (
        select 1 from public.conta_membros m
        where m.user_id = auth.uid() and m.conta_id::text = (storage.foldername(name))[1]
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "conta apaga imagens do carrossel" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'carrossel-imagens'
    and (
      exists (
        select 1 from public.conta_membros m
        where m.user_id = auth.uid() and m.conta_id::text = (storage.foldername(name))[1]
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );

-- ============ 3) perfil-fotos por conta ============
-- A primeira pasta é o perfil ({perfil_id}/foto-...). A leitura de `perfis`
-- já passa pela RLS de conta, então o perfil só é achado se for da conta.
drop policy if exists "admins read perfil fotos" on storage.objects;
drop policy if exists "admins insert perfil fotos" on storage.objects;
drop policy if exists "admins update perfil fotos" on storage.objects;
drop policy if exists "admins delete perfil fotos" on storage.objects;
drop policy if exists "conta le fotos do perfil" on storage.objects;
drop policy if exists "conta envia fotos do perfil" on storage.objects;
drop policy if exists "conta atualiza fotos do perfil" on storage.objects;
drop policy if exists "conta apaga fotos do perfil" on storage.objects;

create policy "conta le fotos do perfil" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and (
      exists (
        select 1 from public.perfis p
        where p.id::text = (storage.foldername(name))[1] and public.is_conta_membro(p.conta_id)
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "conta envia fotos do perfil" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'perfil-fotos'
    and (
      exists (
        select 1 from public.perfis p
        where p.id::text = (storage.foldername(name))[1] and public.is_conta_membro(p.conta_id)
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "conta atualiza fotos do perfil" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and (
      exists (
        select 1 from public.perfis p
        where p.id::text = (storage.foldername(name))[1] and public.is_conta_membro(p.conta_id)
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );

create policy "conta apaga fotos do perfil" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'perfil-fotos'
    and (
      exists (
        select 1 from public.perfis p
        where p.id::text = (storage.foldername(name))[1] and public.is_conta_membro(p.conta_id)
      )
      or public.has_role(auth.uid(), 'admin')
    )
  );
