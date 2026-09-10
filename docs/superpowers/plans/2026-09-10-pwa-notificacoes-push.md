# PWA instalável + notificações push (curadoria e pautas prontas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tornar o app instalável (PWA) e enviar notificações push amigáveis, chamando o advogado pelo nome, quando a curadoria diária fica pronta para aprovação e quando pautas chegam a `aguardando_aprovacao`.

**Architecture:** Fila de agregação no Postgres (`push_notificacoes_pendentes`) alimentada por triggers em `conteudos_curados` e `pautas_geradas`, varrida por `pg_cron` a cada 2 minutos (mais um fallback diário às 20h), que dispara a edge function `push-agent` via `net.http_post` — o mesmo padrão que `curador-diario`/`ideador-diario` já usam. O `push-agent` envia Web Push assinado com VAPID para as inscrições de todos os membros da conta. No cliente, um service worker manual (`public/sw.js`) mostra a notificação e abre o app; um card em `/dna` convida a instalar/permitir logo após o relatório de DNA, com fallback para o fluxo de duas etapas do iOS.

**Tech Stack:** TanStack Start (React 19, Vite) + Supabase (Postgres, `pg_cron`, `pg_net`, Edge Functions Deno) + `npm:web-push` (Deno) + `sharp` (build-time, geração de ícones).

## Global Constraints

- Nunca commitar segredos reais — `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` são segredos de Edge Function (`supabase secrets set`), nunca Vault, nunca `.env` versionado.
- `VITE_VAPID_PUBLIC_KEY` e o segredo de função `VAPID_PUBLIC_KEY` devem conter **exatamente o mesmo valor** — um é lido pelo navegador, o outro pelo `push-agent` para assinar.
- Todo SQL novo segue o estilo já usado em `supabase/migrations/`: `security definer`, `set search_path = public`, `revoke all ... from public, anon, authenticated` nas funções que não são chamadas diretamente por um client autenticado.
- Sem `vite-plugin-pwa`/workbox nesta rodada — o service worker só trata `push` e `notificationclick`, sem cache de assets.
- Sem parâmetro de filtro por perfil na URL de `/pipeline` ou `/curadoria` — nenhuma das duas rotas lê isso hoje e não faz parte deste plano.
- Verificação nesta base: `npx tsc --noEmit`, `npm run lint`, `npm run build` — não há test runner configurado (sem `vitest`/`jest`).

---

## Task 1: Esquema — `push_subscriptions`, `push_notificacoes_pendentes`, intenção em `conta_membros`

**Files:**
- Create: `supabase/migrations/20260910150000_push_schema.sql`

**Interfaces:**
- Produces: tabela `public.push_subscriptions(id, user_id, endpoint, p256dh, auth_key, criado_em, ultimo_uso_em)`; tabela `public.push_notificacoes_pendentes(id, conta_id, perfil_id, tipo, contagem, primeiro_evento_em, ultimo_evento_em, enviado_em)` com índice único parcial `(perfil_id, tipo) WHERE enviado_em IS NULL`; coluna `public.conta_membros.quer_notificacoes boolean`.

- [ ] **Step 1: Escrever a migration**

```sql
-- Inscrições de push por dispositivo/navegador, uma por usuário autenticado.
create table public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  endpoint text not null unique,
  p256dh text not null,
  auth_key text not null,
  criado_em timestamptz not null default now(),
  ultimo_uso_em timestamptz
);

grant select, insert, update, delete on public.push_subscriptions to authenticated;
grant all on public.push_subscriptions to service_role;
alter table public.push_subscriptions enable row level security;

create policy "usuario gerencia as proprias inscricoes push" on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index idx_push_subscriptions_user on public.push_subscriptions(user_id);

-- Fila de agregação: um "lote aberto" por perfil + tipo de notificação.
-- Enquanto enviado_em for nulo, novos eventos incrementam o mesmo lote em vez
-- de criar um novo (ver o índice único parcial abaixo).
create table public.push_notificacoes_pendentes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references public.contas(id) on delete cascade,
  perfil_id uuid not null references public.perfis(id) on delete cascade,
  tipo text not null check (tipo in ('curadoria_pronta', 'pautas_prontas')),
  contagem integer not null default 1,
  primeiro_evento_em timestamptz not null default now(),
  ultimo_evento_em timestamptz not null default now(),
  enviado_em timestamptz
);

grant select on public.push_notificacoes_pendentes to authenticated;
grant all on public.push_notificacoes_pendentes to service_role;
alter table public.push_notificacoes_pendentes enable row level security;

create policy "membros da conta leem suas notificacoes pendentes" on public.push_notificacoes_pendentes
  for select to authenticated
  using (
    exists (
      select 1 from public.conta_membros cm
      where cm.conta_id = push_notificacoes_pendentes.conta_id
        and cm.user_id = auth.uid()
    )
  );

create unique index idx_push_pendentes_lote_aberto
  on public.push_notificacoes_pendentes (perfil_id, tipo)
  where enviado_em is null;

create index idx_push_pendentes_conta on public.push_notificacoes_pendentes(conta_id);

-- Intenção de receber notificações: existe separada da inscrição real porque
-- no iOS o convite acontece antes de o app estar instalado — o usuário pode
-- "querer" notificações antes de ser tecnicamente possível inscrevê-lo.
alter table public.conta_membros add column quer_notificacoes boolean not null default false;

-- Grant de coluna, não de tabela: o membro só pode alterar a própria
-- intenção de notificação, nunca papel/conta_id/user_id da própria linha.
grant update (quer_notificacoes) on public.conta_membros to authenticated;

create policy "membro atualiza a propria intencao de notificacao" on public.conta_membros
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
```

- [ ] **Step 2: Aplicar a migration e verificar**

Run: `supabase db push`

Verify (via `execute_sql` do MCP do Supabase, ou `supabase db execute --linked` com o SQL abaixo):

```sql
select
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'push_subscriptions') as t1,
  (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'push_notificacoes_pendentes') as t2,
  (select count(*) from information_schema.columns where table_schema = 'public' and table_name = 'conta_membros' and column_name = 'quer_notificacoes') as t3;
```

Expected: `t1 = 1`, `t2 = 1`, `t3 = 1`.

- [ ] **Step 3: Confirmar que o índice único parcial rejeita duplicata de lote aberto**

```sql
insert into public.push_notificacoes_pendentes (conta_id, perfil_id, tipo)
select id, (select id from public.perfis limit 1), 'pautas_prontas' from public.contas limit 1;

insert into public.push_notificacoes_pendentes (conta_id, perfil_id, tipo)
select id, (select id from public.perfis limit 1), 'pautas_prontas' from public.contas limit 1;
```

Expected: a segunda inserção falha com `duplicate key value violates unique constraint "idx_push_pendentes_lote_aberto"`. Depois, limpe a linha de teste:

```sql
delete from public.push_notificacoes_pendentes where tipo = 'pautas_prontas' and enviado_em is null;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260910150000_push_schema.sql
git commit -m "feat(push): esquema de inscricoes push e fila de notificacoes pendentes"
```

