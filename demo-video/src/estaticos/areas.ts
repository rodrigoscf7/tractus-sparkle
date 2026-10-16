// Conteúdo por área dos criativos 3 (a dúvida antes do contrato) e 4 (a semana
// decidida). Comentários e pautas são fictícios e seguem o que a prevIA
// escreve: tom informativo, sem promessa de resultado (Provimento 205/2021).
// O plano previdenciário é o mesmo da persona do vídeo de demonstração.

import { plano as planoPrevidenciario } from "../dados";

export type Area = "familia" | "previdenciario" | "trabalhista";

type Comentario = { usuario: string; texto: string; tempo: string };
type Pauta = { dia: string; data: string; tema: string; gancho: string };

export const AREAS: Record<
  Area,
  { rotulo: string; tratamento: string; comentarios: Comentario[]; plano: Pauta[] }
> = {
  familia: {
    rotulo: "Direito de Família",
    tratamento: "Doutora",
    comentarios: [
      { usuario: "camila.rs", texto: "Doutora, e se ele parar de pagar a pensão? Tenho que esperar quanto tempo?", tempo: "2 h" },
      { usuario: "jessica_m", texto: "Dá pra pedir guarda compartilhada se o pai mora em outra cidade?", tempo: "5 h" },
      { usuario: "renata.lima", texto: "Preciso mesmo de advogado pra fazer o divórcio?", tempo: "1 d" },
    ],
    plano: [
      { dia: "Seg", data: "20/10", tema: "Pensão atrasada: o que fazer no primeiro mês", gancho: "A pensão atrasou de novo? Antes de esperar mais um mês, você precisa saber disso." },
      { dia: "Qua", data: "22/10", tema: "Guarda compartilhada com pais em cidades diferentes", gancho: "Guarda compartilhada com o pai morando em outra cidade? Dá, e funciona assim." },
      { dia: "Sex", data: "24/10", tema: "Quando o divórcio pode ser feito em cartório", gancho: "Nem todo divórcio precisa passar pelo juiz. Veja se o seu é um deles." },
    ],
  },
  previdenciario: {
    rotulo: "Direito Previdenciário",
    tratamento: "Doutor",
    comentarios: [
      { usuario: "seu.antonio58", texto: "Doutor, meu auxílio foi negado. Ainda dá pra recorrer?", tempo: "3 h" },
      { usuario: "marcia.alves", texto: "Trabalhei 5 anos sem carteira assinada. Isso conta pra aposentadoria?", tempo: "6 h" },
      { usuario: "joao_pedro.s", texto: "Quanto tempo demora uma revisão de aposentadoria?", tempo: "1 d" },
    ],
    plano: planoPrevidenciario.map(({ dia, data, tema, gancho }) => ({ dia, data, tema, gancho })),
  },
  trabalhista: {
    rotulo: "Direito do Trabalho",
    tratamento: "Doutora",
    comentarios: [
      { usuario: "bia.santos", texto: "Fui demitida grávida. A empresa podia ter feito isso?", tempo: "1 h" },
      { usuario: "rafael.cm", texto: "Fazia hora extra todo dia e nunca recebi. Ainda dá tempo de cobrar?", tempo: "4 h" },
      { usuario: "lu.ferreira", texto: "Se eu pedir demissão, perco o quê?", tempo: "1 d" },
    ],
    plano: [
      { dia: "Seg", data: "20/10", tema: "Demissão durante a gravidez", gancho: "Foi demitida grávida e a empresa disse que estava tudo certo? Confere isso antes de assinar." },
      { dia: "Qua", data: "22/10", tema: "Hora extra que nunca entrou no holerite", gancho: "Fazia hora extra todo dia e nunca viu isso no holerite? Ainda pode dar tempo." },
      { dia: "Sex", data: "24/10", tema: "Pedido de demissão: o que se perde e o que não", gancho: "Vai pedir demissão? Tem um direito que muita gente abre mão sem perceber." },
    ],
  },
};
