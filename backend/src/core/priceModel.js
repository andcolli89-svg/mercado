import { discountPercent, roundMoney, savingsAmount } from './money.js';

const SOURCE_PRIORITY = Object.freeze({
  sale_price_api: 100,
  catalog_buy_box: 92,
  item_api: 82,
  structured_data: 76,
  embedded_state: 70,
  visible_labeled_price: 60,
});

export function priceCandidate({
  amount,
  kind = 'current',
  source,
  confidence = 0.5,
  currency = 'BRL',
  label = '',
  context = [],
  itemId = null,
  variantId = null,
}) {
  return {
    amount: roundMoney(Number(amount)),
    kind,
    source,
    confidence: Math.max(0, Math.min(1, Number(confidence) || 0)),
    currency,
    label,
    context: Array.isArray(context) ? context : [],
    itemId,
    variantId,
  };
}

function valid(candidate) {
  return candidate && Number.isFinite(candidate.amount) && candidate.amount > 0;
}

function isRestricted(candidate) {
  const text = `${candidate.label} ${(candidate.context || []).join(' ')}`.toLowerCase();
  return /(cashback|meli\s*d[oó]lar|pontos?|por\s+quilo|pre[cç]o\s+por|unidade|cada|assinatura)/i.test(text);
}

function candidateScore(candidate, expectedItemId = null) {
  if (!valid(candidate)) return -Infinity;
  if (candidate.kind === 'cashback' || candidate.kind === 'installment' || candidate.kind === 'unit') return -Infinity;
  if (isRestricted(candidate)) return -Infinity;
  if (expectedItemId && candidate.itemId && candidate.itemId !== expectedItemId) return -Infinity;

  const source = SOURCE_PRIORITY[candidate.source] || 40;
  const itemBonus = expectedItemId && candidate.itemId === expectedItemId ? 15 : 0;
  const kindBonus = candidate.kind === 'current' || candidate.kind === 'pix' ? 10 : 0;
  return source + candidate.confidence * 20 + itemBonus + kindBonus;
}

function bestCandidate(candidates, expectedItemId, kinds) {
  return candidates
    .filter((candidate) => kinds.includes(candidate.kind))
    .map((candidate) => ({ candidate, score: candidateScore(candidate, expectedItemId) }))
    .sort((a, b) => b.score - a.score)[0]?.candidate || null;
}

function originalCandidate(candidates, current, expectedItemId) {
  const originals = candidates
    .filter((candidate) => candidate.kind === 'original' && valid(candidate))
    .filter((candidate) => !expectedItemId || !candidate.itemId || candidate.itemId === expectedItemId)
    .filter((candidate) => !current || candidate.amount > current.amount)
    .sort((a, b) => candidateScore(b, expectedItemId) - candidateScore(a, expectedItemId));
  return originals[0] || null;
}

export function selectPriceModel(candidates, { expectedItemId = null } = {}) {
  const normalized = (candidates || []).filter(valid);
  const current = bestCandidate(normalized, expectedItemId, ['current', 'pix', 'card']);
  const original = originalCandidate(normalized, current, expectedItemId);
  const installment = normalized
    .filter((candidate) => candidate.kind === 'installment')
    .sort((a, b) => b.confidence - a.confidence)[0] || null;
  const cashback = normalized
    .filter((candidate) => candidate.kind === 'cashback')
    .sort((a, b) => b.confidence - a.confidence)[0] || null;
  const unit = normalized
    .filter((candidate) => candidate.kind === 'unit')
    .sort((a, b) => b.confidence - a.confidence)[0] || null;

  if (!current) {
    return {
      confirmed: false,
      current: null,
      original: null,
      installment: installment ? sanitize(installment) : null,
      cashback: cashback ? sanitize(cashback) : null,
      unit: unit ? sanitize(unit) : null,
      discountPercent: 0,
      savings: 0,
      confidence: 0,
      reason: 'Nenhum preço de venda confiável foi encontrado.',
      evidence: normalized.map(sanitize),
    };
  }

  const discount = original ? discountPercent(current.amount, original.amount) : 0;
  const savings = original ? savingsAmount(current.amount, original.amount) : 0;
  const confidence = Math.min(1, current.confidence + (original ? 0.05 : 0));

  return {
    confirmed: confidence >= 0.72,
    current: sanitize(current),
    original: original ? sanitize(original) : null,
    installment: installment ? sanitize(installment) : null,
    cashback: cashback ? sanitize(cashback) : null,
    unit: unit ? sanitize(unit) : null,
    discountPercent: discount,
    savings,
    confidence: roundMoney(confidence),
    reason: confidence >= 0.72 ? null : 'Preço encontrado, mas sem confiança suficiente para publicação automática.',
    evidence: normalized.map(sanitize),
  };
}

function sanitize(candidate) {
  return {
    amount: candidate.amount,
    kind: candidate.kind,
    source: candidate.source,
    confidence: candidate.confidence,
    currency: candidate.currency,
    label: candidate.label || undefined,
    context: candidate.context?.length ? candidate.context : undefined,
    itemId: candidate.itemId || undefined,
    variantId: candidate.variantId || undefined,
  };
}
