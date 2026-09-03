# CTA padrão por perfil + estratégia de curadoria (viral vs posicionamento)

## 1. CTA padrão por perfil

Novo campo configurável na tela **Perfis**, junto da identidade e do template de carrossel:

- Campo de texto "CTA padrão" (ex: "Se isso fez sentido, me chama no direct").
- O agente de copy recebe essa CTA como base obrigatória: mantém a intenção e o canal,
  podendo ajustar as palavras ao tema (conforme sua escolha).
- Aplicação:
  - **Reel**: bloco `cta_falado` sempre derivado da CTA padrão.
  - **Carrossel**: último slide sempre é o CTA, derivado da mesma frase.
- Se o perfil não tiver CTA cadastrada, o comportamento atual continua (agente inventa a CTA).

## 2. Estratégia de conteúdo: viral ou posicionamento

Nova configuração de **foco** no perfil, com exceção opcional por perfil de referência:

- No perfil: seletor "Foco da curadoria" → Viral | Posicionamento.
- Em cada @ de referência: "Herdar do perfil" (padrão) ou sobrescrever para Viral/Posicionamento.

Como cada foco muda a busca e o filtro:

```text
VIRAL           busca 12 posts recentes → ranqueia por views + engajamento
                → avalia só os 5 melhores → prioriza tração alta
POSICIONAMENTO  busca 12 posts → ordena por data (mais recentes primeiro)
                → avalia os 5 mais novos → ignora views no ranking
```

O prompt de curadoria também muda de critério:
- Viral: peso maior em tração, gancho replicável, potencial de alcance.
- Posicionamento: peso maior em pertinência de tese, atualidade do assunto e ângulo
  aproveitável — post com pouca visualização ainda pode entrar.

A tela de Curadoria e as páginas de agentes passam a mostrar um selo do foco usado,
para você entender por que cada item entrou.

## 3. Detalhes técnicos

- Migração aditiva: `perfis.cta_padrao text`, `perfis.foco_curadoria text default 'posicionamento'`,
  `perfis_referencia.foco_curadoria text null` (null = herda do perfil). Regenerar os tipos.
- `curador-agent`: `APIFY_RESULTS_LIMIT` 6 → 12; ordenação dos posts antes do loop conforme o foco
  (score de engajamento = views + likes*3 + comentários*10 no viral; `timestamp` desc no posicionamento);
  mantém o teto de 5 avaliações por referência para não aumentar custo de LLM;
  prompt de score parametrizado por foco.
- `copy-agent` e `carrossel-agent`: recebem `cta_padrao` do perfil no system prompt como
  âncora da CTA (adaptável, mesma intenção e canal).
- Front: `src/routes/_authenticated/perfis.tsx` ganha o campo de CTA e o seletor de foco no editor
  de identidade, e o seletor de foco por referência na lista de @; leitura/edição direta via
  cliente Supabase, como já é feito hoje.

## Fora de escopo agora

Busca por termos/hashtags (ex: "inteligência artificial") desvinculada de perfis de referência —
fica para uma etapa seguinte, apoiada no seletor de foco criado aqui.