---

## Task 2: Gerar chaves VAPID e configurar segredos

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

**Interfaces:**
- Produces: variável `VITE_VAPID_PUBLIC_KEY` documentada em `.env.example`; instrução de `supabase secrets set` documentada no `README.md`. Task 4 (`push-agent`) consome `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` via `Deno.env.get`. Task 5 consome `import.meta.env.VITE_VAPID_PUBLIC_KEY` no cliente.

- [ ] **Step 1: Gerar o par de chaves**

Run: `npx web-push generate-vapid-keys`

Expected (saída real, guarde os dois valores — não commitar em nenhum arquivo):

```
=======================================

Public Key:
BN...(uma string base64url longa)...

Private Key:
k...(outra string base64url)...

=======================================
```

- [ ] **Step 2: Configurar os segredos de Edge Function no projeto Supabase**

Run:

```sh
supabase secrets set VAPID_PUBLIC_KEY="<a chave publica gerada>"
supabase secrets set VAPID_PRIVATE_KEY="<a chave privada gerada>"
supabase secrets set VAPID_SUBJECT="mailto:contato@previa.app"
```

Verify: `supabase secrets list` deve listar `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` e `VAPID_SUBJECT` (os valores não aparecem, só os nomes).

- [ ] **Step 3: Adicionar a chave pública ao `.env.example` e ao `.env.local` local**

```1:12:.env.example
# Copie para .env.local e preencha. Nunca versione valores reais.

# Projeto Supabase (Project Settings > API)
SUPABASE_PROJECT_ID=""
SUPABASE_URL="https://<ref>.supabase.co"
SUPABASE_PUBLISHABLE_KEY=""

# Mesmas credenciais expostas ao bundle do cliente (injetadas em build-time pelo Vite)
VITE_SUPABASE_PROJECT_ID=""
VITE_SUPABASE_URL="https://<ref>.supabase.co"
VITE_SUPABASE_PUBLISHABLE_KEY=""
```

Adicione, logo depois do bloco `VITE_SUPABASE_PUBLISHABLE_KEY=""`:

```env
# Web Push — a mesma chave pública gerada por "npx web-push generate-vapid-keys",
# também configurada como segredo VAPID_PUBLIC_KEY nas Edge Functions.
VITE_VAPID_PUBLIC_KEY=""
```

Depois, edite seu `.env.local` (não versionado) com o valor real da chave pública gerada no Step 1.

- [ ] **Step 4: Documentar no README**

Em `README.md`, depois do bloco que já documenta os segredos do Vault (`agent_base_url`, `agent_apikey`, `agent_internal_secret`), adicione:

```markdown
Notificações push usam um par de chaves VAPID, gerado uma única vez com
`npx web-push generate-vapid-keys` e configurado como segredo de Edge Function
(nunca Vault, nunca committed):

\`\`\`sh
supabase secrets set VAPID_PUBLIC_KEY="<chave pública>"
supabase secrets set VAPID_PRIVATE_KEY="<chave privada>"
supabase secrets set VAPID_SUBJECT="mailto:contato@previa.app"
\`\`\`

A mesma chave pública também vai em `VITE_VAPID_PUBLIC_KEY` (`.env.local`), pois o
navegador precisa dela para `pushManager.subscribe()`.
```

- [ ] **Step 5: Commit**

```bash
git add .env.example README.md
git commit -m "docs(push): documenta geracao e configuracao das chaves VAPID"
```

---

## Task 3: Triggers de fila e função de despacho + cron

**Files:**
- Create: `supabase/migrations/20260910151000_push_despacho.sql`

**Interfaces:**
- Consumes: tabelas da Task 1 (`push_notificacoes_pendentes`); funções já existentes `public.agent_function_url(text)` e `public.agent_internal_headers()`.
- Produces: função `public.enfileirar_notificacao_push(p_perfil_id uuid, p_conta_id uuid, p_tipo text)`; trigger `on_conteudo_curado_notificar` em `conteudos_curados`; trigger `on_pauta_aguardando_aprovacao_notificar` em `pautas_geradas`; função `public.despachar_notificacoes_pendentes(p_forcar boolean default false)`; dois cron jobs (`despachar-notificacoes-push`, `forcar-notificacoes-push-noturnas`). Task 4 (`push-agent`) é invocado por `despachar_notificacoes_pendentes` recebendo `{ queue_id }` no corpo.

- [ ] **Step 1: Escrever a migration**

```sql
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
```

- [ ] **Step 2: Aplicar e verificar os triggers manualmente (sem depender do `push-agent`, que ainda não existe)**

Run: `supabase db push`

Verify — insira uma curadoria de teste e confirme que a fila recebeu o lote (troque os UUIDs pelos de uma conta/perfil/referência reais do seu ambiente):

```sql
-- Descubra uma referência de teste vinculada a um perfil:
select pr.id as perfil_referencia_id, pr.perfil_id_relacionado, p.conta_id
from public.perfis_referencia pr
join public.perfis p on p.id = pr.perfil_id_relacionado
limit 1;

-- Insira uma curadoria de teste usando os IDs acima:
insert into public.conteudos_curados (perfil_referencia_id, conta_id, url, formato, tema)
values ('<perfil_referencia_id>', '<conta_id>', 'https://teste.local', 'texto', 'teste de notificação');

-- Confirme que caiu na fila:
select tipo, contagem, enviado_em from public.push_notificacoes_pendentes
where perfil_id = '<perfil_id_relacionado>' and tipo = 'curadoria_pronta';
```

Expected: uma linha com `tipo = 'curadoria_pronta'`, `contagem = 1`, `enviado_em` nulo.

- [ ] **Step 3: Confirmar a agregação — inserir uma segunda curadoria do mesmo perfil**

```sql
insert into public.conteudos_curados (perfil_referencia_id, conta_id, url, formato, tema)
values ('<perfil_referencia_id>', '<conta_id>', 'https://teste2.local', 'texto', 'segundo teste');

select tipo, contagem from public.push_notificacoes_pendentes
where perfil_id = '<perfil_id_relacionado>' and tipo = 'curadoria_pronta';
```

Expected: ainda uma única linha, agora com `contagem = 2` (não duas linhas).

- [ ] **Step 4: Limpar os dados de teste**

```sql
delete from public.conteudos_curados where url in ('https://teste.local', 'https://teste2.local');
delete from public.push_notificacoes_pendentes where tipo = 'curadoria_pronta' and enviado_em is null;
```

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/20260910151000_push_despacho.sql
git commit -m "feat(push): triggers de fila, despacho por silencio e fallback noturno"
```

---

## Task 4: Edge function `push-agent`

**Files:**
- Create: `supabase/functions/push-agent/index.ts`

**Interfaces:**
- Consumes: `requireAgentAuth`, `corsHeaders`, `getServiceClient`, `formatAgentError` de `../_shared/agent-utils.ts`; segredos `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (Task 2); tabelas `push_notificacoes_pendentes`, `perfis`, `conta_membros`, `push_subscriptions` (Task 1).
- Produces: endpoint `POST /functions/v1/push-agent` com corpo `{ queue_id: string }`, chamado por `despachar_notificacoes_pendentes` (Task 3) e pela ação de teste do admin (Task 9).

