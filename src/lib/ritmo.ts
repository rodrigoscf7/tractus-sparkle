/**
 * Ritmo semanal: o compromisso do usuário e o que ele cumpriu.
 *
 * Só cálculo puro sobre datas e publicações — nada de rede aqui, para a tela
 * `Hoje` e o futuro disparo de notificação lerem a mesma verdade.
 *
 * Convenção de dia da semana: 0=domingo … 6=sábado, igual a `Date.getDay()` e a
 * `extract(dow)` do Postgres, que é como `perfis.ritmo_dias` guarda.
 */

export const RITMO_PADRAO = [1, 3, 5];

export const DIAS_SEMANA = [
  { dow: 0, curto: "dom", longo: "Domingo" },
  { dow: 1, curto: "seg", longo: "Segunda" },
  { dow: 2, curto: "ter", longo: "Terça" },
  { dow: 3, curto: "qua", longo: "Quarta" },
  { dow: 4, curto: "qui", longo: "Quinta" },
  { dow: 5, curto: "sex", longo: "Sexta" },
  { dow: 6, curto: "sáb", longo: "Sábado" },
] as const;

export type EstadoDia = "postado" | "hoje" | "previsto" | "perdido";

export type DiaDoRitmo = {
  dow: number;
  data: Date;
  estado: EstadoDia;
  /** Tema do post publicado naquele dia, quando houve. */
  tema: string | null;
};

/** Meia-noite local — todas as comparações de dia acontecem nessa granularidade. */
export function inicioDoDia(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

/** Segunda-feira da semana de `referencia`. A semana do produto começa na segunda. */
export function inicioDaSemana(referencia: Date) {
  const d = inicioDoDia(referencia);
  // getDay() devolve 0 para domingo; nesse caso a segunda é 6 dias atrás.
  const recuo = d.getDay() === 0 ? 6 : d.getDay() - 1;
  d.setDate(d.getDate() - recuo);
  return d;
}

export function mesmoDia(a: Date, b: Date) {
  return inicioDoDia(a).getTime() === inicioDoDia(b).getTime();
}

export type PublicacaoPostada = { postado_em: string; tema?: string | null };

/**
 * Monta a pauta da semana: um item por dia com que o usuário se comprometeu,
 * em ordem, já classificado. Dias comprometidos que passaram sem post viram
 * `perdido` — a tela precisa mostrar o buraco, não escondê-lo.
 */
export function pautaDaSemana(
  ritmoDias: number[],
  postados: PublicacaoPostada[],
  hoje = new Date(),
): DiaDoRitmo[] {
  const segunda = inicioDaSemana(hoje);
  const hojeZero = inicioDoDia(hoje);

  // Ordem da semana (seg→dom), não a ordem em que o usuário escolheu os dias.
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  const dias = ordem.filter((d) => ritmoDias.includes(d));

  return dias.map((dow) => {
    const data = new Date(segunda);
    data.setDate(segunda.getDate() + ordem.indexOf(dow));

    const post = postados.find((p) => mesmoDia(new Date(p.postado_em), data));
    const estado: EstadoDia = post
      ? "postado"
      : mesmoDia(data, hojeZero)
        ? "hoje"
        : data < hojeZero
          ? "perdido"
          : "previsto";

    return { dow, data, estado, tema: post?.tema ?? null };
  });
}

/**
 * Quantas semanas seguidas, até a anterior, tiveram pelo menos tantos posts
 * quanto o compromisso. A semana corrente não conta: ainda dá tempo de cumprir,
 * e contá-la faria a sequência cair e subir no meio da semana.
 */
export function semanasSeguidas(
  ritmoDias: number[],
  postados: PublicacaoPostada[],
  hoje = new Date(),
): number {
  const meta = Math.max(1, ritmoDias.length);
  const semanaAtual = inicioDaSemana(hoje);

  let sequencia = 0;
  for (let voltas = 1; voltas <= 52; voltas++) {
    const inicio = new Date(semanaAtual);
    inicio.setDate(inicio.getDate() - 7 * voltas);
    const fim = new Date(inicio);
    fim.setDate(fim.getDate() + 7);

    const naSemana = postados.filter((p) => {
      const d = new Date(p.postado_em);
      return d >= inicio && d < fim;
    }).length;

    if (naSemana >= meta) sequencia++;
    else break;
  }
  return sequencia;
}

/** "seg · qua · sex" */
export function descreverRitmo(ritmoDias: number[]) {
  const ordem = [1, 2, 3, 4, 5, 6, 0];
  return ordem
    .filter((d) => ritmoDias.includes(d))
    .map((d) => DIAS_SEMANA.find((x) => x.dow === d)?.curto ?? "")
    .join(" · ");
}

export function rotuloSemana(referencia = new Date()) {
  const inicio = inicioDaSemana(referencia);
  const fim = new Date(inicio);
  fim.setDate(fim.getDate() + 6);

  const mesmoMes = inicio.getMonth() === fim.getMonth();
  const dia = (d: Date) => d.getDate();
  const mes = (d: Date) => d.toLocaleDateString("pt-BR", { month: "long" });

  return mesmoMes
    ? `Semana de ${dia(inicio)} a ${dia(fim)} de ${mes(fim)}`
    : `Semana de ${dia(inicio)} de ${mes(inicio)} a ${dia(fim)} de ${mes(fim)}`;
}
