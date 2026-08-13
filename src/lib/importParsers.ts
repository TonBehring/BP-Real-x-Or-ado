/**
 * Remove acentos, baixa para minúsculas e ignora QUALQUER pontuação/separador
 * (espaço, "_", "/", "-", ",", ".", "'" etc.) — evita falhas de correspondência
 * por causa de pequenas variações de formatação em nomes de coluna, contas,
 * fornecedores, centros de custo etc.
 */
export function normalize(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * Converte um valor em texto (ex: "R$ 6.025,53", "-R$ 1.500,00", "(1.500,00)", "150")
 * para número absoluto (sempre positivo — a convenção do sistema é armazenar magnitudes).
 */
export function parseCurrencyToNumber(raw: string): number {
  if (!raw) return 0;
  let s = raw.trim();
  const isNegative = /^\(.*\)$/.test(s) || s.startsWith('-');
  s = s.replace(/^\(|\)$/g, '');
  s = s.replace(/^-/, '');
  s = s.replace(/R\$\s?/gi, '');
  s = s.trim();
  // formato BR: milhares com "." e decimal com ","
  if (/,\d{1,2}$/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.');
  } else {
    s = s.replace(/,/g, '');
  }
  const n = parseFloat(s);
  if (isNaN(n)) return 0;
  return isNegative ? -n : n; // preserva sinal apenas para permitir detectar estornos; chamador decide abs()
}

/** Extrai {ano, mes} de datas como "14/05/2026", "05/2026", "mai/26", "mai-26". */
export function parseMonthYear(raw: string): { ano: number; mes: number } | null {
  if (!raw) return null;
  const s = raw.trim();

  // DD/MM/YYYY ou DD/MM/YY
  let m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    const mes = parseInt(m[2], 10);
    let ano = parseInt(m[3], 10);
    if (ano < 100) ano += 2000;
    return { ano, mes };
  }

  // MM/YYYY
  m = s.match(/^(\d{1,2})\/(\d{4})$/);
  if (m) {
    return { mes: parseInt(m[1], 10), ano: parseInt(m[2], 10) };
  }

  // mmm/YY ou mmm-YY (jan/26, mai.-26 etc.)
  const monthMap: Record<string, number> = {
    jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6,
    jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
  };
  m = s.toLowerCase().match(/^([a-zç]{3})\.?[/-](\d{2,4})$/);
  if (m && monthMap[m[1]]) {
    let ano = parseInt(m[2], 10);
    if (ano < 100) ano += 2000;
    return { ano, mes: monthMap[m[1]] };
  }

  return null;
}