- [ ] **Step 1: Escrever a edge function**

```ts
// push-agent: envia Web Push para todos os membros da conta de um lote da
// fila de notificações. Chamado pelo cron de despacho (fire-and-forget) e,
// manualmente, pela ação "Enviar notificação de teste" do admin.
import webpush from "npm:web-push@3.6.7";
import {
  corsHeaders,
  formatAgentError,
  getServiceClient,
  requireAgentAuth,
} from "../_shared/agent-utils.ts";

function montarMensagem(tipo: string, nome: string, contagem: number) {
  if (tipo === "curadoria_pronta") {
    return {
      titulo: "prevIA",
      corpo: `Bom dia, ${nome}! A curadoria de hoje já está pronta pra você aprovar.`,
    };
  }
  if (contagem <= 1) {
    return {
      titulo: "prevIA",
      corpo: `${nome}, 1 pauta nova está esperando sua aprovação na prevIA.`,
    };
  }
  return {
    titulo: "prevIA",
    corpo: `${nome}, ${contagem} pautas novas estão esperando sua aprovação na prevIA.`,
  };
}

function destino(tipo: string): string {
  return tipo === "curadoria_pronta" ? "/curadoria" : "/pipeline";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  try {
    const { queue_id } = await req.json();
    if (!queue_id) {
      return new Response(JSON.stringify({ ok: false, error: "queue_id obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const vapidPublicKey = Deno.env.get("VAPID_PUBLIC_KEY");
    const vapidPrivateKey = Deno.env.get("VAPID_PRIVATE_KEY");
    const vapidSubject = Deno.env.get("VAPID_SUBJECT");
    if (!vapidPublicKey || !vapidPrivateKey || !vapidSubject) {
      throw new Error("VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY ou VAPID_SUBJECT ausente no ambiente.");
    }
    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

    const supabase = getServiceClient();

    const { data: lote, error: erroLote } = await supabase
      .from("push_notificacoes_pendentes")
      .select("id, conta_id, perfil_id, tipo, contagem")
      .eq("id", queue_id)
      .single();
    if (erroLote || !lote) {
      return new Response(JSON.stringify({ ok: false, error: "Lote não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: perfil } = await supabase
      .from("perfis")
      .select("nome")
      .eq("id", lote.perfil_id)
      .maybeSingle();
    const nome = perfil?.nome ?? "";

    const { data: membros } = await supabase
      .from("conta_membros")
      .select("user_id")
      .eq("conta_id", lote.conta_id);

    const userIds = (membros ?? []).map((m) => m.user_id);
    if (userIds.length === 0) {
      return new Response(JSON.stringify({ ok: true, enviadas: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: inscricoes } = await supabase
      .from("push_subscriptions")
      .select("id, endpoint, p256dh, auth_key")
      .in("user_id", userIds);

    const { titulo, corpo } = montarMensagem(lote.tipo, nome, lote.contagem);
    const payload = JSON.stringify({
      title: titulo,
      body: corpo,
      url: destino(lote.tipo),
    });

    let enviadas = 0;
    for (const inscricao of inscricoes ?? []) {
      try {
        await webpush.sendNotification(
          {
            endpoint: inscricao.endpoint,
            keys: { p256dh: inscricao.p256dh, auth: inscricao.auth_key },
          },
          payload,
        );
        enviadas++;
        await supabase
          .from("push_subscriptions")
          .update({ ultimo_uso_em: new Date().toISOString() })
          .eq("id", inscricao.id);
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await supabase.from("push_subscriptions").delete().eq("id", inscricao.id);
        } else {
          console.error("push-agent: falha ao enviar", inscricao.id, e);
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, enviadas }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error(e);
    return new Response(JSON.stringify({ ok: false, error: formatAgentError(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
```

- [ ] **Step 2: Deploy**

Run: `supabase functions deploy push-agent`

Expected: saída confirmando o deploy sem erro (`Deployed Functions on project <ref>: push-agent`).

- [ ] **Step 3: Testar isoladamente com o header interno**

Crie um lote de teste na fila (troque os IDs pelos de uma conta/perfil reais do seu ambiente):

```sql
insert into public.push_notificacoes_pendentes (conta_id, perfil_id, tipo, contagem)
values ('<conta_id>', '<perfil_id>', 'pautas_prontas', 1)
returning id;
```

Guarde o `id` retornado e invoque a function diretamente (troque `<queue_id>`, `<project-ref>` e `<agent_internal_secret>` pelos valores reais — o segredo é o mesmo lido por `public.agent_secret('agent_internal_secret')`):

```sh
curl -i -X POST "https://<project-ref>.supabase.co/functions/v1/push-agent" \
  -H "Content-Type: application/json" \
  -H "x-agent-secret: <agent_internal_secret>" \
  -H "apikey: <publishable key>" \
  -d '{"queue_id":"<queue_id retornado pelo insert acima>"}'
```

Expected: `HTTP/2 200` e corpo `{"ok":true,"enviadas":0}` (sem inscrições cadastradas ainda, é esperado `enviadas: 0`).

Limpe o lote de teste:

```sql
delete from public.push_notificacoes_pendentes where tipo = 'pautas_prontas' and contagem = 1 and enviado_em is null;
```

- [ ] **Step 4: Commit**

```bash
git add supabase/functions/push-agent/index.ts
git commit -m "feat(push): edge function push-agent envia Web Push via VAPID"
```

---

## Task 5: Casca do PWA — manifest, ícones e service worker

**Files:**
- Create: `src/assets/pwa/icon-source.png`
- Create: `scripts/gerar-icones-pwa.mjs`
- Create: `public/manifest.webmanifest`
- Create: `public/sw.js`
- Modify: `package.json`
- Modify: `src/routes/__root.tsx`

**Interfaces:**
- Produces: `public/icon-192.png`, `public/icon-512.png`, `public/icon-maskable-512.png` (gerados pelo script); `<link rel="manifest">` e registro do service worker, consumidos pelas Tasks 6-8.

- [ ] **Step 1: Copiar o ícone-fonte gerado para o repositório**

Run:

```sh
mkdir -p src/assets/pwa
cp "C:\Users\Teletrabalho\.cursor\projects\c-Users-Teletrabalho-Desktop-tractus-sparkle\assets\app-icon-source.png" src/assets/pwa/icon-source.png
```

(No PowerShell, use `Copy-Item` em vez de `cp` se necessário.)

- [ ] **Step 2: Adicionar `sharp` como devDependency**

Run: `npm install --save-dev sharp`

- [ ] **Step 3: Escrever o script de geração dos ícones**

