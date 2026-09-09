-- Ajustes para o schema aplicado do zero num projeto vazio.
--
-- As migrations herdadas do Lovable Cloud assumiam um banco que já estava em uso:
-- promoviam a admin os usuários existentes em auth.users e ligavam a conta semeada
-- aos membros que já existiam. Num projeto novo essas consultas não encontram nada,
-- e o resultado seria uma instância sem nenhum admin e com os perfis do seed presos
-- numa conta sem dono.

-- 1) O bucket só tinha policies; nunca foi criado por migration.
--    Privado porque o app baixa os arquivos via .download(), não por URL pública.
insert into storage.buckets (id, name, public)
values ('perfil-fotos', 'perfil-fotos', false)
on conflict (id) do nothing;

-- 2) Primeiro usuário a se cadastrar assume a instância.
--    Só age enquanto não existir nenhum admin, então deixa de ter efeito depois do
--    primeiro cadastro e não interfere nos usuários seguintes.
create or replace function public.bootstrap_primeiro_admin()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conta uuid;
begin
  if exists (select 1 from public.user_roles where role = 'admin'::public.app_role) then
    return new;
  end if;

  insert into public.user_roles (user_id, role)
  values (new.id, 'admin'::public.app_role)
  on conflict (user_id, role) do nothing;

  -- Adota a conta semeada pelas migrations, que nasce sem membros e carrega os
  -- perfis do seed. Sem isso esses perfis ficariam invisíveis para todo mundo,
  -- porque a RLS de perfis exige que o usuário seja membro da conta.
  select c.id into v_conta
  from public.contas c
  where not exists (select 1 from public.conta_membros m where m.conta_id = c.id)
  order by c.criado_em
  limit 1;

  if v_conta is not null then
    insert into public.conta_membros (conta_id, user_id, papel)
    values (v_conta, new.id, 'owner')
    on conflict (conta_id, user_id) do nothing;
  end if;

  return new;
end;
$$;

revoke all on function public.bootstrap_primeiro_admin() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_bootstrap_admin on auth.users;
create trigger on_auth_user_created_bootstrap_admin
after insert on auth.users
for each row execute function public.bootstrap_primeiro_admin();

-- 3) expirar_trials() existia desde 20260903224845 mas nunca foi agendada: só rodava
--    quando alguém abria a tela de assinatura. Trials vencidos ficavam com plano pago.
select cron.unschedule('expirar-trials')
where exists (select 1 from cron.job where jobname = 'expirar-trials');

select cron.schedule('expirar-trials', '30 3 * * *', $$ select public.expirar_trials(); $$);
