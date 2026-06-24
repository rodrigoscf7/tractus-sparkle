## Problema

A rota `/agentes` (arquivo `src/routes/_authenticated/agentes.tsx`) virou uma rota-pai (tem filho `/agentes/$agente`), mas o componente `AgentesPage` continua renderizando o grid de cards e **não renderiza `<Outlet />`**. Resultado: a URL muda para `/agentes/curador`, a rota filha "casa", mas não há onde ela aparecer — a página parece travada na listagem.

## Correção

Seguir o padrão TanStack: separar layout de leaf.

1. Transformar `src/routes/_authenticated/agentes.tsx` em layout puro:
   - `component: () => <Outlet />`
   - Remover todo o conteúdo do grid de cards deste arquivo.

2. Criar `src/routes/_authenticated/agentes.index.tsx` (rota `/agentes`) com o conteúdo atual da listagem de agentes (grid de cards com status e links para `/agentes/$agente`).

3. Manter `src/routes/_authenticated/agentes.$agente.tsx` como está — ele já funciona, só faltava o `<Outlet />` no pai.

Nenhuma mudança em backend, schema ou edge functions. `routeTree.gen.ts` é regenerado automaticamente.
