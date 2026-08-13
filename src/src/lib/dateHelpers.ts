export const MONTH_LABELS_PT = [
  'jan', 'fev', 'mar', 'abr', 'mai', 'jun',
  'jul', 'ago', 'set', 'out', 'nov', 'dez',
];

export function currentYear(): number {
  return new Date().getFullYear();
}

export function currentMonth(): number {
  return new Date().getMonth() + 1; // 1-12
}

/** Um mês é "passado ou atual" (portanto Realizado, travado) se for <= mês/ano corrente. */
export function isPastOrCurrent(ano: number, mes: number): boolean {
  const nowYear = currentYear();
  const nowMonth = currentMonth();
  if (ano < nowYear) return true;
  if (ano > nowYear) return false;
  return mes <= nowMonth;
}

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}
