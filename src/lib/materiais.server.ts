/**
 * Conteúdo dos materiais avulsos (order bumps da Hubla).
 *
 * Fica no servidor de propósito: o que está no bundle do cliente qualquer um
 * lê. Sai só por getMaterial (materiais.functions.ts), para a conta que tem o
 * material liberado em conta_materiais, ou para admin.
 *
 * Os ganchos são informativos, sem promessa de resultado nem chamada para
 * contratar, para caberem no Provimento 205/2021 da OAB. Ao acrescentar um,
 * mantenha o tom e confira a regra citada.
 */

export type TipoGancho =
  "Pergunta" | "Pouca gente sabe" | "Mito" | "Erro comum" | "Lista" | "Situação";

export type Gancho = { texto: string; tipo: TipoGancho };

export type TemaGanchos = { id: string; nome: string; ganchos: Gancho[] };

export type SecaoGuia = {
  titulo: string;
  resumo: string;
  itens: string[];
  dica?: string;
};

export type ConteudoMaterial =
  | {
      codigo: "ganchos_previdenciario";
      titulo: string;
      intro: string;
      comoUsar: string[];
      temas: TemaGanchos[];
    }
  | {
      codigo: "gravando_celular";
      titulo: string;
      intro: string;
      secoes: SecaoGuia[];
      checklist: string[];
    };

