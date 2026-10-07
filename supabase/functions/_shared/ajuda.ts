// Manual de uso do app, base do assistente de suporte (suporte-agent).
//
// Escrito a partir das telas reais. Quem muda uma tela, um fluxo ou um limite
// atualiza este texto no mesmo PR: o assistente só sabe o que está aqui.

/** Rotas que o assistente pode oferecer como atalho. Qualquer outra é descartada. */
export const ROTAS_ATALHO: Record<string, string> = {
  "/hoje": "Hoje",
  "/plano": "Plano da semana",
  "/roteiros": "Roteiros",
  "/carrosseis": "Carrosséis",
  "/dna": "DNA viral",
  "/configuracoes": "Configurações",
  "/assinatura": "Assinatura",
};

export const MANUAL_DO_APP = `# prevIA: manual de uso

A prevIA produz conteúdo para advogados: toda semana ela analisa os posts que mais performaram nos perfis de referência da pessoa e entrega um plano de vídeos (Reels falados) para os dias em que ela se comprometeu a postar, com roteiro pronto e, se quiser, carrossel.

## Menu
No computador, o menu fica na lateral, em dois grupos. Produção: Hoje, Plano da semana, Roteiros e Carrosséis. Marca: DNA viral. No rodapé do menu: o sininho de notificações (só aparece se ainda não estiverem ativas), Configurações, tema claro/escuro e Sair.
No celular, a barra embaixo tem Hoje, Plano, Roteiros, Carrosséis e Mais. "Mais" abre o menu completo (DNA viral, Configurações, notificações, tema e Sair).
O número ao lado de Roteiros é quantos roteiros estão esperando leitura. A bolinha em Plano aparece quando o plano da semana chegou e espera aprovação.
- Hoje (/hoje): a próxima ação do dia e a semana do ritmo.
- Plano da semana (/plano): os vídeos da semana para aprovar.
- Roteiros (/roteiros): todos os roteiros e em que etapa está cada um.
- Carrosséis (/carrosseis): os carrosséis prontos e os roteiros que ainda podem virar carrossel.
- DNA viral (/dna): posicionamento, voz, público, pilares e fórmulas de gancho.
- Configurações (/configuracoes), em abas: Perfil e voz, Referências, Carrossel, Dias de postar, Notificações e Assinatura.
"Acompanhar" agora se chama Roteiros, "Minha marca" agora se chama Configurações e "Manual de marca" agora se chama DNA viral. A Assinatura agora é uma aba de Configurações (o endereço /assinatura leva para ela). A tela "Bastidores" não existe mais para clientes.

## Hoje (/hoje)
Mostra uma ação por vez, na ordem do que está mais perto de virar post:
1. "Grave hoje": roteiro aprovado esperando gravação. O cartão tem "Gravar agora" (abre o modo gravação), "Ver o roteiro", "Copiar a fala" e "Marcar como postado".
2. "Esperando você": roteiro pronto para ler e aprovar.
3. "Seu plano chegou": plano da semana pronto para aprovar.
4. "Montando seu plano": o plano está sendo preparado.
Abaixo, a semana do ritmo (dias de postar) e a sequência de semanas cumpridas.

## Plano da semana (/plano)
- Chega todo domingo: a prevIA começa às 12h (Brasília) e o plano fica pronto à tarde. A pessoa recebe uma notificação "seu plano da semana chegou" se as notificações estiverem ativas.
- Como é feito: a prevIA lê os últimos 15 posts de cada perfil de referência, escolhe os 5 que foram mais acima do normal do próprio perfil (não os de mais views absolutas), assiste aos vídeos inteiros e lê os carrosséis slide a slide, entende por que funcionaram e cria um vídeo para cada dia do ritmo, no nicho e na voz da pessoa.
- Enquanto monta, a tela mostra 3 passos: lendo os posts, assistindo aos vídeos, transformando em vídeos da semana. Leva uns 5 minutos.
- No topo: a semana (datas) e um resumo de três linhas, com "Ler o resumo inteiro". Logo abaixo, uma faixa com um cartão por dia do ritmo mostrando o estado do vídeo daquele dia; tocar no dia leva ao vídeo. Antes de aprovar, os dias aparecem como "No plano" (ou "Fora", se o vídeo foi tirado da semana).
- Cada vídeo do plano mostra: tema, ângulo (a tese) e o gancho dos primeiros 3 segundos já escrito. A estrutura da fala e de qual post viral ele foi modelado ficam em "Ver a estrutura e de onde veio".
- Ações em cada vídeo, antes de aprovar:
  - Trocar: gera outra opção para o mesmo dia; dá para escrever um pedido (ex.: "algo mais leve").
  - Copiar gancho: copia a frase dos primeiros 3 segundos.
  - Tirar da semana: o vídeo não vira roteiro. Dá para voltar com "Manter na semana".
- Aprovar N vídeos (barra fixa no fim da tela): cada vídeo mantido vira um roteiro completo, escrito um de cada vez. A pessoa é avisada quando cada roteiro fica pronto para ler. Depois de aprovado, o plano não muda mais.
- Depois de aprovado, cada dia da faixa e cada vídeo mostram o estado do roteiro: Escrevendo, Para ler, Gravar (pronto para gravar), Postado ou Recusado. Cada vídeo ganha os atalhos "Ler e aprovar" ou "Abrir roteiro", "Copiar roteiro", o carrossel e, quando está pronto para gravar, "Marcar como postado".
- "Copiar a semana" (depois de aprovado, acima da lista): copia num texto só todos os roteiros já escritos, dia a dia, com a legenda. Os que ainda estão sendo escritos entram como "(ainda sendo escrito)".
- Sem plano ainda: o botão "Montar meu plano agora" pede um plano na hora. Só é possível um plano novo a cada 6 dias.
- Plano com erro: geralmente as referências não puderam ser lidas (perfil privado, nome digitado errado ou instabilidade do Instagram). Conferir as referências em Configurações e usar "Tentar de novo".
- No fim da tela, recolhido em "Por que esses vídeos" (toque para abrir): os padrões encontrados nos virais e a lista dos posts analisados, com link para o post original e quantas vezes ele foi acima do normal.

## Roteiros (/roteiros)
Todos os roteiros da pessoa, em três etapas (no computador, lado a lado; no celular, em abas):
- Para ler: roteiros escritos esperando a leitura e a aprovação. Os que a prevIA ainda está escrevendo aparecem no fim dessa etapa, com "A prevIA está escrevendo este roteiro…".
- Para gravar: roteiros aprovados que ainda não foram postados.
- Postados: os que já foram marcados como postados, com a data.
Os recusados ficam fora das etapas, no botão "Ver recusados" no topo.
Cada cartão tem o dia previsto do vídeo e atalhos: "Ler e aprovar" ou "Abrir roteiro", "Copiar" (o roteiro inteiro com a legenda), "Marcar como postado" (em Para gravar; o aviso tem "Desfazer") e o carrossel ("Gerar carrossel", "Gerando carrossel…", "Ver carrossel" ou "Tentar o carrossel de novo").

## Tela do roteiro (/aprovacao/<id>)
- Cada roteiro tem: gancho falado, desenvolvimento, CTA falado, legenda sugerida e direção de gravação (expressão, enquadramento, apoios no meio do vídeo). Há botões para copiar cada parte ou tudo.
- Aprovar: libera para gravar ("Aprovado, já pode gravar").
- Recusar: exige um motivo (tom, tema, formato, gancho ou outro) e um comentário opcional. A prevIA usa os motivos para acertar nos próximos roteiros.
- Depois de postar no Instagram, usar "Marcar como postado": isso conta para a semana do ritmo e a sequência na tela Hoje.
- O botão "Roteiros" no topo volta para a lista de roteiros.

## Modo gravação (teleprompter)
- Mostra só a fala do roteiro (gancho, desenvolvimento e fechamento) em letra grande, em tela escura, rolando sozinha, para gravar lendo no celular.
- Onde abrir: "Gravar agora" no cartão "Grave hoje" da tela Hoje; "Gravar" nos cartões de Roteiros que estão em Para gravar; e "Gravar" ao lado de "Copiar fala" na tela do roteiro.
- "Começar" faz uma contagem de 3 segundos e começa a rolar. Tocar no texto ou em "Pausar" para; "Continuar" retoma. No fim aparece "Do começo".
- Velocidade e tamanho da letra têm botões − e + no rodapé; as escolhas ficam lembradas no aparelho. No computador: barra de espaço pausa e continua, setas para cima e para baixo mudam a velocidade, Esc fecha.
- A linha amarela à esquerda marca onde ler, no alto da tela, perto da câmera frontal. Com o texto parado dá para rolar com o dedo.
- A tela fica acesa enquanto o modo gravação está aberto (nos navegadores que permitem).
- O modo gravação não grava o vídeo: a pessoa grava com a câmera do celular ou outro app, lendo a tela.

## Carrossel
- Pode ser gerado assim que o roteiro estiver escrito, sem precisar aprovar o roteiro antes: na tela do roteiro (seção Carrossel, logo abaixo do roteiro), botão "Gerar carrossel", direto no cartão em Roteiros ou no Plano da semana, ou na tela Carrosséis. "Regerar" escreve de novo. Enquanto o roteiro ainda está sendo escrito, não dá para gerar. Leva até 2 minutos.
- Tela Carrosséis (/carrosseis): em "Seus carrosséis", a capa de cada carrossel já no template do perfil, com o dia, o número de slides e "Ver e baixar" (abre a tela do roteiro na seção do carrossel). Os que deram erro mostram "Tentar o carrossel de novo". Embaixo, "Roteiros que ainda podem virar carrossel", cada um com "Gerar carrossel". O link "Mudar a aparência" leva a Configurações → Carrossel.
- O carrossel não é o roteiro fatiado: a prevIA escreve um formato próprio para leitura (capa que prende, uma ideia por slide, resumo que vale salvar e CTA). Cada slide tem título e corpo.
- Baixar: cada slide sai como imagem PNG 1080×1350 (formato 4:5 do Instagram); há "Baixar todos".
- Imagem da capa (opcional): na tela do roteiro, seção Carrossel, logo abaixo dos slides, no bloco "Imagem da capa". "Enviar imagem" escolhe uma foto do celular ou do computador (JPG, PNG ou WebP; foto HEIC do iPhone precisa ser exportada como JPG). A imagem entra só na capa; os outros slides continuam só com texto. Depois de colocar, dá para escolher o enquadramento (Alto, Centro ou Baixo), "Trocar imagem" e "Remover". A imagem continua na capa se o carrossel for regerado.
  - Como fica em cada modelo: no Editorial, a foto ocupa o fundo da capa e se dissolve na cor do fundo antes do traço acima do título; no Tweet, a foto aparece anexada abaixo do texto, como num post com imagem; no Marca-texto, a foto fica emoldurada no alto, acima do título. No Tweet e no Marca-texto o texto da capa fica um pouco menor para caber.
- Aparência (template), em Configurações (/configuracoes) → aba Carrossel. É preciso clicar em "Salvar" depois de mudar:
  - Modelo: Tweet (post de rede social, com foto e selo), Editorial (página de revista, título grande e fios) ou Marca-texto (o trecho-chave grifado com cor).
  - Nome de exibição, arroba, foto de perfil e selo de verificado (o que aparece depende do modelo).
  - Cores: fundo, texto e destaque (destaque nos modelos Editorial e Marca-texto).
  - Fonte dos títulos e fonte do texto: Inter, Montserrat, Poppins, DM Sans, Archivo, Playfair Display, DM Serif Display, Lora, Merriweather, Libre Baskerville.
  - A prévia mostra uma capa e um slide de conteúdo com as escolhas.

## Referências (Configurações → aba Referências)
- São os perfis do Instagram de onde a prevIA tira os virais do plano. Ela nunca copia o conteúdo: transporta o mecanismo para o nicho da pessoa.
- No onboarding são obrigatórias pelo menos 2. O plano permite até 5 ativas.
- Adicionar: digitar o @ (ou colar o link do perfil) e clicar em "Adicionar".
- Cada referência tem um foco: herdar do perfil, foco viral (posts de maior tração) ou foco posicionamento (posts mais recentes).
- Perfil privado ou inexistente não pode ser lido e faz o plano falhar se for o único.
- Dica: perfis que falam com o mesmo público que a pessoa dão planos melhores do que perfis grandes de outro assunto.

## Como a prevIA escreve como você (Configurações → aba Perfil e voz)
Campos: tom de voz, como você fecha seus posts (CTA padrão), o que buscar nas referências (posicionamento ou viral), área de atuação, nicho, cliente ideal, lista proibida (o que nunca escrever) e bordões. Tudo vale para os próximos planos, roteiros e carrosséis. É preciso salvar depois de mudar.

## DNA viral (/dna)
Documento com posicionamento, como você soa, público (dores e objeções), pilares, fórmulas de gancho, bordões, lista proibida e as primeiras quatro semanas. É gerado no fim do onboarding. Há "Baixar PDF" e o botão para gerar de novo a partir das respostas do onboarding.

## Ritmo (dias de postar)
- Definido no onboarding (padrão: segunda, quarta e sexta). O plano da semana tem um vídeo para cada dia do ritmo.
- Para mudar: Configurações → aba Dias de postar. Os sete dias aparecem como botões (de segunda a domingo); marcar ou desmarcar e clicar em "Salvar dias". É preciso ao menos um dia. Vale a partir do próximo plano. O assistente também pode mudar, com confirmação.
- No dia de postar, se já houver conteúdo pronto, a pessoa recebe o lembrete "hoje é dia de postar".

## Notificações
- Avisam quando o plano chega, quando um roteiro fica pronto e no dia de postar.
- Ativar: em Configurações → aba Notificações, botão "Ativar neste aparelho"; ou no sininho, no rodapé do menu lateral (no celular, toque em "Mais" na barra de baixo), em "Ativar notificações"; ou no convite que aparece na tela do DNA viral. O navegador pede permissão.
- As notificações são por aparelho: celular e computador precisam ser ativados cada um uma vez. A aba Notificações mostra se este aparelho já está ativo.
- iPhone: primeiro instalar o app. No Safari, tocar em Compartilhar → "Adicionar à Tela de Início", abrir a prevIA pelo ícone e então ativar as notificações.
- Se a permissão foi negada sem querer, é preciso liberar nas configurações do navegador para o site da prevIA.

## Assinatura (Configurações → aba Assinatura)
- Plano Starter: R$ 47,90 por mês, com até 5 referências, 30 roteiros e 30 carrosséis por mês. O consumo zera no dia 1 de cada mês.
- A cobrança é feita pela Kiwify. Cancelamento, troca de cartão, nota fiscal e reembolso são tratados pelo suporte humano.
- "Em teste" mostra quantos dias de teste restam. Quando o teste acaba sem assinatura, os planos semanais param.

## Onboarding
Perguntas sobre área, nicho, cliente ideal, objetivos, estilo de fala, referências (mínimo 2) e dias de postar. Ao concluir, a prevIA escreve o DNA viral e já começa o primeiro plano da semana, que fica pronto em alguns minutos.
`;
