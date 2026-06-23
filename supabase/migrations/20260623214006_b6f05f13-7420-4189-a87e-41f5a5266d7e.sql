
-- Extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- =========================================================
-- Tables
-- =========================================================
create table public.perfis (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo text check (tipo in ('institucional','socio')) not null,
  tom_de_voz text,
  diretrizes jsonb default '{}'::jsonb,
  identidade_visual jsonb default '{}'::jsonb,
  ativo boolean default true,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.perfis to authenticated;
grant all on public.perfis to service_role;
alter table public.perfis enable row level security;
create policy "auth users full access perfis" on public.perfis for all to authenticated using (true) with check (true);

create table public.perfis_referencia (
  id uuid primary key default gen_random_uuid(),
  handle text not null,
  nicho text,
  perfil_id_relacionado uuid references public.perfis(id) on delete cascade,
  ativo boolean default true,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.perfis_referencia to authenticated;
grant all on public.perfis_referencia to service_role;
alter table public.perfis_referencia enable row level security;
create policy "auth users full access perfis_referencia" on public.perfis_referencia for all to authenticated using (true) with check (true);

create table public.conteudos_curados (
  id uuid primary key default gen_random_uuid(),
  perfil_referencia_id uuid references public.perfis_referencia(id) on delete set null,
  url text,
  formato text,
  tema text,
  gancho text,
  score_curadoria numeric,
  texto_original text,
  capturado_em timestamptz default now()
);
grant select, insert, update, delete on public.conteudos_curados to authenticated;
grant all on public.conteudos_curados to service_role;
alter table public.conteudos_curados enable row level security;
create policy "auth users full access conteudos_curados" on public.conteudos_curados for all to authenticated using (true) with check (true);

create table public.pautas_geradas (
  id uuid primary key default gen_random_uuid(),
  perfil_id uuid references public.perfis(id) on delete cascade,
  origem_curadoria_id uuid references public.conteudos_curados(id) on delete set null,
  tema text,
  angulo text,
  formato_sugerido text,
  status text check (status in ('gerada','em_producao','aguardando_aprovacao','aprovada','rejeitada')) default 'gerada',
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.pautas_geradas to authenticated;
grant all on public.pautas_geradas to service_role;
alter table public.pautas_geradas enable row level security;
create policy "auth users full access pautas_geradas" on public.pautas_geradas for all to authenticated using (true) with check (true);

create table public.roteiros (
  id uuid primary key default gen_random_uuid(),
  pauta_id uuid references public.pautas_geradas(id) on delete cascade,
  conteudo jsonb,
  versao int default 1,
  status text check (status in ('em_producao','pronto')) default 'em_producao',
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.roteiros to authenticated;
grant all on public.roteiros to service_role;
alter table public.roteiros enable row level security;
create policy "auth users full access roteiros" on public.roteiros for all to authenticated using (true) with check (true);

create table public.artes (
  id uuid primary key default gen_random_uuid(),
  pauta_id uuid references public.pautas_geradas(id) on delete cascade,
  briefing jsonb,
  versao int default 1,
  status text check (status in ('em_producao','pronto')) default 'em_producao',
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.artes to authenticated;
grant all on public.artes to service_role;
alter table public.artes enable row level security;
create policy "auth users full access artes" on public.artes for all to authenticated using (true) with check (true);

create table public.decisoes_aprovacao (
  id uuid primary key default gen_random_uuid(),
  item_id uuid not null,
  item_tipo text check (item_tipo in ('pauta','roteiro','arte')),
  decisao text check (decisao in ('aprovado','rejeitado')),
  motivo_categoria text check (motivo_categoria in ('tom','tema','formato','gancho','outro')),
  comentario_livre text,
  perfil_id uuid references public.perfis(id) on delete set null,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.decisoes_aprovacao to authenticated;
grant all on public.decisoes_aprovacao to service_role;
alter table public.decisoes_aprovacao enable row level security;
create policy "auth users full access decisoes_aprovacao" on public.decisoes_aprovacao for all to authenticated using (true) with check (true);

create table public.publicacoes (
  id uuid primary key default gen_random_uuid(),
  pauta_id uuid references public.pautas_geradas(id) on delete cascade,
  perfil_id uuid references public.perfis(id) on delete set null,
  status text check (status in ('pendente','postado')) default 'pendente',
  postado_em timestamptz,
  criado_em timestamptz default now()
);
grant select, insert, update, delete on public.publicacoes to authenticated;
grant all on public.publicacoes to service_role;
alter table public.publicacoes enable row level security;
create policy "auth users full access publicacoes" on public.publicacoes for all to authenticated using (true) with check (true);

create table public.agentes_status (
  agente_nome text primary key,
  estado_atual text check (estado_atual in ('idle','working','waiting','error')) default 'idle',
  ultima_acao text,
  atualizado_em timestamptz default now()
);
grant select, insert, update, delete on public.agentes_status to authenticated;
grant all on public.agentes_status to service_role;
alter table public.agentes_status enable row level security;
create policy "auth users full access agentes_status" on public.agentes_status for all to authenticated using (true) with check (true);

-- Realtime
alter publication supabase_realtime add table public.agentes_status;
alter publication supabase_realtime add table public.pautas_geradas;
alter publication supabase_realtime add table public.roteiros;
alter publication supabase_realtime add table public.artes;

-- =========================================================
-- Seed: perfis (JSONs literais do Bloco 0)
-- =========================================================
insert into public.perfis (nome, tipo, tom_de_voz, diretrizes, identidade_visual) values
('Tractus','institucional',
 'sólido, moderno, direto, atemporal, sem jargão técnico exagerado',
 '{
    "tom_de_voz": "sólido, moderno, direto, atemporal, sem jargão técnico exagerado",
    "posicionamento": "empresa de crescimento que usa tecnologia como alavanca — não uma empresa de software",
    "manifesto": "Empresas não crescem por acaso. Crescem com tração. Clareza onde havia caos, escala onde havia limitação, inteligência onde havia esforço manual.",
    "valores_marca": ["sólida","moderna","tecnológica","atemporal"],
    "publico": "empresários e operações que buscam crescimento estruturado via tecnologia",
    "temas_evitar": ["hype de ferramenta","linguagem genérica de marketing digital"]
  }'::jsonb,
 '{
    "paleta_cores": {
      "laranja_principal":"#FF6A00","preto":"#1D1D1B","cinza_medio":"#9D9D9C",
      "cinza_claro":"#DADADA","off_white":"#F6F6F6","gradiente_simbolo":["#FFD278","#DC5014"]
    },
    "tipografia_titulo":"Outfit Bold",
    "tipografia_corpo":"Work Sans",
    "tipografia_dados":"Geist Mono",
    "estilo_fotografico":"fundo escuro preferencial, mockups limpos, aplicação do símbolo geométrico em 3 blocos",
    "elementos_graficos_recorrentes":"ícone de 3 blocos (barra vertical, bloco diagonal, bloco de ancoragem) com gradiente ouro→laranja; versão escura é uso preferencial"
  }'::jsonb
),
('Rodrigo Faria','socio',
 'clareza cirúrgica, intensidade controlada, tom de diagnóstico — não copy agressiva. Frases curtas e diretas',
 '{
    "tom_de_voz": "clareza cirúrgica, intensidade controlada, tom de diagnóstico — não copy agressiva. Frases curtas e diretas",
    "posicionamento": "Estrategista de operações inteligentes para empresários que querem escala, clareza e liberdade",
    "arquetipos": ["O Estrategista","O Arquiteto","O Mentor Inconformado"],
    "publico": "empresários inquietos, cansados do operacional, que sabem que estão abaixo do potencial e sentem o mercado acelerando",
    "pilares_conteudo": ["Diagnóstico de Operação","Visão + Estratégia","Casos Reais (case 8%→22% de conversão)","Construção de Sistema"],
    "frases_ancora": [
      "O problema da maioria das empresas não é falta de esforço. É falta de estrutura.",
      "IA não substitui empresários. Substitui empresários lentos.",
      "Clareza é vantagem competitiva."
    ],
    "temas_evitar": ["hype de ferramenta","motivacional sem diagnóstico","tom de guru/coach","jargão técnico desnecessário","''especialista em IA para advogados'' como posicionamento único"]
  }'::jsonb,
 '{
    "paleta_cores": {
      "obsidian_base":"#0D0C0B","carvao":"#151412","fumaca":"#1C1A18",
      "cobre_acento":"#C47A52","cobre_claro_hover":"#D9956E","terracota_secundario":"#8B5540",
      "offwhite_texto":"#F0EBE4","pedra_texto_secundario":"#A89C93"
    },
    "tipografia_titulo":"Cormorant Garamond Light (serifada editorial)",
    "tipografia_corpo":"DM Sans Light 300",
    "tipografia_labels":"DM Sans 500 uppercase tracked",
    "estilo_fotografico":"dark quente (nunca preto frio), espaço negativo generoso, tipografia como elemento de design",
    "elementos_graficos_recorrentes":"nunca usar ouro (remete a jurídico antigo) nem neon/ciano (remete a startup), sem gradiente hacker, sem emojis"
  }'::jsonb
),
('Thiago Henrique','socio',
 'direto, concreto com números reais, sem mimi/vitimismo, provocador e polarizador',
 '{
    "tom_de_voz":"direto, concreto com números reais, sem mimi/vitimismo, provocador e polarizador",
    "posicionamento":"alavancagem financeira com operacional que roda sem o cliente precisar virar expert",
    "arquetipo":"Rebelde + Mago, evoluindo para Sábio — nunca Herói",
    "publico":"pessoas que já tentaram o mercado financeiro, perderam, querem caminho sem largar o que fazem, sem consórcio/guru/curso",
    "pilares_conteudo":["História real (as 4 quebras)","Operacional (robôs, IA, forex, cripto)","Provocação (contra guru/ostentação)","Prova social (com número real)"],
    "ganchos_referencia":[
      "Menos de 1% dos traders sobrevivem no mercado brasileiro. Eu sou um deles.",
      "A família me chamava de maluco do Bitcoin. Hoje eles pedem dica.",
      "O problema não é falta de dinheiro. É falta de operacional."
    ],
    "temas_evitar":["emojis em copy de post","exclamações em série","a palavra ''sistema'' no copy","prometer resultado sem mostrar caminho","ostentação de lifestyle como centro","abrir com ''E se eu te dissesse...''"]
  }'::jsonb,
 '{
    "paleta_cores":{
      "preto_real":"#080808","ambar_eletrico":"#FFB800","branco_quente":"#F0EBE3",
      "superficie":"#111111","cinza_medio":"#4A4A4A"
    },
    "tipografia_titulo_impacto":"Bebas Neue uppercase",
    "tipografia_titulo_post":"Barlow Condensed 900 uppercase",
    "tipografia_corpo":"DM Sans 400-500",
    "tipografia_dados":"DM Mono",
    "regra_de_ouro":"âmbar nunca é decorativo, é sinal — máximo 2 elementos âmbar por visual, nunca em bloco de texto corrido",
    "estilo_fotografico":"fundo sempre escuro, espaço negativo generoso, sem gradientes/sombras/glow, máximo 2 cores e 2 famílias tipográficas por post"
  }'::jsonb
),
('Rafael Valente','socio',
 'racional, direto, sem enrolação, fala de quem já passou pelo problema e desperta movimento em quem ouve',
 '{
    "tom_de_voz":"racional, direto, sem enrolação, fala de quem já passou pelo problema e desperta movimento em quem ouve",
    "posicionamento":"estrategista de negócios digitais que tira o advogado do caos operacional e dá controle, faturamento, tempo e clareza",
    "publico":"donos de escritório de advocacia previdenciária, 25-47 anos, faturamento acima de R$15k/mês, já tem equipe, sobrecarregados",
    "mantras":[
      "Quem faz tudo, mata a escala e não cresce.",
      "Você não precisa de mais leads, precisa atender melhor.",
      "Eu não cresci trabalhando mais. Cresci estruturando melhor."
    ],
    "dores_publico":["falta de tempo, apagando incêndio","WhatsApp desorganizado","leads perdidos por falta de resposta","falta de previsibilidade","crescimento travado"],
    "temas_evitar":["enrolação","conteúdo raso","prometer e não entregar","complexidade desnecessária"]
  }'::jsonb,
 '{
    "paleta_cores":{
      "preto_profundo":"#0A0A0A","laranja_principal":"#f88104","laranja_secundario":"#ff6201",
      "branco_suave":"#F4F4F4","cinza_claro":"#d3d3d3"
    },
    "tipografia_titulo":"sans-serif moderna e forte, caixa alta (Inter, Neue Haas Grotesk, Satoshi ou Helvetica Now)",
    "tipografia_destaque":"serifada elegante pontual (Libre Baskerville ou Playfair Display) para citações e reflexões",
    "tipografia_corpo":"Inter Regular",
    "estilo_fotografico":"lagoa, escritório sofisticado, varanda, eventos/palestras — noite, contraste, luz quente pontual, ambiente minimalista",
    "elementos_graficos_recorrentes":"linha dourada horizontal, glow direcional sutil, fundo escuro com pontos de luz, espaços negativos amplos",
    "nunca":["amarelo","roxo","neon","azul tech vibrante","robô de IA genérico","holograma clichê","banco de imagem corporativo sorridente"]
  }'::jsonb
);