```javascript
// Gera os ícones do manifest a partir de src/assets/pwa/icon-source.png.
// Roda uma vez (ou sempre que o ícone-fonte mudar) — não faz parte do build.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const origem = path.resolve(__dirname, "../src/assets/pwa/icon-source.png");
const destino = path.resolve(__dirname, "../public");

const tamanhos = [
  { nome: "icon-192.png", tamanho: 192 },
  { nome: "icon-512.png", tamanho: 512 },
];

for (const { nome, tamanho } of tamanhos) {
  await sharp(origem).resize(tamanho, tamanho).png().toFile(path.join(destino, nome));
  console.log(`Gerado ${nome}`);
}

// Maskable: 80% de área segura no centro (o SO pode recortar em círculo/squircle),
// preenchendo a margem com o mesmo amarelo do ícone-fonte.
await sharp(origem)
  .resize(410, 410)
  .extend({ top: 51, bottom: 51, left: 51, right: 51, background: "#F4DB0B" })
  .png()
  .toFile(path.join(destino, "icon-maskable-512.png"));
console.log("Gerado icon-maskable-512.png");
```

- [ ] **Step 4: Rodar o script e verificar a saída**

Run: `node scripts/gerar-icones-pwa.mjs`

Expected:
```
Gerado icon-192.png
Gerado icon-512.png
Gerado icon-maskable-512.png
```

Verify: `public/icon-192.png`, `public/icon-512.png` e `public/icon-maskable-512.png` existem e abrem como imagem 192×192, 512×512 e 512×512 respectivamente.

- [ ] **Step 5: Escrever o manifest**

```json
{
  "name": "prevIA - CONTENT",
  "short_name": "prevIA",
  "description": "Pipeline de produção de conteúdo com curadoria humana e agentes de IA.",
  "start_url": "/pipeline",
  "scope": "/",
  "display": "standalone",
  "background_color": "#FFFFFF",
  "theme_color": "#F4DB0B",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" },
    { "src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
  ]
}
```

- [ ] **Step 6: Escrever o service worker**

```javascript
// Service worker enxuto: só trata push e o clique na notificação.
// Sem cache de assets/offline nesta rodada.
self.addEventListener("push", (event) => {
  let dados = { title: "prevIA", body: "Você tem novidades.", url: "/pipeline" };
  try {
    if (event.data) dados = { ...dados, ...event.data.json() };
  } catch {
    // corpo não veio em JSON — mantém o padrão.
  }

  event.waitUntil(
    self.registration.showNotification(dados.title, {
      body: dados.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: dados.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/pipeline";

  event.waitUntil(
    (async () => {
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of clients) {
        if (client.url.includes(url) && "focus" in client) return client.focus();
      }
      if (clients.length > 0 && "focus" in clients[0]) {
        await clients[0].focus();
        return clients[0].navigate ? clients[0].navigate(url) : undefined;
      }
      return self.clients.openWindow(url);
    })(),
  );
});
```

- [ ] **Step 7: Ligar o manifest e o theme-color no `__root.tsx`**

Modifique o `head` da rota raiz:

```10:19:src/routes/__root.tsx
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "prevIA - CONTENT" },
      { name: "description", content: "Pipeline de produção de conteúdo com curadoria humana e agentes de IA." },
      { property: "og:title", content: "prevIA - CONTENT" },
```

Adicione, logo abaixo da meta `viewport`:

```typescript
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "theme-color", content: "#F4DB0B" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "prevIA" },
```

E, no bloco `links`, adicione o manifest logo depois do `favicon.png`:

```89:92:src/routes/__root.tsx
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      {
```

Fica:

```typescript
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-192.png" },
      {
```

- [ ] **Step 8: Registrar o service worker no client, dentro do `RootComponent`**

```115:133:src/routes/__root.tsx
function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => data.subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster />
    </QueryClientProvider>
  );
}
```

Adicione um segundo `useEffect` de registro, sem interferir no existente:

```typescript
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch((e) => {
        console.error("Falha ao registrar o service worker", e);
      });
    }
  }, []);
```

- [ ] **Step 9: Verificar**

Run: `npx tsc --noEmit && npm run build`

Expected: os dois comandos terminam sem erro. Depois, com `npm run dev` de pé, abra o DevTools → Application → Manifest e confirme que o manifest carrega sem erro e que `Service Workers` mostra `sw.js` ativado.

- [ ] **Step 10: Commit**

```bash
git add src/assets/pwa/icon-source.png scripts/gerar-icones-pwa.mjs public/manifest.webmanifest public/sw.js public/icon-192.png public/icon-512.png public/icon-maskable-512.png package.json package-lock.json src/routes/__root.tsx
git commit -m "feat(pwa): manifest, icones, service worker e registro no root"
```

---

## Task 6: Cliente de push — detecção de plataforma, inscrição e intenção

**Files:**
- Create: `src/lib/push-client.ts`

**Interfaces:**
- Consumes: `supabase` de `@/integrations/supabase/client`; `VITE_VAPID_PUBLIC_KEY` (Task 2); tabelas `push_subscriptions`, `conta_membros.quer_notificacoes` (Task 1).
- Produces: `suportaPush()`, `estaInstalado()`, `ehIOS()`, `ouvirPromptInstalacao(cb)`, `instalarApp()`, `ativarNotificacoes()`, `registrarIntencaoNotificacoes()`, `temInscricaoAtiva()` — consumidos pelas Tasks 7 e 8.

- [ ] **Step 1: Escrever o módulo**

