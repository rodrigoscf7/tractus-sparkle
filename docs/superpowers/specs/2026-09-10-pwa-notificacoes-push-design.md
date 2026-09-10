# PWA + notificações push (curadoria e pautas prontas)

## Contexto

Hoje o app não é instalável e não tem nenhum canal de push. A esteira de conteúdo roda em dois momentos diários fixos (08:00 curadoria, 08:45 ideador) mais um caminho a qualquer hora (aprovação manual de curadoria dispara o ideador). O objetivo é avisar o advogado, com uma mensagem amigável chamando pelo nome, quando há algo esperando por ele — e convidá-lo a abrir o app para conferir.

No iPhone, Web Push só funciona com o site instalado na tela de início (Safari não entrega push para aba aberta), e a permissão só pode ser solicitada a partir de um toque do usuário. Como a maioria da base é iOS, "app instalável" não é um refinamento futuro: sem ele a notificação simplesmente não existe para essa fatia dos usuários. Por isso o escopo inclui o PWA instalável, o fluxo de convite a instalar/permitir, e o motor de disparo — as três partes se sustentam.

## Decisões de produto (já validadas com o usuário)

- **Dois momentos de notificação**, não um: curadoria pronta (o que destrava a aprovação humana) e pautas prontas (o que efetivamente fica revisável em `/pipeline`).
- **Agregação por perfil**, não por conta: se a conta tem 3 perfis, cada perfil gera sua própria notificação — o advogado sabe exatamente de quem é.
- **Destinatários**: todos os membros da conta com dispositivo registrado, não só o owner.
- **Agrupamento por janela de silêncio**: como `promote_next_pauta` e `revisar_next_pauta_pronta` processam uma pauta a cada 2–3 minutos, várias pautas da mesma manhã chegam em `aguardando_aprovacao` espalhadas no tempo. Em vez de notificar cada uma, esperamos **10 minutos sem novidade** e disparamos uma única notificação agregada ("3 pautas prontas").
- **Vale o dia inteiro**, não só de manhã: uma curadoria aprovada às 15h que gera pauta às 15h10 também notifica.
- **Silêncio noturno 22h–7h** (horário de São Paulo): nada é entregue nesse intervalo.
- **Itens represados de madrugada não disparam pontualmente às 7h** — eles se juntam ao próximo lote real do dia (ex.: uma pauta pronta às 2h é agregada com as pautas que ficam prontas depois das 8h45, formando uma notificação só). Caso de borda: se nenhum evento novo acontecer naquele dia, um fallback às 20h força o envio do que ainda está represado, para nada se perder.
- **Convite para instalar/permitir**: logo depois do relatório de DNA renderizar (`/dna`), no pico de interesse do onboarding. Dispensável, sem repetição agressiva — um sininho no cabeçalho fica disponível para quem quiser ativar depois.

## Arquitetura escolhida

Fila no Postgres + varredura por `pg_cron`, reaproveitando o padrão que `curador-diario`/`ideador-diario` já usam (`net.http_post` com `agent_internal_headers()` chamando uma edge function).

Alternativas descartadas: agendamento dinâmico "de uma vez" por evento (pg_cron não serve para isso sem reinventar uma fila de qualquer forma) e serviço terceirizado tipo OneSignal/Firebase (custo e dependência externa novos, sem resolver a regra de agregação, que é de negócio).

## 1. Modelo de dados

### `push_subscriptions`
Uma linha por dispositivo/navegador inscrito.

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `user_id` | uuid | FK `auth.users`, dono da inscrição |
| `endpoint` | text | único — identifica o dispositivo/navegador junto ao provedor de push |
| `p256dh` | text | chave pública da inscrição |
| `auth_key` | text | segredo de autenticação da inscrição |
| `criado_em` | timestamptz | |
| `ultimo_uso_em` | timestamptz | atualizado a cada envio bem-sucedido |

RLS: usuário autenticado gerencia (`SELECT`/`INSERT`/`UPDATE`/`DELETE`) apenas as próprias linhas (`auth.uid() = user_id`). `service_role` tem acesso total, para o `push-agent` ler entre contas.

### `push_notificacoes_pendentes`
A fila de agregação — um "lote aberto" por perfil e tipo.

