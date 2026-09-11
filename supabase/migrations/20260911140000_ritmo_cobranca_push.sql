-- Cobrança do ritmo.
--
-- Nos dias em que o usuário se comprometeu a postar, a prevIA lembra. A regra
-- que atravessa o desenho: a cobrança nunca chega vazia. Só enfileira quando já
-- existe algo esperando por ele — roteiro aprovado e não postado, ou uma decisão
-- pendente. Sem conteúdo, não há cobrança: lembrete sem saída queima a permissão
-- de push que custou caro para conseguir.
--
-- Reaproveita a fila e o despachante existentes (20260910075959_push_despacho):
-- agregação por (perfil_id, tipo), silêncio noturno e fallback das 20h já valem
-- para este tipo sem nenhuma mudança.

create or replace function public.enfileirar_cobranca_ritmo()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_perfil record;
  v_tem_conteudo boolean;
begin
  for v_perfil in
    select p.id, p.conta_id, p.ritmo_dias, p.ritmo_hora, p.ritmo_fuso
    from public.perfis p
    where p.ativo is true
      and p.conta_id is not null
  loop
    -- Dia e hora são avaliados no fuso do próprio perfil.
    continue when extract(dow from (now() at time zone v_perfil.ritmo_fuso))::smallint
                  <> all (v_perfil.ritmo_dias);

    continue when (now() at time zone v_perfil.ritmo_fuso)::time < v_perfil.ritmo_hora;

    -- Já cobrado hoje? A fila guarda o lote enviado; não repetir no mesmo dia.
    continue when exists (
      select 1 from public.push_notificacoes_pendentes q
      where q.perfil_id = v_perfil.id
        and q.tipo = 'ritmo_hoje'
        and (coalesce(q.enviado_em, q.primeiro_evento_em) at time zone v_perfil.ritmo_fuso)::date
            = (now() at time zone v_perfil.ritmo_fuso)::date
    );

    select
      exists (
        select 1
        from public.publicacoes pub
        where pub.perfil_id = v_perfil.id and pub.status = 'pendente'
      )
      or exists (
        select 1
        from public.pautas_geradas pg
        where pg.perfil_id = v_perfil.id and pg.status = 'aguardando_aprovacao'
      )
      or exists (
        select 1
        from public.conteudos_curados cc
        join public.perfis_referencia pr on pr.id = cc.perfil_referencia_id
        where pr.perfil_id_relacionado = v_perfil.id
          and cc.aprovacao_humana = 'pendente'
      )
    into v_tem_conteudo;

    continue when not v_tem_conteudo;

    perform public.enfileirar_notificacao_push(v_perfil.id, v_perfil.conta_id, 'ritmo_hoje');
  end loop;
end;
$$;

revoke all on function public.enfileirar_cobranca_ritmo() from public, anon, authenticated;

-- De hora em hora: a checagem de `ritmo_hora` decide a janela, e a trava do dia
-- garante uma cobrança só por dia por perfil.
select cron.schedule(
  'cobranca-ritmo',
  '0 * * * *',
  $$ select public.enfileirar_cobranca_ritmo(); $$
);