const GANCHOS: TemaGanchos[] = [
  {
    id: "aposentadoria",
    nome: "Aposentadoria e regras de transição",
    ganchos: [
      {
        tipo: "Pergunta",
        texto:
          "Você contribuiu a vida toda e ainda não sabe quando pode se aposentar? A resposta começa no seu CNIS.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "A reforma de 2019 não acabou com a aposentadoria por tempo de contribuição para todo mundo. Quem já contribuía antes dela pode estar numa regra de transição.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Existe mais de uma regra de transição, e a melhor para você nem sempre é a que libera a aposentadoria primeiro.",
      },
      {
        tipo: "Erro comum",
        texto:
          "Pedir a aposentadoria no primeiro dia possível, sem comparar o valor em cada regra. Depois de concedida, é difícil voltar atrás.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Mulher, 62 anos. Homem, 65. Essa é a idade da aposentadoria por idade hoje, mas a idade sozinha não basta.",
      },
      {
        tipo: "Mito",
        texto:
          "“Se eu parar de contribuir, perco tudo o que já paguei.” Não é assim. Veja o que acontece com essas contribuições.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "O tempo de serviço militar pode contar para a sua aposentadoria. Pouca gente pede.",
      },
      {
        tipo: "Situação",
        texto:
          "Trabalhou na roça antes de ir para a cidade? Esse tempo pode entrar na conta da sua aposentadoria.",
      },
      {
        tipo: "Lista",
        texto: "Três documentos para separar antes de pedir a aposentadoria.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Por que duas pessoas com o mesmo tempo de contribuição se aposentam com valores diferentes?",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Desde a reforma, o valor da aposentadoria considera todos os seus salários desde julho de 1994, inclusive os mais baixos.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Aposentou e continua trabalhando? Veja o que acontece com as contribuições que você segue pagando.",
      },
    ],
  },
  {
    id: "especial",
    nome: "Aposentadoria especial",
    ganchos: [
      {
        tipo: "Pergunta",
        texto:
          "Você trabalha exposto a barulho, produto químico ou agente biológico? Isso pode mudar a sua aposentadoria.",
      },
      {
        tipo: "Situação",
        texto:
          "Enfermagem, frentista, metalurgia, vigilância: atividades que podem ter tempo especial e que muita gente nem confere.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "O documento que decide a sua aposentadoria especial não fica com o INSS. Fica com a empresa onde você trabalhou.",
      },
      {
        tipo: "Erro comum",
        texto:
          "Entregar o PPP sem conferir. Um erro nele pode fazer o INSS negar o tempo especial. Veja o que olhar.",
      },
      {
        tipo: "Situação",
        texto:
          "A empresa fechou e você nunca pegou o PPP? Ainda existem caminhos para provar o tempo especial.",
      },
      {
        tipo: "Mito",
        texto:
          "“Usei EPI, então perdi o tempo especial.” Para o ruído, o STF decidiu que não é bem assim.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "O tempo especial trabalhado antes de novembro de 2019 pode virar tempo comum com acréscimo, e isso pode adiantar a sua aposentadoria.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Depois da reforma, a aposentadoria especial passou a ter idade mínima. Quem já trabalhava antes dela tem uma regra de transição própria.",
      },
      {
        tipo: "Mito",
        texto:
          "“Só tem tempo especial quem recebe adicional de insalubridade.” O que o INSS olha é a exposição comprovada, não o contracheque.",
      },
      {
        tipo: "Situação",
        texto: "Trabalhou em hospital nos anos 90? Esse período merece uma segunda olhada.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Qual o limite de ruído que conta como tempo especial? Ele mudou ao longo dos anos, e isso muda a conta do seu tempo.",
      },
      {
        tipo: "Lista",
        texto: "Três perguntas para descobrir se o seu trabalho pode ter tempo especial.",
      },
    ],
  },
  {
    id: "bpc",
    nome: "BPC/LOAS",
    ganchos: [
      {
        tipo: "Pouca gente sabe",
        texto: "BPC não é aposentadoria. Entender a diferença evita muita frustração.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Quem nunca contribuiu para o INSS pode ter direito a um benefício de um salário mínimo. Veja quem.",
      },
      {
        tipo: "Erro comum",
        texto:
          "Deixar o CadÚnico desatualizado. Isso pode travar o pedido do BPC antes de qualquer análise.",
      },
      {
        tipo: "Mito",
        texto:
          "“Quem recebe BPC não pode ter ninguém trabalhando em casa.” O que conta é a renda por pessoa da família.",
      },
      {
        tipo: "Pergunta",
        texto: "BPC para criança com autismo: o que o INSS avalia de verdade?",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Na renda da família que o INSS considera para o BPC, alguns valores ficam fora da conta. Veja quais.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "O BPC não paga 13º e não deixa pensão por morte. Saber disso antes muda a decisão.",
      },
      {
        tipo: "Situação",
        texto: "Teve o BPC negado por causa da renda? Vale entender como essa conta foi feita.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Quem recebe BPC por deficiência pode começar a trabalhar? A lei mudou nos últimos anos.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "A idade do BPC para a pessoa idosa é 65 anos. Mas a idade é só uma parte do pedido.",
      },
      {
        tipo: "Situação",
        texto: "O INSS chamou para revisar o seu BPC? Veja o que separar antes.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Para o BPC, deficiência não é só o diagnóstico do laudo. O que pesa é o impedimento de longo prazo no dia a dia.",
      },
    ],
  },
  {
    id: "incapacidade",
    nome: "Auxílio por incapacidade e auxílio-acidente",
    ganchos: [
      {
        tipo: "Pouca gente sabe",
        texto:
          "O auxílio-doença mudou de nome. Hoje ele se chama auxílio por incapacidade temporária.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Ter uma doença não basta para receber o benefício. O que a perícia avalia é se você consegue trabalhar.",
      },
      {
        tipo: "Lista",
        texto: "O que levar para a perícia do INSS, e o que quase todo mundo esquece.",
      },
      {
        tipo: "Mito",
        texto:
          "“Perdi o emprego, perdi o direito.” Existe o período de graça. Veja quanto tempo ele dura.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Vai pedir o benefício só com o atestado, pelo Atestmed? Veja o que o documento precisa ter para ser aceito.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Algumas doenças dispensam as 12 contribuições de carência. Veja se o seu caso está nessa lista.",
      },
      {
        tipo: "Situação",
        texto:
          "O benefício foi cortado na perícia de revisão? Existe prazo para recorrer, e ele é curto.",
      },
      {
        tipo: "Situação",
        texto:
          "O INSS deu alta, mas a empresa não aceita a sua volta. Esse é um dos momentos mais delicados para quem está afastado.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "Acidente fora do trabalho também pode gerar benefício do INSS.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "Auxílio-acidente: o benefício que você pode receber enquanto continua trabalhando.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "A aposentadoria por incapacidade permanente pode ser revista pelo INSS. Quem recebe precisa saber disso.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Como descrever a sua rotina na perícia de um jeito que o perito entenda o seu limite?",
      },
    ],
  },
  {
    id: "pensao",
    nome: "Pensão por morte",
    ganchos: [
      {
        tipo: "Pouca gente sabe",
        texto:
          "A pensão por morte nem sempre é para a vida toda. A duração depende da idade de quem fica e do tempo de união.",
      },
      {
        tipo: "Pergunta",
        texto:
          "União estável sem papel passado dá direito a pensão? Dá, mas precisa de prova. Veja quais.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Depois da reforma, a pensão por morte deixou de ser o valor cheio da aposentadoria.",
      },
      {
        tipo: "Pergunta",
        texto: "Filho recebe pensão até quantos anos? E se ainda estiver na faculdade?",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "A ex-esposa que recebia pensão alimentícia pode ter direito à pensão por morte.",
      },
      {
        tipo: "Situação",
        texto:
          "A pessoa faleceu quando não estava mais contribuindo. A família ainda pode ter direito à pensão?",
      },
      {
        tipo: "Mito",
        texto:
          "“Não dá para receber pensão e aposentadoria ao mesmo tempo.” Dá, com uma regra de redução. Veja como funciona.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "Casamento recente pode significar pensão de só 4 meses. Entenda essa regra.",
      },
      {
        tipo: "Lista",
        texto: "Os documentos que a família precisa juntar para pedir a pensão por morte.",
      },
      {
        tipo: "Pergunta",
        texto: "Pais podem receber pensão pelo filho que faleceu? Em alguns casos, sim.",
      },
      {
        tipo: "Erro comum",
        texto:
          "Demorar para pedir a pensão. O prazo do pedido muda a partir de quando a família recebe.",
      },
      {
        tipo: "Pergunta",
        texto: "Quem recebia BPC deixa pensão para a família? Veja por que não.",
      },
    ],
  },
  {
    id: "maternidade",
    nome: "Salário-maternidade",
    ganchos: [
      {
        tipo: "Pouca gente sabe",
        texto: "Salário-maternidade não é só para quem tem carteira assinada.",
      },
      {
        tipo: "Pergunta",
        texto: "MEI tem direito a salário-maternidade? Veja as regras.",
      },
      {
        tipo: "Situação",
        texto:
          "Estava desempregada quando o bebê nasceu? Dependendo de quando parou de contribuir, ainda pode receber.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "Adoção também dá direito a salário-maternidade, e quem recebe pode ser o pai.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "A trabalhadora rural pode receber salário-maternidade comprovando a atividade no campo, sem ter contribuído em dinheiro.",
      },
      {
        tipo: "Mito",
        texto: "“O bebê nasceu e eu estava desempregada, então perdi o direito.” Nem sempre.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "Aborto espontâneo também dá direito a duas semanas de salário-maternidade.",
      },
      {
        tipo: "Pergunta",
        texto: "Gêmeos dobram o salário-maternidade? Não. Veja o que muda.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Se a mãe falece, o pai pode receber o restante do salário-maternidade para cuidar do bebê.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Quantas contribuições a autônoma precisa para o salário-maternidade? O STF mudou essa resposta.",
      },
      {
        tipo: "Lista",
        texto: "O passo a passo para pedir o salário-maternidade pelo Meu INSS.",
      },
    ],
  },
  {
    id: "revisao",
    nome: "CNIS, revisão e benefício negado",
    ganchos: [
      {
        tipo: "Pouca gente sabe",
        texto:
          "Pode estar faltando no seu CNIS um emprego que você teve. Isso mexe no tempo e no valor da aposentadoria.",
      },
      {
        tipo: "Lista",
        texto: "Como ler o seu CNIS em um minuto e achar os erros mais comuns.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "A revisão da aposentadoria tem prazo: 10 anos, contados a partir do mês seguinte ao primeiro pagamento.",
      },
      {
        tipo: "Situação",
        texto:
          "Alguém te ofereceu a revisão da vida toda? Veja o que o STF decidiu antes de assinar qualquer coisa.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Aquelas siglas ao lado de cada vínculo no CNIS dizem muito sobre o que o INSS vai ou não considerar.",
      },
      {
        tipo: "Situação",
        texto: "O salário que aparece no seu CNIS é menor do que você recebia? Dá para corrigir.",
      },
      {
        tipo: "Situação",
        texto:
          "A aposentadoria saiu com um valor menor do que você esperava. Por onde começar a conferir.",
      },
      {
        tipo: "Erro comum",
        texto: "Ignorar a carta de exigência do INSS. O prazo para responder é curto.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Benefício negado não encerra o assunto. Existem dois caminhos, e o recurso no INSS tem prazo de 30 dias.",
      },
      {
        tipo: "Mito",
        texto:
          "“O INSS já calculou, então está certo.” O cálculo só é tão bom quanto os dados que estão no sistema.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Trabalhou sem registro na carteira? Esse período pode ser reconhecido. Veja que provas ajudam.",
      },
      {
        tipo: "Erro comum",
        texto:
          "Pagar contribuições de autônomo em atraso achando que todas contam como carência. Nem todas contam.",
      },
    ],
  },
  {
    id: "planejamento",
    nome: "Planejamento e contribuição",
    ganchos: [
      {
        tipo: "Mito",
        texto: "“Planejamento previdenciário é coisa para quem está perto de se aposentar.”",
      },
      {
        tipo: "Erro comum",
        texto: "Contribuir pelo mínimo a vida toda. O custo dessa escolha só aparece no fim.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Desde a reforma, a contribuição abaixo do salário mínimo não conta para o tempo, a não ser que você complemente.",
      },
      {
        tipo: "Pergunta",
        texto: "MEI: a contribuição de 5% dá direito a quais benefícios? E a qual ela não dá?",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Quem cuida da casa pode contribuir para o INSS. Existe até uma alíquota própria para isso.",
      },
      {
        tipo: "Pergunta",
        texto: "Vale a pena pagar contribuições atrasadas? Depende de três coisas.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Quanto falta para você se aposentar? A simulação do Meu INSS mostra uma parte da resposta.",
      },
      {
        tipo: "Mito",
        texto: "“Quem contribui sobre o teto se aposenta com o teto.” Veja por que nem sempre.",
      },
      {
        tipo: "Erro comum",
        texto: "O profissional liberal que contribui só nos meses em que sobra dinheiro.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Trabalha com carteira e também por conta própria? As duas contribuições podem somar, até o teto.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Os últimos anos antes da aposentadoria são os que mais merecem atenção. Veja por quê.",
      },
      {
        tipo: "Erro comum",
        texto: "Pedir a aposentadoria cedo demais. Depois de concedida, o valor dificilmente muda.",
      },
    ],
  },
  {
    id: "rural",
    nome: "Trabalhador rural",
    ganchos: [
      {
        tipo: "Pouca gente sabe",
        texto: "O trabalhador rural se aposenta por idade mais cedo: 55 anos a mulher, 60 o homem.",
      },
      {
        tipo: "Lista",
        texto:
          "Trabalhou na roça sem carteira? Os documentos que ajudam a provar a atividade rural.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "A autodeclaração do segurado especial mudou a forma de comprovar o trabalho rural.",
      },
      {
        tipo: "Situação",
        texto: "Morou um tempo na cidade? Isso não apaga automaticamente o seu tempo de roça.",
      },
      {
        tipo: "Situação",
        texto:
          "Filho de agricultor que trabalhou com os pais desde cedo: esse tempo pode contar para a aposentadoria.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "Aposentadoria híbrida: para quem tem tempo na roça e tempo na cidade.",
      },
      {
        tipo: "Pergunta",
        texto:
          "Ter terra maior ou máquina tira a condição de segurado especial? Depende. Veja do quê.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "O pescador artesanal também é segurado especial do INSS.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "A esposa do agricultor pode ter direito à aposentadoria rural mesmo sem documento da terra no nome dela.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Documento em nome do marido ou do pai pode servir de prova do trabalho rural da mulher.",
      },
      {
        tipo: "Erro comum",
        texto: "Três erros que podem fazer o INSS negar a aposentadoria rural.",
      },
    ],
  },
  {
    id: "deficiencia",
    nome: "Pessoa com deficiência",
    ganchos: [
      {
        tipo: "Pouca gente sabe",
        texto: "A pessoa com deficiência pode se aposentar com menos tempo de contribuição.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "Na aposentadoria por idade da pessoa com deficiência, a idade mínima é menor: 55 anos para a mulher, 60 para o homem.",
      },
      {
        tipo: "Mito",
        texto: "“Só deficiência grave dá aposentadoria especial.” A deficiência leve também entra.",
      },
      {
        tipo: "Pouca gente sabe",
        texto: "A visão monocular é reconhecida por lei como deficiência.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "As regras da aposentadoria da pessoa com deficiência ficaram de fora da reforma de 2019.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "O autismo é deficiência para todos os efeitos legais. Isso pesa nos pedidos ao INSS.",
      },
      {
        tipo: "Situação",
        texto:
          "A deficiência veio no meio da vida profissional? O tempo é calculado de forma proporcional.",
      },
      {
        tipo: "Pouca gente sabe",
        texto:
          "O INSS não avalia a deficiência só pelo laudo. Existe uma avaliação médica e outra social.",
      },
      {
        tipo: "Mito",
        texto: "“Quem se aposenta como pessoa com deficiência não pode mais trabalhar.”",
      },
    ],
  },
];

