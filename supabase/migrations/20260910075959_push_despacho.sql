-- Upsert no lote aberto (perfil_id, tipo). Se não existir perfil resolvido,
-- não faz nada — mesma tolerância que gerarPautaFocada já tem no ideador-agent.
create or replace function public.enfileirar_notificacao_push(
  p_perfil_id uuid,
  p_conta_id uuid,
  p_tipo text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_perfil_id is null or p_conta_id is null then
    return;
  end if;

  insert into public.push_notificacoes_pendentes
    (conta_id, perfil_id, tipo, contagem, primeiro_evento_em, ultimo_evento_em)
  values
    (p_conta_id, p_perfil_id, p_tipo, 1, now(), now())
  on conflict (perfil_id, tipo) where enviado_em is null
  do update set
    contagem = push_notificacoes_pendentes.contagem + 1,
    ultimo_evento_em = now();
end;
$$;

revoke all on function public.enfileirar_notificacao_push(uuid, uuid, text) from public, anon, authenticated;

-- Curadoria pronta: dispara quando uma linha nova entra pendente de
-- aprovação. conteudos_curados não tem FK direto para perfis — o caminho é
-- perfis_referencia.perfil_id_relacionado.
create or replace function public.trigger_notificar_curadoria_pronta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil_id uuid;
begin
  if new.aprovacao_humana <> 'pendente' then
    return new;
  end if;

  select pr.perfil_id_relacionado into v_perfil_id
  from public.perfis_referencia pr
  where pr.id = new.perfil_referencia_id;

  perform public.enfileirar_notificacao_push(v_perfil_id, new.conta_id, 'curadoria_pronta');
  return new;
end;
$$;

drop trigger if exists on_conteudo_curado_notificar on public.conteudos_curados;
create trigger on_conteudo_curado_notificar
after insert on public.conteudos_curados
for each row execute function public.trigger_notificar_curadoria_pronta();

-- Pautas prontas: dispara quando o status muda para aguardando_aprovacao.
create or replace function public.trigger_notificar_pauta_pronta()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aguardando_aprovacao' and (old.status is distinct from new.status) then
    perform public.enfileirar_notificacao_push(new.perfil_id, new.conta_id, 'pautas_prontas');
  end if;
  return new;
end;
$$;

drop trigger if exists on_pauta_aguardando_aprovacao_notificar on public.pautas_geradas;
create trigger on_pauta_aguardando_aprovacao_notificar
after update on public.pautas_geradas
for each row execute function public.trigger_notificar_pauta_pronta();

-- Varredura da fila: fecha lotes com >10min de silêncio, fora do silêncio
-- noturno (22h-7h em America/Sao_Paulo). p_forcar ignora as duas condições —
-- usado pelo fallback das 20h, para nada represado à noite ficar esquecido
-- se nenhum evento novo chegar durante o dia.
create or replace function public.despachar_notificacoes_pendentes(p_forcar boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_hora_local time;
  v_lote record;
begin
  v_hora_local := (now() at time zone 'America/Sao_Paulo')::time;

  if not p_forcar and (v_hora_local >= time '22:00' or v_hora_local < time '07:00') then
    return;
  end if;

  for v_lote in
    select id, conta_id, perfil_id, tipo, contagem
    from public.push_notificacoes_pendentes
    where enviado_em is null
      and (p_forcar or now() - ultimo_evento_em > interval '10 minutes')
    order by primeiro_evento_em
    for update skip locked
  loop
    update public.push_notificacoes_pendentes
    set enviado_em = now()
    where id = v_lote.id;

    perform net.http_post(
      url := public.agent_function_url('push-agent'),
      headers := public.agent_internal_headers(),
      body := jsonb_build_object('queue_id', v_lote.id)
    );
  end loop;
end;
$$;

revoke all on function public.despachar_notificacoes_pendentes(boolean) from public, anon, authenticated;

select cron.schedule(
  'despachar-notificacoes-push',
  '*/2 * * * *',
  $$ select public.despachar_notificacoes_pendentes(false); $$
);

select cron.schedule(
  'forcar-notificacoes-push-noturnas',
  '0 20 * * *',
  $$ select public.despachar_notificacoes_pendentes(true); $$
);