insert into public.agentes_status (agente_nome) values
('curador'),('ideador'),('copy'),('visual'),('revisor');

-- =========================================================
-- Trigger functions (URLs e service role serão resolvidos via vault/secret na função)
-- Edge functions são públicas (verify_jwt=false). Usamos a anon key.
-- =========================================================

create or replace function public.trigger_ideador()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.score_curadoria >= 7 then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/ideador-agent',
      headers := jsonb_build_object(
        'Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'
      ),
      body := jsonb_build_object('conteudo_id', new.id, 'perfil_referencia_id', new.perfil_referencia_id)
    );
  end if;
  return new;
end;
$$;

create trigger on_conteudo_curado_insert
after insert on public.conteudos_curados
for each row execute function public.trigger_ideador();

create or replace function public.trigger_producao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'em_producao' and (old.status is null or old.status != 'em_producao') then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/copy-agent',
      headers := jsonb_build_object('Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'),
      body := jsonb_build_object('pauta_id', new.id)
    );
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/visual-agent',
      headers := jsonb_build_object('Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'),
      body := jsonb_build_object('pauta_id', new.id)
    );
  end if;
  return new;
end;
$$;

create trigger on_pauta_em_producao
after update on public.pautas_geradas
for each row execute function public.trigger_producao();

create or replace function public.trigger_revisor_via_roteiro()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  arte_pronta boolean;
begin
  select exists(select 1 from public.artes where pauta_id = new.pauta_id and status = 'pronto') into arte_pronta;
  if new.status = 'pronto' and arte_pronta then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/revisor-agent',
      headers := jsonb_build_object('Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'),
      body := jsonb_build_object('pauta_id', new.pauta_id)
    );
  end if;
  return new;
