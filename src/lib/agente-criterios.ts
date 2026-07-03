export type AgenteNome = "curador" | "ideador" | "copy" | "visual" | "revisor";

export type CriteriosAgente = {
  papel: string;
  fontes: string[];
  criterios: string[];
  gatilho: string;
};

export const AGENTE_CRITERIOS: Record<AgenteNome, CriteriosAgente> = {
  curador: {
    papel:
      "Varre os perfis de referência no Instagram e escolhe quais posts merecem virar pauta para os perfis-clientes.",
    fontes: [
      "Perfis de referência ativos (tabela perfis_referencia)",
      "Últimos posts públicos capturados via Apify",
      "Diretrizes e tom de voz do perfil-cliente relacionado",
    ],
    criterios: [
      "Analisa caption, formato, likes, comentários e views de cada post.",
      "Descarta posts já curados antes (deduplicação por URL).",
      "Pede ao modelo um score de 0 a 10 e um motivo; só salva se marcado como aproveitável.",
      "Score ≥ 7 dispara automaticamente o Ideador para gerar pauta.",
    ],
    gatilho: "Executa diariamente às 08:00 (BRT) via cron, um worker por perfil de referência.",
  },
  ideador: {
    papel:
      "Transforma uma curadoria (ou uma tese de posicionamento) em pauta acionável para o perfil-cliente.",
    fontes: [
      "Conteúdo curado com score ≥ 7 (quando existe)",
      "Diretrizes, tom de voz e nicho do perfil-cliente",
      "Últimas pautas do mesmo perfil (para evitar repetição)",
    ],
    criterios: [
      "Formato é sempre Reel falado de posicionamento (30–60s, sem carrossel).",
      "Precisa de tema + ângulo únicos frente às pautas recentes.",
      "Quando não há curadoria nova, gera uma pauta evergreen a partir das diretrizes do perfil (fallback).",
    ],
    gatilho:
      "Cron às 08:45 (BRT) roda o fallback por perfil. Fora disso, é acionado via trigger sempre que o Curador salva um conteúdo com score ≥ 7.",
  },
  copy: {
    papel: "Escreve o roteiro falado da pessoa à câmera com base na pauta.",
    fontes: [
      "Pauta gerada (tema, ângulo, formato)",
      "Diretrizes e tom de voz do perfil",
      "Roteiros rejeitados anteriormente do mesmo perfil (para não repetir padrão)",
    ],
    criterios: [
      "Estrutura fixa em 3 blocos: gancho falado, desenvolvimento, CTA.",
      "Uma única tese por vídeo — sem listas, sem 'primeiro/segundo/terceiro'.",
      "Português direto, primeira pessoa, sem emoji e sem hashtag no meio do texto.",
      "Legenda sugerida de até 280 caracteres.",
    ],
    gatilho: "Disparado automaticamente quando a pauta entra em 'em_producao'.",
  },
  visual: {
    papel: "Traduz o roteiro em direções curtas de gravação para o Reel.",
    fontes: ["Pauta gerada", "Identidade visual do perfil"],
    criterios: [
      "Foca no essencial: enquadramento, cenário, figurino, mood, elementos de apoio.",
      "Sem especificação técnica excessiva (nada de lente/ISO/kelvin).",
      "Coerente com a mensagem do roteiro.",
    ],
    gatilho: "Disparado em paralelo ao Copy quando a pauta entra em 'em_producao'.",
  },
  revisor: {
    papel: "Fecha o ciclo: só marca como 'aguardando aprovação' quando roteiro e visual estão prontos e coerentes.",
    fontes: ["Pauta", "Roteiro pronto", "Briefing visual pronto", "Histórico de decisões do perfil"],
    criterios: [
      "Aguarda tanto o roteiro quanto a arte estarem no status 'pronto'.",
      "Verifica coerência entre roteiro e briefing visual.",
      "Registra a decisão e move a pauta para 'aguardando_aprovacao' ou volta para produção.",
    ],
    gatilho:
      "Dispara via trigger quando roteiro ou arte ficam prontos; watchdog a cada 3 min garante que nada trave.",
  },
};