const GUIA: SecaoGuia[] = [
  {
    titulo: "O que você precisa",
    resumo: "O celular que você já tem grava bem. O que faz diferença é o que está em volta dele.",
    itens: [
      "Um apoio para o celular: tripé de mesa ou de chão. Na mão, a imagem treme e o braço cansa.",
      "Uma janela ou uma luz de frente para você.",
      "Um cômodo silencioso, de preferência com cortina, tapete ou estante (eles seguram o eco).",
      "Opcional, e o primeiro investimento que vale: um microfone de lapela que conecta no celular.",
    ],
  },
  {
    titulo: "Luz",
    resumo: "Luz de frente, suave. É o que separa o vídeo amador do vídeo que passa confiança.",
    itens: [
      "Fique de frente para a janela, com o celular entre você e ela. Nunca de costas para a janela: você vira uma sombra.",
      "Luz do teto, direto em cima da cabeça, marca olheiras. Se for a única, apague-a e use a janela.",
      "Grave sempre no mesmo horário: a luz do dia muda e o vídeo de terça fica diferente do de quinta.",
      "Se usar ring light, deixe-a um pouco acima da altura dos olhos e não muito perto, para não refletir nos óculos.",
    ],
    dica: "Teste rápido: se você consegue ver o brilho nos seus olhos na tela, a luz está boa.",
  },
  {
    titulo: "Enquadramento",
    resumo: "Vertical, na altura dos olhos, do peito para cima.",
    itens: [
      "Grave na vertical (9:16). É o formato do Reels e dos Stories.",
      "A lente na altura dos seus olhos. De baixo para cima fica intimidador; de cima para baixo, pequeno.",
      "Os olhos ficam perto da linha de cima, a um terço da altura da tela. Pouco espaço acima da cabeça.",
      "Deixe uma margem livre embaixo e nas laterais: é onde a legenda e os botões do Instagram aparecem.",
      "Fundo arrumado e simples: uma estante, uma parede, uma planta. Nada de pilha de papel.",
      "Cuidado com o que aparece atrás: processo, documento ou tela com dado de cliente nunca entra no vídeo.",
    ],
  },
  {
    titulo: "Áudio",
    resumo:
      "As pessoas perdoam uma imagem simples. Áudio ruim, quase nunca: é difícil ficar num vídeo que não se entende.",
    itens: [
      "Feche portas e janelas, desligue ventilador e ar-condicionado durante a gravação.",
      "Sem microfone, grave a no máximo um braço de distância do celular.",
      "Com lapela, prenda na roupa a um palmo do queixo e esconda o fio por dentro.",
      "Grave 5 segundos e escute com fone antes de gravar o vídeo inteiro.",
    ],
  },
  {
    titulo: "Configurações do celular",
    resumo: "Dois minutos antes de gravar evitam regravar tudo.",
    itens: [
      "Limpe a lente com a camiseta. Lente engordurada deixa tudo embaçado.",
      "Use a câmera traseira se conseguir se ver (com um espelho ou outra tela). Ela grava melhor que a frontal.",
      "Resolução 1080p ou 4K, a 30 quadros por segundo.",
      "Toque e segure no seu rosto na tela para travar o foco e a luz.",
      "Desligue filtro de beleza e efeitos.",
      "Ative o modo não perturbe: uma notificação no meio do take estraga a gravação.",
      "Confira bateria e espaço livre antes de começar.",
    ],
  },
  {
    titulo: "Como ler o roteiro sem parecer que está lendo",
    resumo: "Você não precisa decorar o texto. Precisa saber a ideia de cada trecho.",
    itens: [
      "Leia o roteiro em voz alta duas vezes antes de gravar. Troque as palavras que não são suas.",
      "Grave em blocos: uma ou duas frases por vez, olhando para a lente. Depois junte na edição.",
      "Entre um bloco e outro, olhe o texto, respire e volte a olhar para a lente antes de falar.",
      "Se usar teleprompter, deixe o texto pequeno e perto da lente, para os olhos não correrem pela tela.",
      "Fale como você explicaria para um cliente sentado na sua frente, não como uma petição.",
      "Errou uma palavra? Pare, respire e repita a frase inteira. Na edição, corta-se o erro.",
    ],
    dica: "Olhe para a lente, não para a sua imagem na tela. É o que dá a sensação de que você fala com a pessoa.",
  },
  {
    titulo: "Voz e presença",
    resumo: "No vídeo, a energia cai. Fale um pouco acima do seu tom de conversa.",
    itens: [
      "A primeira frase é o gancho. Comece por ela, com firmeza, sem “Oi, pessoal, tudo bem?”.",
      "Faça pausas curtas entre as ideias. Elas ajudam quem está ouvindo e facilitam a edição.",
      "Use as mãos como usa numa conversa, dentro do enquadramento.",
      "Roupa de cor lisa. Listras finas e estampas miúdas tremem na tela.",
    ],
  },
  {
    titulo: "Edição básica",
    resumo: "Editar é tirar o que sobra. Um aplicativo de edição gratuito no celular resolve.",
    itens: [
      "Corte silêncios, respirações longas e repetições. Vídeo enxuto segura mais gente até o fim.",
      "Coloque legenda: muita gente assiste sem som. Revise a legenda automática, ela erra termos jurídicos.",
      "Escreva o gancho também na tela, nos primeiros segundos.",
      "Música, se tiver, bem baixa, por baixo da voz.",
      "Escolha uma capa com o seu rosto e o tema do vídeo escrito em poucas palavras.",
    ],
  },
  {
    titulo: "Cuidados da advocacia",
    resumo:
      "O vídeo é informativo. O Provimento 205/2021 da OAB vale para ele como para qualquer publicidade.",
    itens: [
      "Não prometa resultado e não cite chance de ganho.",
      "Não mostre caso, documento ou conversa de cliente, nem com o nome escondido.",
      "Não fale de valores de honorários nem de gratuidade como chamariz.",
      "Feche o vídeo com uma chamada para salvar ou compartilhar o conteúdo, não para contratar.",
    ],
  },
];

