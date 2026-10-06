// Manual de uso do app, base do assistente de suporte (suporte-agent).
//
// Escrito a partir das telas reais. Quem muda uma tela, um fluxo ou um limite
// atualiza este texto no mesmo PR: o assistente só sabe o que está aqui.

/** Rotas que o assistente pode oferecer como atalho. Qualquer outra é descartada. */
export const ROTAS_ATALHO: Record<string, string> = {
  "/hoje": "Hoje",
  "/plano": "Plano da semana",
  "/pipeline": "Acompanhar",
  "/perfis": "Minha marca",
  "/dna": "Manual de marca",
  "/assinatura": "Assinatura",
};

export const MANUAL_DO_APP = `# prevIA: manual de uso

A prevIA produz conteúdo para advogados: toda semana ela analisa os posts que mais performaram nos perfis de referência da pessoa e entrega um plano de vídeos (Reels falados) para os dias em que ela se comprometeu a postar, com roteiro pronto e, se quiser, carrossel.

## Menu
- Hoje (/hoje): a próxima ação do dia e a semana do ritmo.
- Plano da semana (/plano): os vídeos da semana para aprovar.
- Acompanhar (/pipeline): em que etapa está cada vídeo.
- Minha marca (/perfis): voz, fechamento padrão, referências e template do carrossel.
- Manual de marca (/dna): posicionamento, voz, público, pilares e fórmulas de gancho.
- Assinatura (/assinatura): plano, consumo do mês e situação da assinatura.
- Bastidores: mostra os agentes da prevIA trabalhando. Não exige nenhuma ação.

## Hoje (/hoje)
Mostra uma ação por vez, na ordem do que está mais perto de virar post:
1. "Grave hoje": roteiro aprovado esperando gravação.
2. "Esperando você": roteiro pronto para ler e aprovar.
3. "Seu plano chegou": plano da semana pronto para aprovar.
4. "Montando seu plano": o plano está sendo preparado.
Abaixo, a semana do ritmo (dias de postar) e a sequência de semanas cumpridas.

## Plano da semana (/plano)
- Chega todo domingo: a prevIA começa às 12h (Brasília) e o plano fica pronto à tarde. A pessoa recebe uma notificação "seu plano da semana chegou" se as notificações estiverem ativas.
- Como é feito: a prevIA lê os últimos 15 posts de cada perfil de referência, escolhe os 5 que foram mais acima do normal do próprio perfil (não os de mais views absolutas), assiste aos vídeos inteiros e lê os carrosséis slide a slide, entende por que funcionaram e cria um vídeo para cada dia do ritmo, no nicho e na voz da pessoa.
- Enquanto monta, a tela mostra 3 passos: lendo os posts, assistindo aos vídeos, transformando em vídeos da semana. Leva uns 5 minutos.
- Cada vídeo do plano tem: tema, ângulo (a tese), o gancho dos primeiros 3 segundos já escrito, a estrutura da fala e de qual post viral ele foi modelado.
- Ações em cada vídeo, antes de aprovar:
  - Trocar: gera outra opção para o mesmo dia; dá para escrever um pedido (ex.: "algo mais leve").
  - Tirar da semana: o vídeo não vira roteiro. Dá para voltar com "Manter na semana".
- Aprovar N vídeos: cada vídeo mantido vira um roteiro completo, escrito um de cada vez. A pessoa é avisada quando cada roteiro fica pronto para ler. Depois de aprovado, o plano não muda mais.
- Sem plano ainda: o botão "Montar meu plano agora" pede um plano na hora. Só é possível um plano novo a cada 6 dias.
- Plano com erro: geralmente as referências não puderam ser lidas (perfil privado, nome digitado errado ou instabilidade do Instagram). Conferir as referências em Minha marca e usar "Tentar de novo".
- No fim da tela: os padrões encontrados nos virais e a lista dos posts analisados, com link para o post original e quantas vezes ele foi acima do normal.

## Roteiros e aprovação (/aprovacao/<id>)
- Cada roteiro tem: gancho falado, desenvolvimento, CTA falado, legenda sugerida e direção de gravação (expressão, enquadramento, apoios no meio do vídeo). Há botões para copiar cada parte ou tudo.
- Aprovar: libera para gravar ("Aprovado, já pode gravar").
- Recusar: exige um motivo (tom, tema, formato, gancho ou outro) e um comentário opcional. A prevIA usa os motivos para acertar nos próximos roteiros.
- Depois de postar no Instagram, usar "Marcar como postado": isso conta para a semana do ritmo e a sequência na tela Hoje.
- A lista de todos os roteiros e em que etapa estão fica em Acompanhar (/pipeline).

## Carrossel
- É gerado na tela do roteiro, depois que o roteiro é aprovado: botão "Gerar carrossel". "Regerar" escreve de novo.
- O carrossel não é o roteiro fatiado: a prevIA escreve um formato próprio para leitura (capa que prende, uma ideia por slide, resumo que vale salvar e CTA). Cada slide tem título e corpo.
- Baixar: cada slide sai como imagem PNG 1080×1350 (formato 4:5 do Instagram); há "Baixar todos".
- Aparência (template), em Minha marca (/perfis) → "Template do carrossel". É preciso clicar em "Salvar" depois de mudar:
  - Modelo: Tweet (post de rede social, com foto e selo), Editorial (página de revista, título grande e fios) ou Marca-texto (o trecho-chave grifado com cor).
  - Nome de exibição, arroba, foto de perfil e selo de verificado (o que aparece depende do modelo).
  - Cores: fundo, texto e destaque (destaque nos modelos Editorial e Marca-texto).
  - Fonte dos títulos e fonte do texto: Inter, Montserrat, Poppins, DM Sans, Archivo, Playfair Display, DM Serif Display, Lora, Merriweather, Libre Baskerville.
  - A prévia mostra uma capa e um slide de conteúdo com as escolhas.

## Referências (Minha marca → "Onde buscar repertório")
- São os perfis do Instagram de onde a prevIA tira os virais do plano. Ela nunca copia o conteúdo: transporta o mecanismo para o nicho da pessoa.
- No onboarding são obrigatórias pelo menos 2. O plano permite até 5 ativas.
- Adicionar: digitar o @ (ou colar o link do perfil) e clicar em "Adicionar".
- Cada referência tem um foco: herdar do perfil, foco viral (posts de maior tração) ou foco posicionamento (posts mais recentes).
- Perfil privado ou inexistente não pode ser lido e faz o plano falhar se for o único.
- Dica: perfis que falam com o mesmo público que a pessoa dão planos melhores do que perfis grandes de outro assunto.

## Como a prevIA escreve como você (Minha marca)
Campos: tom de voz, como você fecha seus posts (CTA padrão), o que buscar nas referências (posicionamento ou viral), área de atuação, nicho, cliente ideal, lista proibida (o que nunca escrever) e bordões. Tudo vale para os próximos planos, roteiros e carrosséis. É preciso salvar depois de mudar.

## Manual de marca (/dna)
Documento com posicionamento, como você soa, público (dores e objeções), pilares, fórmulas de gancho, bordões, lista proibida e as primeiras quatro semanas. É gerado no fim do onboarding. Há "Baixar PDF" e o botão para gerar de novo a partir das respostas do onboarding.

## Ritmo (dias de postar)
- Definido no onboarding (padrão: segunda, quarta e sexta). O plano da semana tem um vídeo para cada dia do ritmo.
- Não existe tela para mudar o ritmo depois do onboarding: quem quiser mudar pede ao assistente, que faz a alteração com confirmação.
- No dia de postar, se já houver conteúdo pronto, a pessoa recebe o lembrete "hoje é dia de postar".

## Notificações
- Avisam quando o plano chega, quando um roteiro fica pronto e no dia de postar.
- Ativar: no sininho, que fica no rodapé do menu lateral (no celular, abra o menu pelo botão ☰ no topo), em "Ativar notificações"; ou no convite que aparece na tela do Manual de marca. O navegador pede permissão. O sininho não fica dentro de Minha marca.
- iPhone: primeiro instalar o app. No Safari, tocar em Compartilhar → "Adicionar à Tela de Início", abrir a prevIA pelo ícone e então ativar as notificações.
- Se a permissão foi negada sem querer, é preciso liberar nas configurações do navegador para o site da prevIA.

## Assinatura (/assinatura)
- Plano Starter: R$ 47,90 por mês, com até 5 referências, 30 roteiros e 30 carrosséis por mês. O consumo zera no dia 1 de cada mês.
- A cobrança é feita pela Kiwify. Cancelamento, troca de cartão, nota fiscal e reembolso são tratados pelo suporte humano.
- "Em teste" mostra quantos dias de teste restam. Quando o teste acaba sem assinatura, os planos semanais param.

## Onboarding
Perguntas sobre área, nicho, cliente ideal, objetivos, estilo de fala, referências (mínimo 2) e dias de postar. Ao concluir, a prevIA escreve o manual de marca e já começa o primeiro plano da semana, que fica pronto em alguns minutos.
`;