```typescript
// Cliente-only: usa window/navigator diretamente, nunca importar em código
// que roda no servidor (server functions, *.server.ts).
import { supabase } from "@/integrations/supabase/client";

export function suportaPush(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function estaInstalado(): boolean {
  if (typeof window === "undefined") return false;
  const standaloneIOS = (navigator as unknown as { standalone?: boolean }).standalone === true;
  return window.matchMedia("(display-mode: standalone)").matches || standaloneIOS;
}

export function ehIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

type EventoInstalacao = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let promptInstalacao: EventoInstalacao | null = null;

/** Ouve o beforeinstallprompt do Chrome/Edge. Retorna a função de limpeza. */
export function ouvirPromptInstalacao(cb: (disponivel: boolean) => void): () => void {
  const handler = (e: Event) => {
    e.preventDefault();
    promptInstalacao = e as EventoInstalacao;
    cb(true);
  };
  window.addEventListener("beforeinstallprompt", handler);
  return () => window.removeEventListener("beforeinstallprompt", handler);
}

/** Dispara o prompt nativo de instalação. Retorna false se não houver prompt disponível. */
export async function instalarApp(): Promise<boolean> {
  if (!promptInstalacao) return false;
  await promptInstalacao.prompt();
  const escolha = await promptInstalacao.userChoice;
  promptInstalacao = null;
  return escolha.outcome === "accepted";
}

function urlBase64ParaUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalizado = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalizado);
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
}

/** Pede a permissão de notificação e, se concedida, inscreve o navegador. */
export async function ativarNotificacoes(): Promise<{ ok: boolean; erro?: string }> {
  if (!suportaPush()) {
    return { ok: false, erro: "Este navegador não suporta notificações." };
  }

  const permissao = await Notification.requestPermission();
  if (permissao !== "granted") {
    return { ok: false, erro: "Permissão de notificação não concedida." };
  }

  const chavePublica = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
  if (!chavePublica) {
    return { ok: false, erro: "Configuração de notificação ausente (VITE_VAPID_PUBLIC_KEY)." };
  }

  const registro = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;

  const existente = await registro.pushManager.getSubscription();
  const inscricao =
    existente ??
    (await registro.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ParaUint8Array(chavePublica),
    }));

  const chaves = inscricao.toJSON().keys;
  if (!chaves?.p256dh || !chaves?.auth) {
    return { ok: false, erro: "Não foi possível ler as chaves da inscrição." };
  }

  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return { ok: false, erro: "Sessão expirada." };

  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: sessao.user.id,
      endpoint: inscricao.endpoint,
      p256dh: chaves.p256dh,
      auth_key: chaves.auth,
      ultimo_uso_em: new Date().toISOString(),
    },
    { onConflict: "endpoint" },
  );
  if (error) return { ok: false, erro: error.message };

  return { ok: true };
}

/**
 * Marca a intenção de receber notificações mesmo antes de existir uma
 * inscrição real — no iOS, o convite acontece antes do app estar instalado.
 */
export async function registrarIntencaoNotificacoes(): Promise<void> {
  const { data: sessao } = await supabase.auth.getUser();
  if (!sessao.user) return;
  await supabase
    .from("conta_membros")
    .update({ quer_notificacoes: true })
    .eq("user_id", sessao.user.id);
}

/** Já existe inscrição ativa neste navegador para o usuário logado? */
export async function temInscricaoAtiva(): Promise<boolean> {
  if (!suportaPush()) return false;
  const registro = await navigator.serviceWorker.getRegistration("/sw.js");
  if (!registro) return false;
  const inscricao = await registro.pushManager.getSubscription();
  return !!inscricao;
}
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`

Expected: sem erros novos relacionados a `src/lib/push-client.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/push-client.ts
git commit -m "feat(push): cliente de inscricao, deteccao de plataforma e intencao"
```

---

## Task 7: Tipos do Supabase — `push_subscriptions`, `push_notificacoes_pendentes`, `conta_membros.quer_notificacoes`

**Files:**
- Modify: `src/integrations/supabase/types.ts`

**Interfaces:**
- Produces: tipos `Database["public"]["Tables"]["push_subscriptions"]`, `Database["public"]["Tables"]["push_notificacoes_pendentes"]`, e o campo `quer_notificacoes` em `Database["public"]["Tables"]["conta_membros"]` — usados pelas Tasks 6, 8 e 9 sem precisar de `as any`.

- [ ] **Step 1: Adicionar `quer_notificacoes` a `conta_membros`**

```251:272:src/integrations/supabase/types.ts
      conta_membros: {
        Row: {
          conta_id: string
          criado_em: string
          id: string
          papel: string
          user_id: string
        }
        Insert: {
          conta_id: string
          criado_em?: string
          id?: string
          papel?: string
          user_id: string
        }
        Update: {
          conta_id?: string
          criado_em?: string
          id?: string
          papel?: string
          user_id?: string
        }
```

Substitua por:

```typescript
      conta_membros: {
        Row: {
          conta_id: string
          criado_em: string
          id: string
          papel: string
          quer_notificacoes: boolean
          user_id: string
        }
        Insert: {
          conta_id: string
          criado_em?: string
          id?: string
          papel?: string
          quer_notificacoes?: boolean
          user_id: string
        }
        Update: {
          conta_id?: string
          criado_em?: string
          id?: string
          papel?: string
          quer_notificacoes?: boolean
          user_id?: string
        }
```

- [ ] **Step 2: Inserir `push_notificacoes_pendentes` e `push_subscriptions` em ordem alfabética, entre `publicacoes` e `referencias_sugeridas`**

```944:957:src/integrations/supabase/types.ts
          {
            foreignKeyName: "publicacoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      referencias_sugeridas: {
```

Substitua por:

```typescript
          {
            foreignKeyName: "publicacoes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      push_notificacoes_pendentes: {
        Row: {
          conta_id: string
          contagem: number
          enviado_em: string | null
          id: string
          perfil_id: string
          primeiro_evento_em: string
          tipo: string
          ultimo_evento_em: string
        }
        Insert: {
          conta_id: string
          contagem?: number
          enviado_em?: string | null
          id?: string
          perfil_id: string
          primeiro_evento_em?: string
          tipo: string
          ultimo_evento_em?: string
        }
        Update: {
          conta_id?: string
          contagem?: number
          enviado_em?: string | null
          id?: string
          perfil_id?: string
          primeiro_evento_em?: string
          tipo?: string
          ultimo_evento_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_notificacoes_pendentes_conta_id_fkey"
            columns: ["conta_id"]
            isOneToOne: false
            referencedRelation: "contas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "push_notificacoes_pendentes_perfil_id_fkey"
            columns: ["perfil_id"]
            isOneToOne: false
            referencedRelation: "perfis"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth_key: string
          criado_em: string
          endpoint: string
          id: string
          p256dh: string
          ultimo_uso_em: string | null
          user_id: string
        }
        Insert: {
          auth_key: string
          criado_em?: string
          endpoint: string
          id?: string
          p256dh: string
          ultimo_uso_em?: string | null
          user_id: string
        }
        Update: {
          auth_key?: string
          criado_em?: string
          endpoint?: string
          id?: string
          p256dh?: string
          ultimo_uso_em?: string | null
          user_id?: string
        }
        Relationships: []
      }
      referencias_sugeridas: {
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`

Expected: sem erros de tipo.

- [ ] **Step 4: Commit**

```bash
git add src/integrations/supabase/types.ts
git commit -m "chore(types): adiciona tipos das tabelas de push e quer_notificacoes"
```

---

## Task 8: Card de convite pós-DNA (`ConvitePush`)

**Files:**
- Create: `src/components/notificacoes/ConvitePush.tsx`
- Modify: `src/routes/_authenticated/dna.tsx`

**Interfaces:**
- Consumes: `suportaPush`, `estaInstalado`, `ehIOS`, `ouvirPromptInstalacao`, `instalarApp`, `ativarNotificacoes`, `registrarIntencaoNotificacoes`, `temInscricaoAtiva` (Task 6).
- Produces: componente `<ConvitePush />`, montado dentro do bloco `{novo && (...)}` de `/dna` — o pico de interesse do onboarding.

- [ ] **Step 1: Escrever o componente**