| coluna | tipo | notas |
|---|---|---|
| `id` | uuid PK | |
| `conta_id` | uuid | FK `contas` |
| `perfil_id` | uuid | FK `perfis` |
| `tipo` | text | `'curadoria_pronta'` \| `'pautas_prontas'` |
| `contagem` | integer default 1 | quantos eventos entraram neste lote |
| `primeiro_evento_em` | timestamptz | |
| `ultimo_evento_em` | timestamptz | usado para medir os 10 minutos de silêncio |
| `enviado_em` | timestamptz nulo | nulo enquanto o lote está aberto |

Índice único parcial: `UNIQUE (perfil_id, tipo) WHERE enviado_em IS NULL` — garante um único lote aberto por vez; o UPSERT do próximo evento incrementa `contagem` e atualiza `ultimo_evento_em` em vez de criar linha nova. Depois que `enviado_em` é setado, o índice libera espaço para um lote novo.

### Segredos

Par de chaves VAPID gerado uma única vez. A chave **pública** não é segredo — é lida pelo navegador para `pushManager.subscribe()`, então vai como `VITE_VAPID_PUBLIC_KEY` no `.env` (mesmo padrão de `VITE_SUPABASE_PUBLISHABLE_KEY`, pública por natureza). A chave **privada** e o `subject` (e-mail de contato exigido pelo protocolo VAPID) vão para o Vault do Supabase, seguindo o padrão de `agent_secret()`.

## 2. Casca do PWA

- `public/manifest.webmanifest`: nome "prevIA", `display: standalone`, `start_url: "/pipeline"`, `theme_color`/`background_color` neutros (claro, consistente com o tema padrão), ícones 192px, 512px e uma variante maskable 512px.
- Ícones: gerados a partir de um ícone-fonte fiel ao favicon atual (fundo amarelo `#F4DB0B`, wordmark "IA" em preto, sem gradiente/sombra — o amarelo é reservado como marcador de IA no design system, nunca decoração). O ícone-fonte já foi gerado nesta sessão; falta redimensionar para os três tamanhos do manifest durante a implementação.
- `<link rel="manifest">` e `<meta name="theme-color">` adicionados ao `<head>` em `src/routes/__root.tsx`.
- Service worker enxuto, escrito à mão (sem `vite-plugin-pwa` — o único trabalho dele é `push` e `notificationclick`; não há cache de assets/offline nesta rodada, por ser fora do que foi pedido). Registrado no client, similar aos outros módulos client-only existentes (ex. `previewAuthStorage`).

## 3. Convite para instalar e permitir

Card ao final da página `/dna`, depois do relatório renderizar: *"Quer ser avisado quando a curadoria e as pautas estiverem prontas?"* Comportamento por plataforma:

- **Android/desktop com Chrome/Edge** (evento `beforeinstallprompt` disponível): botão dispara o prompt nativo de instalação; ao concluir, encadeia `Notification.requestPermission()`.
- **iPhone/iPad Safari, ainda não instalado**: instruções em 2 passos (Compartilhar → Adicionar à Tela de Início) — não pode ser disparado por código. A intenção é persistida **no servidor** (um campo booleano ligado ao usuário autenticado, não `localStorage` — precisa sobreviver à troca de aba/instalação e ser a mesma em qualquer dispositivo que ele use para logar). Na próxima vez que o app for aberto já instalado (`display-mode: standalone`) e não houver `push_subscriptions` para aquele usuário, um aviso complementar pede a permissão.
- **Já instalado, permissão pendente**: mostra só o botão de permissão.

Dispensável e sem insistência a cada visita. Um sininho discreto no cabeçalho do app fica como ponto de entrada permanente para quem não seguiu no momento do onboarding.

Ao conceder permissão, o app inscreve via `registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC_KEY })` e envia a inscrição para uma nova server function (`salvarInscricaoPush`), que faz UPSERT em `push_subscriptions` vinculado a `auth.uid()`.

## 4. Motor de disparo

