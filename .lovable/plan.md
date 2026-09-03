# Painel admin com planos reais, cobrança Kiwify e economia por conta

Objetivo: transformar a área administrativa em um painel de SaaS de verdade — planos comerciais publicados, assinaturas cobradas pela Kiwify, custo real de uso por conta e projeções que sustentem o preço.

## Situação atual (verificada)

- `planos` já tem 3 planos (Gratuito, Starter R$ 97, Pro R$ 297) com limites de perfis, referências, curadorias, roteiros e carrosséis. Não há campos comerciais (trial, checkout, ciclo, moeda).
- `contas` guarda apenas `plano_codigo` e `status` (ativa/suspensa). Não há assinatura, vencimento, histórico de pagamento nem período de teste.
- A tela de Assinatura é somente leitura e termina em "fale com a equipe prevIA" — não existe caminho de compra.
- O Admin lista contas com plano, consumo do ciclo e falhas; não há receita, MRR, churn nem custo.
- Custo de uso hoje não é medido: as chamadas de IA descartam os totais de tokens da resposta e as execuções de scraping não são contabilizadas. `uso_mensal` está sem registros neste ciclo.

## O que será construído

### 1. Planos comerciais editáveis

Planos ganham campos de negócio: moeda (BRL), preço mensal e anual, dias de trial (14), link de checkout da Kiwify, id do produto/oferta na Kiwify, descrição, lista de benefícios, visibilidade (público/oculto) e se é o plano recomendado.

Nova aba **Planos** no Admin: editar preço, limites, trial, benefícios e link de checkout de cada plano, criar um novo plano e ocultar um plano antigo sem quebrar as contas que ainda o usam.

### 2. Assinatura e cobrança pela Kiwify

- Cada conta passa a ter uma assinatura: plano, situação (trial, ativa, atrasada, cancelada), início, fim do trial, próxima renovação, valor cobrado, id do pedido/assinatura na Kiwify e e-mail do comprador.
- Conta nova entra automaticamente em **trial de 14 dias** no plano Starter; ao fim do trial sem pagamento, cai para o Gratuito.
- A tela de Assinatura ganha comparativo de planos com preço, benefícios e botão que abre o checkout da Kiwify do plano escolhido, já com o e-mail e um identificador da conta anexados para reconciliação.
- Um endpoint público recebe os avisos da Kiwify (compra aprovada, recusada, reembolso, cancelamento, atraso de assinatura) validando o token de assinatura da Kiwify antes de qualquer gravação. Cada aviso é registrado em um histórico e move a assinatura da conta: aprovado ativa o plano e renova o ciclo, recusa/atraso marca como atrasada, cancelamento/reembolso volta ao Gratuito no fim do período pago.
- Todo evento recebido fica gravado, inclusive os que falharem, para reprocessar sem perder pagamento.

### 3. Medição real de custo por conta

- Toda chamada de IA passa a registrar um evento de custo: conta, perfil, agente, tipo de geração, tokens de entrada e saída, e custo calculado.
- Toda execução de scraping registra um evento com número de itens coletados e custo estimado por execução.
- Uma tabela de preços de insumos (custo por milhão de tokens de entrada/saída por modelo e custo por execução de scraping) fica editável no Admin — quando o evento não trouxer tokens, o sistema usa a média histórica daquele tipo de geração como estimativa e marca o evento como estimado.
- Consolidação mensal por conta: custo de IA, custo de scraping, custo total, número de gerações e custo médio por geração.

### 4. Dashboard de contas pagantes e economia

Novo painel no topo do Admin:

- Receita recorrente mensal, receita do mês, ticket médio, contas pagantes, contas em trial, contas gratuitas, conversão de trial e cancelamentos do mês.
- Custo de infraestrutura do mês (IA + scraping), margem bruta em reais e em percentual.
- Projeção para os próximos 3, 6 e 12 meses, a partir da média de crescimento de contas pagantes e do custo médio por conta, com cenário conservador, base e otimista.
- **Coerência de preço por plano**: para cada plano, custo máximo teórico se a conta usar 100% dos limites, custo médio real observado, margem no uso médio e no uso máximo, com alerta quando a margem no uso máximo ficar abaixo de um piso saudável. É esse número que sustenta se o preço está coerente com o mercado.
- Por conta: plano, situação da assinatura, receita, custo real, margem, consumo do ciclo e alerta de conta que consome mais do que paga.

### 5. Ações administrativas

Trocar plano, conceder ou estender trial, marcar pagamento manual (para venda fechada fora da Kiwify), suspender e reativar conta, e reprocessar um evento da Kiwify que tenha falhado. Toda ação fica registrada com autor e data.

## Detalhes técnicos

- Migrações: colunas comerciais em `planos`; nova `assinaturas` (1 por conta, situação, datas, valores, ids Kiwify); `kiwify_eventos` (payload cru, tipo, situação de processamento, erro); `custo_eventos` (conta, agente, modelo, tokens, custo, flag de estimativa); `custo_precos` (preço por modelo e por execução de scraping); `admin_acoes` (auditoria). RLS por conta para leitura própria, escrita restrita a `has_role(auth.uid(),'admin')` e `service_role`, com GRANT explícito em cada tabela nova.
- Visões de agregação (`vw_conta_economia_mensal`, `vw_plataforma_mensal`) para não recalcular no cliente; leitura via `createServerFn` com `requireSupabaseAuth` e checagem de papel admin.
- Webhook Kiwify em `src/routes/api/public/webhooks/kiwify.ts`, validando o token/assinatura da Kiwify por comparação em tempo constante antes de processar; idempotente pelo id do pedido. O segredo do webhook será solicitado quando a implementação começar.
- `callClaude` passa a retornar os totais de tokens da resposta da API, e cada agente grava o evento de custo junto do resultado; o fallback estimado usa média histórica por tipo.
- Frontend: aba de planos e dashboard financeiro em `admin.tsx` (dividido em componentes), comparativo e checkout em `assinatura.tsx`, gráficos com a biblioteca de charts já presente no projeto.
- Gate de limite existente nos agentes passa a considerar também assinatura atrasada ou trial expirado.

## Fora do escopo

Emissão de nota fiscal, cupons e afiliados da Kiwify, cobrança por excedente avulso e preço em dólar.
