# E-mail transacional com Resend — plano de execução

Runbook para configurar o envio de e-mail do prevIA. Escrito para quem vai executar
com acesso ao painel do Supabase, ao DNS do domínio e ao repositório.

## Por que isto existe

Hoje o projeto **não tem SMTP configurado**. O Supabase está usando o remetente
embutido dele, que a própria documentação classifica como só para desenvolvimento e
que tem limite agressivo de envio.

Consequência prática: o botão **"esqueci minha senha"**, que já está no ar em
`src/routes/auth.tsx`, não funciona de forma confiável para cliente real. Isso é
independente do funil — precisa ser resolvido de qualquer forma.

O cadastro público está desligado (`enable_signup = false`), de propósito. Quem entra
no app ou comprou pela Kiwify, ou foi convidado pelo admin. Nenhum desses dois
caminhos depende de e-mail hoje, e isso é deliberado: e-mail transacional falha,
atrasa e cai em spam, então ele é o **reforço**, nunca o caminho crítico.

---

## Decisão: uma conta, dois modos de envio

Resend não compete com "SMTP no Supabase". Resend é o **provedor**; o SMTP do
Supabase é um **slot de configuração**. A mesma conta Resend atende os dois usos:

| Uso | Quem compõe | Como envia |
|---|---|---|
| Recuperação de senha, convite, confirmação | Supabase Auth (templates dele) | SMTP do Supabase apontando para o Resend |
| Boas-vindas pós-compra, entrega do DNA Viral | Nosso código | API do Resend, de uma Edge Function |

A separação importa: o template do Supabase Auth não consegue carregar o contexto do
funil (o arquétipo da pessoa, o link do relatório dela). E-mail de marca sai do nosso
código; e-mail de infraestrutura sai do Supabase.

---

## Etapa 1 — Conta e domínio

1. Criar conta em resend.com.
2. Adicionar o domínio que o app vai usar em produção (**não** o `.up.railway.app`).
3. Publicar no DNS os registros que o Resend mostrar: SPF, DKIM e, se oferecido,
   o de retorno (`Return-Path`). Propagação costuma levar minutos, às vezes horas.
4. Esperar o domínio ficar **Verified** no painel do Resend.

> Este é o passo que trava todo mundo. Antes da verificação, o Resend só entrega para
> o seu próprio endereço — o que dá a falsa impressão de que está tudo funcionando.

5. Definir o remetente. Sugestão: `prevIA <contato@seudominio>`. Evitar `noreply@`:
   piora entregabilidade e fecha a porta para quem responde pedindo ajuda.

---

## Etapa 2 — SMTP no Supabase (resolve a recuperação de senha)

No painel do Supabase, em **Authentication → Emails → SMTP Settings**, preencher com
os dados de SMTP que o Resend fornece (host `smtp.resend.com`, porta 465, usuário
`resend`, senha = API key criada para isso).

Confirmar junto, na mesma área:

- **Site URL** — hoje está `https://app-production-545a4.up.railway.app`. Todo link de
  e-mail de auth é montado a partir dele. **No dia em que o domínio for apontado, isto
  precisa mudar junto**, senão o link de recuperação leva a pessoa para a URL do
  Railway.
- **Redirect URLs** — incluir o domínio novo, com e sem `/**`.
- **Rate limits** — o padrão do Supabase para e-mail é baixo; com SMTP próprio dá para
  subir.

**Como testar:** pedir recuperação de senha em `/auth` com um endereço real e conferir
que o e-mail chega e que o link aponta para o domínio certo.

---

## Etapa 3 — E-mail de boas-vindas pós-compra

Este é o e-mail mais caro do negócio: a pessoa acabou de pagar. Ele é **reforço** do
fluxo que já funciona — a página de obrigado da Kiwify já leva direto para
`/boas-vindas`, onde o comprador define a senha sem depender de e-mail nenhum.

O e-mail cobre quem fechou a aba antes de definir a senha.

**Onde entra no código:** em `prepararAcesso`, em `src/lib/kiwify.server.ts`, logo
depois de a conta ser criada. Tudo de que ele precisa já está ali — o e-mail do
comprador, o `conta_id` e o lead com as respostas do quiz.

**Forma sugerida:** uma Edge Function `email-agent`, no padrão das outras
(`verify_jwt = false` + `requireAgentAuth`), chamada por `invocarAgente`. Mantém a API
key do Resend no mesmo lugar dos outros segredos e fora do bundle do cliente.

**O que o e-mail deve dizer**, na ordem:

1. Confirmar a compra em uma linha.
2. O link direto para `/boas-vindas` criar a senha.
3. O nome do arquétipo do DNA Viral dela e o link do relatório — é o que amarra a
   compra ao que ela viu antes.
4. O que acontece a seguir: o onboarding já vem preenchido, falta só indicar os perfis
   de referência.

Sem assunto genérico do tipo "Sua compra foi confirmada". Melhor algo que continue a
conversa do funil, referenciando o diagnóstico que ela acabou de receber.

---

## Etapa 4 — O DNA Viral por e-mail (a captura do funil)

O relatório já é público por token em `/dna-viral/$token` e o e-mail já é pedido na
página, para "guardar o link". Hoje esse e-mail só é gravado em
`oferta_leads.email` — **nada é enviado**.

Fechar esse laço: ao gravar o e-mail em `salvarEmailLead`
(`src/lib/quiz-oferta.functions.ts`), disparar o envio com o link do relatório.

Dois cuidados:

- **Não bloquear a resposta da tela.** A pessoa está lendo o relatório; o envio não
  pode segurar a interface nem derrubar a página se o Resend falhar.
- **Um envio por lead.** Quem clicar duas vezes não deve receber dois e-mails. Vale
  uma coluna `email_enviado_em` em `oferta_leads`, no mesmo espírito de
  `senha_definida_em`.

Isso abre o único canal de remarketing do funil: quem respondeu o quiz, recebeu o
diagnóstico e não comprou.

---

## Custo e limites

O plano gratuito do Resend cobre 3.000 e-mails por mês e 100 por dia. A R$ 47 por
cliente, o volume necessário para estourar isso está muito além do estágio atual.

---

## Ordem sugerida

1. **Etapa 1 e 2** — domínio verificado e SMTP no Supabase. Conserta a recuperação de
   senha, que hoje está quebrada para cliente real. É a mais urgente e independe de
   qualquer código novo.
2. **Etapa 4** — o DNA Viral por e-mail. É a que mais rende: abre o remarketing e
   aproveita e-mails que já estão sendo capturados e desperdiçados.
3. **Etapa 3** — boas-vindas pós-compra. Importa menos porque o caminho principal já
   não depende de e-mail; é rede de segurança.

---

## Pendências que ficam registradas

- `site_url` ainda aponta para o Railway. Atualizar junto com o apontamento do domínio.
- `oferta_leads.email` é capturado e nunca usado.
- Nenhum e-mail sai do app hoje, por nenhum caminho.
