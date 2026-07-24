const BRL_FORMATTER = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

export function roundMoney(value) {
  if (!Number.isFinite(value)) return null;
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function parseMoney(value) {
  if (value === null || value === undefined || value === '') return null;
  if (typeof value === 'number') return roundMoney(value);

  const raw = String(value)
    .replace(/\u00a0/g, ' ')
    .replace(/R\$|BRL/gi, '')
    .trim();

  if (!raw) return null;

  const normalized = raw.includes(',')
    ? raw.replace(/\./g, '').replace(',', '.')
    : raw.replace(/,(?=\d{3}(?:\D|$))/g, '').replace(/\s/g, '');

  const match = normalized.match(/-?\d+(?:\.\d+)?/);
  if (!match) return null;
  return roundMoney(Number.parseFloat(match[0]));
}

export function discountPercent(current, original) {
  if (!Number.isFinite(current) || !Number.isFinite(original) || original <= current || original <= 0) {
    return 0;
  }
  return Math.floor(((original - current) / original) * 100 + 1e-9);
}

export function savingsAmount(current, original) {
  if (!Number.isFinite(current) || !Number.isFinite(original) || original <= current) return 0;
  return roundMoney(original - current);
}

export function formatBRL(value) {
  return Number.isFinite(value) ? BRL_FORMATTER.format(value) : null;
}
