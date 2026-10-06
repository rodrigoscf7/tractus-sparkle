const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** "2026-10-06" ou ISO completo → "6 out". */
export function dataCurta(iso: string) {
  const [, m, d] = iso.slice(0, 10).split("-");
  return `${Number(d)} ${MESES[Number(m) - 1]}`;
}

/** "2026-10-06" → "seg". Lê a data como dia do calendário, sem fuso. */
export function diaDaSemana(iso: string) {
  const [a, m, d] = iso.slice(0, 10).split("-").map(Number);
  return DIAS[new Date(a, m - 1, d).getDay()];
}

/** Data e hora locais de um instante (ex.: quando foi postado) → "6 out". */
export function dataLocalCurta(instante: string) {
  const d = new Date(instante);
  return `${d.getDate()} ${MESES[d.getMonth()]}`;
}