const CHECKLIST: string[] = [
  "Lente limpa",
  "Celular no apoio, na vertical, na altura dos olhos",
  "De frente para a luz",
  "Fundo arrumado, sem documento à vista",
  "Portas fechadas, ventilador desligado",
  "Teste de 5 segundos de áudio ouvido no fone",
  "Foco e luz travados no rosto",
  "Modo não perturbe ligado",
  "Roteiro lido em voz alta duas vezes",
  "Primeira frase é o gancho",
];

export function conteudoDoMaterial(codigo: string): ConteudoMaterial | null {
  if (codigo === "ganchos_previdenciario") {
    return {
      codigo,
      titulo: "Banco de Ganchos · Direito Previdenciário",
      intro:
        "Frases de abertura para vídeos e carrosséis, organizadas por tema. O gancho é a primeira frase: ele decide se a pessoa fica para ouvir o resto.",
      comoUsar: [
        "Escolha um gancho do tema que você quer tratar e adapte ao seu jeito de falar.",
        "Logo depois do gancho, entregue a informação que ele anunciou. Gancho que não se cumpre derruba a confiança.",
        "Antes de publicar, confira se a regra citada vale para o caso que você vai explicar.",
        "Feche com uma chamada para salvar ou compartilhar, não para contratar (Provimento 205/2021 da OAB).",
      ],
      temas: GANCHOS,
    };
  }
  if (codigo === "gravando_celular") {
    return {
      codigo,
      titulo: "Gravando com o Celular",
      intro:
        "O guia para gravar os seus roteiros com o celular que você já tem: luz, enquadramento, áudio, como ler sem parecer que está lendo e um checklist para antes de apertar o REC.",
      secoes: GUIA,
      checklist: CHECKLIST,
    };
  }
  return null;
}