```typescript
import { useEffect, useState } from "react";
import { Bell, Check, Share } from "lucide-react";
import {
  ativarNotificacoes,
  ehIOS,
  estaInstalado,
  instalarApp,
  ouvirPromptInstalacao,
  registrarIntencaoNotificacoes,
  suportaPush,
  temInscricaoAtiva,
} from "@/lib/push-client";

type Estado =
  | "carregando"
  | "ja_ativo"
  | "nao_suportado"
  | "ios_instalar"
  | "pedir_permissao"
  | "dispensado";

/**
 * Convite para instalar/permitir notificações, mostrado uma vez, no pico de
 * interesse do onboarding (fim do relatório de DNA). Some quando dispensado
 * ou já resolvido — quem quiser ativar depois usa o sininho no cabeçalho.
 */
export function ConvitePush() {
  const [estado, setEstado] = useState<Estado>("carregando");
  const [podeInstalarNativo, setPodeInstalarNativo] = useState(false);
  const [carregandoAcao, setCarregandoAcao] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!suportaPush() && !ehIOS()) {
      setEstado("nao_suportado");
      return;
    }

    temInscricaoAtiva().then((ativo) => {
      if (ativo) {
        setEstado("ja_ativo");
        return;
      }
      if (ehIOS() && !estaInstalado()) {
        setEstado("ios_instalar");
        return;
      }
      setEstado("pedir_permissao");
    });

    return ouvirPromptInstalacao(setPodeInstalarNativo);
  }, []);

  async function aoClicarInstalarOuPermitir() {
    setCarregandoAcao(true);
    setErro(null);
    try {
      if (podeInstalarNativo && !estaInstalado()) {
        await instalarApp();
      }
      const resultado = await ativarNotificacoes();
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível ativar as notificações.");
        return;
      }
      setEstado("ja_ativo");
    } finally {
      setCarregandoAcao(false);
    }
  }

  async function aoConfirmarIntencaoIOS() {
    await registrarIntencaoNotificacoes();
    setEstado("dispensado");
  }

  if (estado === "carregando" || estado === "nao_suportado" || estado === "ja_ativo" || estado === "dispensado") {
    return null;
  }

  return (
    <div data-print-hide className="mb-10 rounded-lg border border-border bg-surface p-5 sm:p-6">
      <div className="flex items-center gap-3">
        <Bell className="h-4 w-4 text-primary" />
        <span className="text-sm text-muted-foreground">Quer ser avisado quando algo estiver pronto?</span>
      </div>

      {estado === "pedir_permissao" && (
        <>
          <p className="mt-3 text-base leading-relaxed">
            Avisamos quando a curadoria e as pautas estiverem prontas pra você aprovar — sem precisar
            ficar checando o app.
          </p>
          <button
            type="button"
            onClick={aoClicarInstalarOuPermitir}
            disabled={carregandoAcao}
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-base
              font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <Check className="h-4 w-4" /> Ativar notificações
          </button>
        </>
      )}

      {estado === "ios_instalar" && (
        <>
          <p className="mt-3 text-base leading-relaxed">
            No iPhone, para receber notificações, primeiro adicione a prevIA à tela de início:
          </p>
          <ol className="mt-3 space-y-1.5 text-base leading-relaxed">
            <li className="flex gap-2.5">
              <Share className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> Toque em Compartilhar,
              na barra do Safari
            </li>
            <li className="flex gap-2.5">
              <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
              Depois, toque em "Adicionar à Tela de Início"
            </li>
          </ol>
          <button
            type="button"
            onClick={aoConfirmarIntencaoIOS}
            className="mt-5 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm
              transition hover:border-foreground/30 focus-visible:outline-none focus-visible:ring-2
              focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Já instalei, entendi
          </button>
        </>
      )}

      {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
    </div>
  );
}
```

- [ ] **Step 2: Montar no `/dna`, dentro do bloco `{novo && (...)}`**

```110:134:src/routes/_authenticated/dna.tsx
    <div className="mx-auto max-w-3xl px-5 py-8 sm:px-10 sm:py-12" data-print-root>
      {novo && (
        <div
          data-print-hide
          className="mb-10 rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-primary" />
            <span className="text-sm text-muted-foreground">Seu manual está pronto</span>
          </div>
          <p className="mt-3 text-base leading-relaxed">
            Baixe e guarde este documento. Enquanto você lê, a prevIA está lendo os perfis que
            você indicou — a primeira curadoria aparece em alguns minutos.
          </p>
          <Link
            to="/curadoria"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-base
              font-medium text-primary-foreground transition hover:bg-primary/90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Ir para a curadoria <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}
```

Adicione `<ConvitePush />` como bloco irmão, fora do `{novo && ...}` — o convite deve aparecer mesmo que o usuário volte à página depois, não só na primeira renderização. Adicione imediatamente depois do `)}` que fecha o bloco `{novo && (...)}` (o conteúdo interno do bloco `{novo && (...)}` em si não muda, veja o trecho citado no Step 2):

```typescript
      {novo && (
        <div
          data-print-hide
          className="mb-10 rounded-lg border border-border bg-surface p-5 sm:p-6"
        >
          <div className="flex items-center gap-3">
            <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-primary" />
            <span className="text-sm text-muted-foreground">Seu manual está pronto</span>
          </div>
          <p className="mt-3 text-base leading-relaxed">
            Baixe e guarde este documento. Enquanto você lê, a prevIA está lendo os perfis que
            você indicou — a primeira curadoria aparece em alguns minutos.
          </p>
          <Link
            to="/curadoria"
            className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-base
              font-medium text-primary-foreground transition hover:bg-primary/90
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
              focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Ir para a curadoria <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      )}

      <ConvitePush />

      <header className="border-b border-border pb-8">
```

E adicione o import no topo do arquivo:

```typescript
import { getDna, regerarDna } from "@/lib/onboarding.functions";
import { ConvitePush } from "@/components/notificacoes/ConvitePush";
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit && npm run build`

Expected: sem erros. Depois, com `npm run dev`, abra `/dna?novo=true` logado numa conta com relatório gerado e confirme que o card aparece abaixo do aviso "Seu manual está pronto".

- [ ] **Step 4: Commit**

```bash
git add src/components/notificacoes/ConvitePush.tsx src/routes/_authenticated/dna.tsx
git commit -m "feat(push): card de convite para instalar e ativar notificacoes em /dna"
```

---

## Task 9: Sininho no cabeçalho (ponto de entrada permanente)

**Files:**
- Create: `src/components/notificacoes/SininhoNotificacoes.tsx`
- Modify: `src/routes/_authenticated/route.tsx`

**Interfaces:**
- Consumes: `suportaPush`, `estaInstalado`, `ehIOS`, `ativarNotificacoes`, `registrarIntencaoNotificacoes`, `temInscricaoAtiva` (Task 6); `Dialog`/`DialogContent` de `@/components/ui/dialog` (mesma família de componentes já usada no projeto).
- Produces: componente `<SininhoNotificacoes />`, montado no rodapé da sidebar de `_authenticated/route.tsx`, ao lado do botão de tema.

- [ ] **Step 1: Confirmar a API do componente `Dialog` já usado no projeto**

Run: `rg "DialogTrigger|DialogContent" src/components/ui/dialog.tsx -n`

(Este passo só confirma a assinatura antes de escrever o componente — não é necessário registrar a saída, apenas usar `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle` com a mesma API do restante do projeto.)

- [ ] **Step 2: Escrever o componente**