**Produtores do evento** (upsert na fila), ambos via trigger de banco — não dependem do código do agente ter sucesso, só do estado final na tabela:
- `AFTER INSERT ON conteudos_curados WHEN NEW.aprovacao_humana = 'pendente'` (o valor padrão da coluna, mesma que já gate-ia `trigger_ideador`) → resolve `perfil_id` via `perfis_referencia.perfil_id_relacionado` (não existe FK direto de `conteudos_curados` para `perfis`) e faz upsert `(perfil_id, 'curadoria_pronta')`. Se `perfil_referencia_id` for nulo ou não resolver um perfil, não gera evento — mesma tolerância que `gerarPautaFocada` já tem no `ideador-agent`.
- `AFTER UPDATE ON pautas_geradas WHEN NEW.status = 'aguardando_aprovacao' AND OLD.status IS DISTINCT FROM NEW.status` → upsert `(perfil_id, 'pautas_prontas')`.

**Varredura**: novo cron a cada 2 minutos chamando `public.despachar_notificacoes_pendentes()` (`SECURITY DEFINER`, no padrão dos demais). A função seleciona lotes abertos onde `now() - ultimo_evento_em > interval '10 minutes'` e o horário atual (em América/São Paulo) está fora de 22h–7h; marca `enviado_em = now()` e dispara `net.http_post` para a nova edge function `push-agent`, usando `agent_internal_headers()`.

**`push-agent`**: recebe o `queue_id`, busca `perfis.nome`, `tipo` e `contagem`, busca todas as `push_subscriptions` dos membros da conta (via `conta_membros`), monta a mensagem e envia Web Push assinado com VAPID para cada inscrição.

**Fallback do represamento noturno**: cron diário às 20h chama a mesma função de despacho, mas ignorando a regra dos 10 minutos de silêncio — força o envio de qualquer lote ainda aberto àquela hora, para garantir que nada fique perdido caso não haja nenhum evento novo no dia.

## 5. Conteúdo da mensagem e destino do clique

- Curadoria pronta: *"Bom dia, {nome}! A curadoria de hoje já está pronta pra você aprovar."*
- Pautas prontas (contagem = 1): *"{nome}, 1 pauta nova está esperando sua aprovação na prevIA."*
- Pautas prontas (contagem > 1): *"{nome}, {contagem} pautas novas estão esperando sua aprovação na prevIA."*

`{nome}` vem de `perfis.nome` — o nome que o próprio advogado escolheu na pergunta 1 do onboarding, então a notificação já nasce pessoal. `notificationclick` foca a janela existente ou abre uma nova em `/pipeline`, com o `perfil_id` como parâmetro de busca para o app já abrir filtrado no perfil certo.

## 6. Erros e limites

- Endpoint expirado (o navegador responde 404/410 ao tentar enviar) → `push-agent` apaga a `push_subscriptions` correspondente.
- Conta sem nenhuma inscrição registrada para aquele lote → `push-agent` só confirma o lote como tratado, sem chamada de rede.
- Chaves VAPID ausentes no ambiente → `push-agent` retorna erro sem derrubar o cron (mesma tolerância a falha dos demais agentes, que disparam via `net.http_post` sem esperar resposta).
- A função de despacho é uma leitura/escrita simples na fila, sem chamada de modelo — não deve lançar em condições normais; ainda assim, o corpo do cron job segue o padrão já usado em `bootstrap_instancia_nova` de engolir exceção para não travar o agendador.

## 7. Verificação

Sem infraestrutura de teste automatizado de push no repositório (só `tsc --noEmit`, `eslint` e `npm run build` como portões hoje). A verificação é manual: inscrever um navegador de teste, inserir uma linha de teste na fila via SQL, rodar `despachar_notificacoes_pendentes()` manualmente e confirmar a chegada da notificação — incluindo o clique abrindo o `/pipeline` no perfil certo.

Também entra uma ação "Enviar notificação de teste" na aba de admin, chamando `push-agent` diretamente para a inscrição do próprio admin — permite validar a configuração de VAPID em produção sem depender do cron.

## Fora de escopo nesta rodada

- Cache de assets/offline (o service worker só cuida de push).
- Preferências finas de notificação por usuário (silenciar um tipo específico, por exemplo) — hoje é tudo ou nada por conta do sininho.
- Digest fora dos dois momentos definidos (ex.: resumo semanal).
