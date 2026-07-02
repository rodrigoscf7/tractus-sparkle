## Objetivo

Cadastrar a nova cliente **Márcia Canuto** como um perfil ativo no dashboard, com identidade e diretrizes ricas o suficiente para que curador → ideador → copy → visual gerem Reels falados alinhados ao raio-x fornecido.

## O que será feito

Uma única migração de dados (INSERT no `perfis`), sem mudança de schema, sem mudança de código, sem mudança de UI. O perfil aparecerá automaticamente em `/perfis`, `/agentes/*` e no pipeline assim que inserido.

Depois de criado, o próximo passo natural (que **não** faz parte desta migração — fica pra você fazer pela tela `/perfis` ou pedir num próximo turno) é adicionar os handles do Instagram que servirão de referência pra curadoria dela.

## Estrutura do registro

Campos da tabela `perfis` que serão preenchidos:

- **nome**: `Márcia Canuto`
- **tipo**: `cliente` (novo valor — segue o padrão livre já usado: `institucional`, `socio`)
- **tom_de_voz**: resumo em 1 linha para o cabeçalho dos prompts
- **diretrizes** (JSON): posicionamento, mantra, motor psicológico (medo de perda / prova de ganho oculto / inimigo nomeado), pilares de conteúdo, regras práticas, temas a evitar
- **identidade_visual** (JSON): direção enxuta para gravação de Reel falado — cenário sugerido, figurino, clima, texto em tela padrão. Sem paleta/tipografia inventada (você não passou identidade visual; melhor deixar como direção de gravação do que fabricar cores).

## Conteúdo proposto para `diretrizes`

```json
{
  "posicionamento": "Advogada previdenciária que defende o beneficiário contra o INSS — avisa antes que o sistema prejudique.",
  "publico": "Aposentados, pensionistas e famílias que dependem de benefício do INSS e têm medo de perder direito ou de cair em armadilha administrativa.",
  "tom_de_voz": "Proximidade regional, humor leve, zero juridiquês. Frases curtas. Alerta antes de didatismo.",
  "mantras": [
    "Na luta dos direitos contra o INSS"
  ],
  "motor_psicologico": {
    "medo_de_perda": "corte de benefício, perícia negada, prazo perdido",
    "prova_de_ganho_oculto": "valor em R$, benefício desconhecido, revisão possível",
    "inimigo_nomeado": "INSS, perito, CRAS"
  },
  "pilares_conteudo": [
    "Alerta de armadilha do INSS",
    "Direito oculto com valor concreto",
    "Bastidor humanizado do escritório"
  ],
  "regras_de_gancho": [
    "Título sempre com alerta, pergunta retórica ou urgência de notícia — nunca afirmação neutra",
    "Sempre que possível incluir número concreto (prazo, valor, quantidade)",
    "Nomear o antagonista institucional (INSS/perito/CRAS) na maior parte dos ganchos",
    "Vocabulário cotidiano, frases curtas, zero jargão técnico-jurídico"
  ],
  "temas_evitar": [
    "juridiquês e citação de artigo de lei no gancho",
    "tom institucional/formal de escritório tradicional",
    "promessa de ganhar causa"
  ]
}
```

## Conteúdo proposto para `identidade_visual`

```json
{
  "formato_padrao": "Reel falado 30-60s, câmera na altura dos olhos, ambiente do escritório ou fundo neutro claro",
  "figurino_padrao": "Traje profissional discreto, sem toga, sem paletó pesado — proximidade regional",
  "clima_padrao": "confidencial e protetor, como quem avisa alguém antes que aconteça",
  "texto_em_tela_padrao": "frase-alerta curta (até 8 palavras) reforçando o gancho no primeiro segundo",
  "observacao": "Identidade visual gráfica ainda não definida pela cliente — visual-agent deve focar em direção de gravação, não em paleta/tipografia."
}
```

## Fora de escopo (deixado para depois)

- Cadastrar handles do Instagram de referência (você adiciona em `/perfis` clicando no card dela).
- Ajustes de agenda de cron (o perfil entra automaticamente nas próximas rodadas de 08:00 e 08:45 BRT assim que houver curadoria).
- Qualquer mudança de UI ou de prompts dos agentes.

## Detalhes técnicos

- Ferramenta: `supabase--insert` com um único `INSERT INTO public.perfis (...)` — nenhuma mudança de schema, portanto não é migração.
- `ativo` fica `true` (default).
- Nenhuma alteração em arquivos do projeto.