```typescript
import { useEffect, useState } from "react";
import { Bell, Check, Share } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ativarNotificacoes,
  ehIOS,
  estaInstalado,
  registrarIntencaoNotificacoes,
  suportaPush,
  temInscricaoAtiva,
} from "@/lib/push-client";

/** Ponto de entrada permanente para quem não ativou notificações no onboarding. */
export function SininhoNotificacoes() {
  const [aberto, setAberto] = useState(false);
  const [ativo, setAtivo] = useState<boolean | null>(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [confirmadoIOS, setConfirmadoIOS] = useState(false);

  useEffect(() => {
    temInscricaoAtiva().then(setAtivo);
  }, []);

  if (!suportaPush() && !ehIOS()) return null;
  if (ativo) return null;

  async function aoAtivar() {
    setCarregando(true);
    setErro(null);
    try {
      const resultado = await ativarNotificacoes();
      if (!resultado.ok) {
        setErro(resultado.erro ?? "Não foi possível ativar as notificações.");
        return;
      }
      setAtivo(true);
      setAberto(false);
    } finally {
      setCarregando(false);
    }
  }

  async function aoConfirmarIOS() {
    await registrarIntencaoNotificacoes();
    setConfirmadoIOS(true);
  }

  const precisaInstalarNoIOS = ehIOS() && !estaInstalado();

  return (
    <>
      <button
        type="button"
        onClick={() => setAberto(true)}
        className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground
          hover:text-foreground hover:bg-surface-elevated transition"
      >
        <Bell className="w-4 h-4" />
        Ativar notificações
      </button>

      <Dialog open={aberto} onOpenChange={setAberto}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Notificações</DialogTitle>
          </DialogHeader>

          {precisaInstalarNoIOS ? (
            confirmadoIOS ? (
              <p className="text-sm text-muted-foreground">
                Perfeito — na próxima vez que abrir o app pela tela de início, vamos pedir a permissão.
              </p>
            ) : (
              <>
                <p className="text-sm leading-relaxed">
                  No iPhone, para receber notificações, primeiro adicione a prevIA à tela de início:
                </p>
                <ol className="mt-2 space-y-1.5 text-sm leading-relaxed">
                  <li className="flex gap-2.5">
                    <Share className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /> Toque em
                    Compartilhar, na barra do Safari
                  </li>
                  <li className="flex gap-2.5">
                    <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                    Depois, toque em "Adicionar à Tela de Início"
                  </li>
                </ol>
                <button
                  type="button"
                  onClick={aoConfirmarIOS}
                  className="mt-4 inline-flex items-center gap-2 rounded-md border border-border px-4 py-2
                    text-sm transition hover:border-foreground/30"
                >
                  Já instalei, entendi
                </button>
              </>
            )
          ) : (
            <>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Avisamos quando a curadoria e as pautas estiverem prontas pra você aprovar.
              </p>
              <button
                type="button"
                onClick={aoAtivar}
                disabled={carregando}
                className="mt-4 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm
                  font-medium text-primary-foreground transition hover:bg-primary/90 disabled:opacity-60"
              >
                <Check className="h-4 w-4" /> Ativar notificações
              </button>
            </>
          )}

          {erro && <p className="mt-3 text-sm text-destructive">{erro}</p>}
        </DialogContent>
      </Dialog>
    </>
  );
}
```

- [ ] **Step 3: Montar na sidebar, ao lado do botão de tema**

```135:154:src/routes/_authenticated/route.tsx
      <div className="border-t border-border p-3">
        {email && (
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{email}</div>
        )}
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Tema claro" : "Tema escuro"}
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
```

Substitua por:

```typescript
      <div className="border-t border-border p-3">
        {email && (
          <div className="px-3 py-2 text-xs text-muted-foreground truncate">{email}</div>
        )}
        <SininhoNotificacoes />
        <button
          onClick={toggle}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
        >
          {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          {theme === "dark" ? "Tema claro" : "Tema escuro"}
        </button>
        <button
          onClick={signOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-muted-foreground hover:text-foreground hover:bg-surface-elevated transition"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </div>
```

E adicione o import junto aos outros imports de `route.tsx`:

```typescript
import previaIcon from "@/assets/previa-icon.png.asset.json";
import { SininhoNotificacoes } from "@/components/notificacoes/SininhoNotificacoes";
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run build`

Expected: sem erros. Com `npm run dev`, confirme visualmente que o botão "Ativar notificações" aparece na sidebar acima de "Tema" e que o diálogo abre ao clicar.

- [ ] **Step 5: Commit**

```bash
git add src/components/notificacoes/SininhoNotificacoes.tsx src/routes/_authenticated/route.tsx
git commit -m "feat(push): sininho permanente no cabecalho para ativar notificacoes depois"
```

---

## Task 10: Ação "Enviar notificação de teste" no admin

**Files:**
- Create: `src/lib/notificacoes.functions.ts`
- Modify: `src/lib/agentes.server.ts`
- Modify: `src/routes/_authenticated/admin.tsx`

**Interfaces:**
- Consumes: `invocarAgente` (modificado para aceitar `"push-agent"`); `requireSupabaseAuth`; tabelas `push_subscriptions`, `push_notificacoes_pendentes` (Task 1).
- Produces: server function `enviarNotificacaoTeste()`, exposta como botão na aba "Onboarding" do admin (única aba hoje visível a todo admin sem depender de dados de conta específica).

- [ ] **Step 1: Adicionar `"push-agent"` à lista de agentes permitidos**

```19:28:src/lib/agentes.server.ts
const AGENTES = [
  "curador-agent",
  "ideador-agent",
  "copy-agent",
  "visual-agent",
  "revisor-agent",
  "carrossel-agent",
  "dna-agent",
] as const;
```

Substitua por:

```typescript
const AGENTES = [
  "curador-agent",
  "ideador-agent",
  "copy-agent",
  "visual-agent",
  "revisor-agent",
  "carrossel-agent",
  "dna-agent",
  "push-agent",
] as const;
```

- [ ] **Step 2: Escrever a server function de teste**

```typescript
import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Cria (ou reaproveita) um lote de teste na fila e chama o push-agent na
 * hora, sem esperar o cron — só para o próprio admin confirmar que a
 * configuração de VAPID está funcionando de ponta a ponta.
 */
export const enviarNotificacaoTeste = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { invocarAgente } = await import("@/lib/agentes.server");
    const admin = supabaseAdmin as any;

    const { data: membro } = await context.supabase
      .from("conta_membros")
      .select("conta_id")
      .order("criado_em")
      .limit(1)
      .maybeSingle();
    if (!membro?.conta_id) throw new Error("Seu usuário não está vinculado a nenhuma conta.");

    const { data: perfil } = await admin
      .from("perfis")
      .select("id")
      .eq("conta_id", membro.conta_id)
      .limit(1)
      .maybeSingle();
    if (!perfil?.id) throw new Error("Nenhum perfil encontrado para testar.");

    const { data: lote, error: erroLote } = await admin
      .from("push_notificacoes_pendentes")
      .insert({
        conta_id: membro.conta_id,
        perfil_id: perfil.id,
        tipo: "pautas_prontas",
        contagem: 1,
      })
      .select("id")
      .single();
    if (erroLote) throw new Error(erroLote.message);

    const resposta = await invocarAgente<{ enviadas?: number }>("push-agent", {
      queue_id: lote.id,
    });
    if (!resposta.ok) throw new Error(resposta.erro ?? "push-agent falhou.");

    return { enviadas: resposta.data?.enviadas ?? 0 };
  });
```

