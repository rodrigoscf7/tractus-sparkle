# prevIA - CONTENT: rebrand + fundação SaaS

Duas frentes nesta entrega: (1) trocar toda a identidade visual de Tractus para prevIA, seguindo o manual de marca v1.0; (2) montar a base de SaaS multi-tenant com planos, limites de geração e painel admin — sem cobrança real ainda.

## Parte 1 — Identidade prevIA

### Cores e tema
Modo claro como padrão (decisão do manual: o público lê texto corrido o dia inteiro), com toggle de escuro.

Tokens claros: fundo `#F4F4F2`, cartão `#FFFFFF`, borda `#E4E4E0`, divisor `#EDEDE9`, texto `#0D0D0F` / `#6E6E76` / `#8A8A92`, ação primária e marcador de IA `#F4DB0B`, erro `#B4451F`, confirmação `#4A7A2E`. Escuro deriva de grafite 800 `#1A1A1E` com o mesmo amarelo.

Regras que valem em todas as telas:
- Amarelo nunca é texto e nunca significa alerta. Ele é ação ou marcador de "aqui a IA atuou".
- Estados vivem em terracota e oliva, nunca em amarelo.
- Proporção 85% neutros / 10% grafite / 5% amarelo.
- Raio 12px em superfícies, 8px em controles, borda sempre 1px, zero sombra.
- Sai o gradiente laranja/ouro atual (`tractus-gradient`, `tractus-gradient-text`).

### Tipografia
Space Grotesk para títulos e interface, Inter como fallback, mono para dados. Hierarquia do manual: Display 44, T1 29, T2 21, T3 16, corpo 15, apoio 13, micro 11 caixa alta. Entreletra negativa nos títulos, zero abaixo de 16px. **Numerais tabulares obrigatórios** em toda coluna de número: score, views, likes, comentários, contadores de uso.

### Logo e nome
- Assinatura completa `prevIA` (logo enviada) na tela de login e no topo da navegação desktop.
- Marca reduzida (bloco `IA`) como favicon e ícone na navegação colapsada/mobile.
- Nome exibido: **prevIA - CONTENT**. Substitui "Tractus" em navegação, login, título e metadados de todas as rotas.
- Grafia sempre `prevIA` — nunca Previa, PrevIA, prevIa.
- Assets antigos da Tractus removidos.

### Voz
Rótulos e textos de apoio revistos para o registro do manual: profissional para profissional, sem "revolucionário", "poderoso", "descomplicado". Nada de tom motivacional.

### Fora do escopo do rebrand
Os carrosséis gerados continuam usando a identidade visual configurada por perfil de cliente. A marca prevIA fica só no app.

## Parte 2 — Fundação SaaS

### Multi-tenant
Hoje todo usuário autenticado é admin e vê todos os perfis. Passa a existir a noção de **conta** (workspace):
- `contas`: nome, plano atual, status, data de início do ciclo.
- `conta_membros`: liga usuário à conta com papel (owner / member).
- `perfis`, `perfis_referencia`, `conteudos_curados`, `pautas_geradas`, `roteiros`, `artes`, `carrosseis`, `publicacoes`, `decisoes_aprovacao` passam a ter `conta_id`.
- RLS reescrita: cada usuário vê apenas dados da sua conta; `admin` da plataforma (papel global existente) vê tudo.
- Migração dos dados atuais para uma conta inicial, mantendo Tractus e Márcia Canuto funcionando sem interrupção.

### Planos e limites de geração
- `planos`: código, nome, preço mensal, limites (perfis, referências monitoradas, curadorias/mês, roteiros/mês, carrosséis/mês).
- `uso_mensal`: consumo por conta e por ciclo, incrementado a cada geração.
- Verificação de limite antes de disparar curador, ideador, copy, visual e carrossel. Estourou o limite: a geração não roda e a conta recebe um aviso claro de qual limite foi atingido e quando reseta.
- Tela de **Assinatura** dentro do app: plano atual, barras de consumo por tipo de geração, data de renovação.

### Painel admin da plataforma
Rota protegida por papel `admin`, com: lista de contas, plano e consumo de cada uma, troca manual de plano, ativar/suspender conta, e visão de erros dos agentes por conta.

### Onboarding
Cadastro cria a conta, coloca o usuário como owner, atribui o plano gratuito e leva ao primeiro perfil. Login continua por e-mail/senha; Google entra junto.

### Pagamento
Estrutura de planos e limites já modelada para receber cobrança, mas **sem integração de pagamento nesta entrega**. Fica como próximo passo, junto com a escolha de provedor.

## Detalhes técnicos

- `src/styles.css`: tokens reescritos em oklch a partir dos hex do manual, `@theme inline` mapeando `--color-*`, variante `.dark` real (hoje é cópia do claro), utilitários `tabular-nums` e marcador de IA. Remoção dos utilitários de gradiente.
- Fontes Space Grotesk + Inter via `<link>` no `head().links` de `src/routes/__root.tsx` (nunca `@import` remoto no CSS).
- Logo prevIA e ícone publicados como Lovable Assets; favicon copiado como arquivo real em `public/`.
- Telas tocadas pelo rebrand: `__root.tsx`, `auth.tsx`, `_authenticated/route.tsx`, `pipeline.tsx`, `curadoria.tsx`, `perfis.tsx`, `agentes.index.tsx`, `agentes.$agente.tsx`, `aprovacao.$pautaId.tsx`.
- Head metadata por rota atualizado com título e descrição próprios de prevIA - CONTENT.
- Migrações: novas tabelas com `GRANT` + RLS + policies na mesma migração; backfill de `conta_id`; tipos regenerados.
- Limites checados no servidor (edge functions dos agentes e server functions), nunca só na UI.

## Ordem de execução

1. Tokens, fontes, tema claro/escuro e logo — app inteiro já com cara de prevIA.
2. Textos, nomes e metadados.
3. Migração multi-tenant (contas, membros, `conta_id`, RLS).
4. Planos, uso mensal e checagem de limite nos agentes.
5. Tela de Assinatura e painel admin.
6. Onboarding de nova conta.