end;
$$;

create trigger on_roteiro_pronto
after update on public.roteiros
for each row execute function public.trigger_revisor_via_roteiro();

create or replace function public.trigger_revisor_via_arte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  roteiro_pronto boolean;
begin
  select exists(select 1 from public.roteiros where pauta_id = new.pauta_id and status = 'pronto') into roteiro_pronto;
  if new.status = 'pronto' and roteiro_pronto then
    perform net.http_post(
      url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/revisor-agent',
      headers := jsonb_build_object('Content-Type','application/json',
        'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'),
      body := jsonb_build_object('pauta_id', new.pauta_id)
    );
  end if;
  return new;
end;
$$;

create trigger on_arte_pronta
after update on public.artes
for each row execute function public.trigger_revisor_via_arte();

-- Cron diário do curador (06h UTC)
select cron.schedule(
  'curador-diario',
  '0 6 * * *',
  $cron$
  select net.http_post(
    url := 'https://ngiitkwnarxsemdinthy.supabase.co/functions/v1/curador-agent',
    headers := jsonb_build_object('Content-Type','application/json',
      'apikey','eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5naWl0a3duYXJ4c2VtZGludGh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyMzk4NTksImV4cCI6MjA5NzgxNTg1OX0.OmTRQ7oSr1JJg9xsinf1olu28NfBS4J1o7AD2053upc'),
    body := '{}'::jsonb
  );
  $cron$
);