- [ ] **Step 3: Adicionar o botão na aba Onboarding do admin**

```20:27:src/routes/_authenticated/admin.tsx
import { useIsPlatformAdmin } from "@/hooks/use-platform-admin";
import {
  getAdminDashboard,
  acaoConta,
  salvarPlano,
  salvarPrecoCusto,
  reprocessarEventoKiwify,
} from "@/lib/billing.functions";
```

Adicione o import da nova server function:

```typescript
import { useIsPlatformAdmin } from "@/hooks/use-platform-admin";
import {
  getAdminDashboard,
  acaoConta,
  salvarPlano,
  salvarPrecoCusto,
  reprocessarEventoKiwify,
} from "@/lib/billing.functions";
import { enviarNotificacaoTeste } from "@/lib/notificacoes.functions";
```

No corpo de `AdminPage`, ao lado dos outros `useServerFn`:

```80:85:src/routes/_authenticated/admin.tsx
  const { data: isAdmin, isLoading: loadingRole } = useIsPlatformAdmin();
  const carregar = useServerFn(getAdminDashboard);
  const executar = useServerFn(acaoConta);
  const gravarPlano = useServerFn(salvarPlano);
  const gravarPreco = useServerFn(salvarPrecoCusto);
  const reprocessar = useServerFn(reprocessarEventoKiwify);
```

Adicione:

```typescript
  const { data: isAdmin, isLoading: loadingRole } = useIsPlatformAdmin();
  const carregar = useServerFn(getAdminDashboard);
  const executar = useServerFn(acaoConta);
  const gravarPlano = useServerFn(salvarPlano);
  const gravarPreco = useServerFn(salvarPrecoCusto);
  const reprocessar = useServerFn(reprocessarEventoKiwify);
  const testarPush = useServerFn(enviarNotificacaoTeste);
```

E, na aba `onboarding`, logo depois do KPI grid, adicione um card com o botão:

```526:543:src/routes/_authenticated/admin.tsx
        {/* ---------------- ONBOARDING ---------------- */}
        <TabsContent value="onboarding" className="space-y-4 mt-5">
          <div className="grid gap-3 sm:grid-cols-3">
            <Kpi
              label="Onboardings iniciados"
              valor={String(data?.onboarding?.iniciados ?? 0)}
              detalhe={`${data?.onboarding?.concluidos ?? 0} concluídos`}
            />
            <Kpi
              label="Conclusão do wizard"
              valor={`${data?.onboarding?.conversao_pct ?? 0}%`}
              alerta={(data?.onboarding?.conversao_pct ?? 100) < 70}
            />
            <Kpi
              label="Em aberto"
              valor={String(
                (data?.onboarding?.iniciados ?? 0) - (data?.onboarding?.concluidos ?? 0),
              )}
            />
          </div>
```

Adicione, imediatamente depois desse `</div>` que fecha o grid de KPIs:

```typescript
          <Card className="p-5">
            <div className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Notificações push
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Cria um lote de teste na fila e chama o push-agent na hora, sem esperar o cron —
              use para confirmar que as chaves VAPID estão configuradas.
            </p>
            <Button
              size="sm"
              className="mt-3"
              onClick={() =>
                rodar(
                  () => testarPush(),
                  "Notificação de teste enviada (confira as inscrições ativas do seu usuário).",
                )
              }
            >
              Enviar notificação de teste
            </Button>
          </Card>
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && npm run build`

Expected: sem erros. Com o `push-agent` já deployado (Task 4) e ao menos uma inscrição salva (Task 8 ou 9 testadas antes), clique em "Enviar notificação de teste" na aba Onboarding do admin e confirme que a notificação chega no dispositivo.

- [ ] **Step 5: Commit**

```bash
git add src/lib/notificacoes.functions.ts src/lib/agentes.server.ts src/routes/_authenticated/admin.tsx
git commit -m "feat(push): acao de notificacao de teste na aba onboarding do admin"
```

---

## Task 11: Verificação de ponta a ponta

**Files:**
- Nenhum arquivo novo — só confirma o comportamento encadeado das Tasks 1-10.

**Interfaces:**
- Consumes: tudo das Tasks anteriores.

- [ ] **Step 1: Rodar os portões de qualidade completos**

Run: `npx tsc --noEmit && npm run lint && npm run build`

Expected: os três terminam sem erro.

- [ ] **Step 2: Inscrever um navegador real**

Com `npm run dev` de pé (ou o deploy do Railway), logado numa conta de teste, abra `/dna?novo=true` (ou clique no sininho na sidebar) e ative as notificações. Confirme no DevTools → Application → Service Workers que há um worker ativo em `/sw.js`, e que uma linha nova apareceu em `push_subscriptions` para o seu `user_id`.

- [ ] **Step 3: Disparar o caminho real de curadoria pronta**

```sql
select pr.id as perfil_referencia_id, pr.perfil_id_relacionado, p.conta_id
from public.perfis_referencia pr
join public.perfis p on p.id = pr.perfil_id_relacionado
where p.conta_id = '<conta_id da sua conta de teste>'
limit 1;

insert into public.conteudos_curados (perfil_referencia_id, conta_id, url, formato, tema)
values ('<perfil_referencia_id>', '<conta_id>', 'https://teste-e2e.local', 'texto', 'teste ponta a ponta');
```

Espere até 2 minutos (o cron `despachar-notificacoes-push`) mais 10 minutos de silêncio — ou force o despacho imediatamente para não esperar:

```sql
update public.push_notificacoes_pendentes
set ultimo_evento_em = now() - interval '11 minutes'
where tipo = 'curadoria_pronta' and enviado_em is null and conta_id = '<conta_id>';

select public.despachar_notificacoes_pendentes(false);
```

Expected: a notificação chega no dispositivo com o texto "Bom dia, {nome}! A curadoria de hoje já está pronta pra você aprovar." e, ao clicar, o app abre em `/curadoria`.

- [ ] **Step 4: Confirmar que o lote foi marcado como enviado**

```sql
select enviado_em from public.push_notificacoes_pendentes
where tipo = 'curadoria_pronta' and conta_id = '<conta_id>'
order by primeiro_evento_em desc limit 1;
```

Expected: `enviado_em` não é nulo.

- [ ] **Step 5: Limpar os dados de teste**

```sql
delete from public.conteudos_curados where url = 'https://teste-e2e.local';
```

- [ ] **Step 6: Commit final (se sobrou algum ajuste solto)**

```bash
git status
# Se houver mudanças pendentes de qualquer task anterior, commit com uma
# mensagem específica do que foi ajustado — não deixe passos sem commit.
```
