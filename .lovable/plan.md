
## Objetivo

Criar o usuário `tractus.diretoria@gmail.com` no sistema para você acessar o dashboard.

## Como vou fazer

Vou criar o usuário direto no backend (via Auth Admin), já confirmado, com a senha `Met@2026`. Assim você não precisa passar pelo fluxo de sign-up — abre `/auth`, faz login e entra direto.

Passos:
1. Criar o usuário `tractus.diretoria@gmail.com` com a senha informada, `email_confirmed: true`.
2. Confirmar que o usuário foi criado consultando `auth.users`.
3. Te avisar para acessar `/auth` e logar.

## Observação de segurança

Você compartilhou a senha em chat. Recomendo trocá-la depois do primeiro login (posso adicionar uma tela de "trocar senha" se quiser, em um próximo passo). Para uso interno da diretoria isso é aceitável, mas vale o aviso.

## Sem mudanças de código

Esse passo é só execução no backend — nenhum arquivo do projeto será alterado.
