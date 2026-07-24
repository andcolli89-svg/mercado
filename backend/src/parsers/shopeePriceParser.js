'use strict';

const { decodeHtml, money, numeric, stripTags } = require('../lib/format');
const { parseAriaMoney } = require('./mercadoLivrePriceParser');

function shopeeNumeric(value) {
  const parsed = numeric(value);
  if (!Number.isFinite(parsed)) return NaN;
  // A Shopee costuma serializar dinheiro em unidades de 1/100000 nos estados JSON.
  return parsed >= 100000 ? parsed / 100000 : parsed;
}

function add(list, value, kind, confidence, context = '') {
  const amount = shopeeNumeric(value);
  if (!Number.isFinite(amount) || amount <= 1 || amount > 1000000) return;
  if (kind === 'current' && /parcela|\d{1,2}x|cashback|moedas|de volta|frete/.test(context.toLowerCase())) return;
  if (!list.some(item => item.kind === kind && Math.abs(item.amount - amount) < 0.005)) {
    list.push({ amount, kind, confidence, context });
  }
}

function parseShopeePrices(html = '', options = {}) {
  const source = decodeHtml(String(html));
  const candidates = [];
  const jsonPatterns = [
    { kind: 'old', confidence: 98, regex: /"(?:price_before_discount|price_min_before_discount|price_max_before_discount|original_price)"\s*:\s*"?([\d.,]+)/gi },
    { kind: 'current', confidence: 97, regex: /"(?:price_min|price_max|price)"\s*:\s*"?([\d.,]+)/gi }
  ];
  for (const { kind, confidence, regex } of jsonPatterns) {
    let match;
    while ((match = regex.exec(source))) {
      const context = stripTags(source.slice(Math.max(0, match.index - 120), match.index + 220));
      add(candidates, match[1], kind, confidence, context);
    }
  }

  const tagRegex = /<(?:span|div|s)\b[^>]*aria-label=["'][^"']*(?:reais?|centavos?|R\$)[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(source))) {
    const aria = tagMatch[0].match(/aria-label=["']([^"']+)/i)?.[1] || '';
    const amount = parseAriaMoney(aria);
    const around = stripTags(source.slice(Math.max(0, tagMatch.index - 160), tagMatch.index + 260));
    const old = /^<s\b/i.test(tagMatch[0]) || /original|antes|de\s+r\$|line-through|tachado/i.test(`${tagMatch[0]} ${around}`);
    add(candidates, amount, old ? 'old' : 'current', old ? 92 : 90, around);
  }

  const text = stripTags(source);
  const pairPatterns = [
    /(?:de\s*)?R\$\s*([\d.]+(?:,\d{1,2})?)\s*(?:por|agora por)\s*R\$\s*([\d.]+(?:,\d{1,2})?)/gi,
    /R\$\s*([\d.]+(?:,\d{1,2})?)\s+R\$\s*([\d.]+(?:,\d{1,2})?)\s*(\d{1,2}%\s*(?:OFF|de desconto))/gi
  ];
  let match;
  while ((match = pairPatterns[0].exec(text))) {
    add(candidates, match[1], 'old', 88, match[0]);
    add(candidates, match[2], 'current', 90, match[0]);
  }
  while ((match = pairPatterns[1].exec(text))) {
    const first = numeric(match[1]);
    const second = numeric(match[2]);
    add(candidates, Math.max(first, second), 'old', 86, match[0]);
    add(candidates, Math.min(first, second), 'current', 88, match[0]);
  }

  const apiPrice = numeric(options.apiPrice);
  const apiOldPrice = numeric(options.apiOldPrice);
  const currentList = candidates.filter(item => item.kind === 'current').sort((a, b) => b.confidence - a.confidence || a.amount - b.amount);
  const current = currentList[0] || (Number.isFinite(apiPrice) ? { amount: apiPrice, confidence: 55, source: 'structured' } : null);
  if (!current) return { price: '', oldPrice: '', confidence: 0, pageDetected: false, candidates };
  const oldList = candidates.filter(item => item.kind === 'old' && item.amount > current.amount * 1.01).sort((a, b) => b.confidence - a.confidence || a.amount - b.amount);
  const old = oldList[0] || (Number.isFinite(apiOldPrice) && apiOldPrice > current.amount ? { amount: apiOldPrice, source: 'structured' } : null);
  return {
    price: money(current.amount),
    oldPrice: old ? money(old.amount) : '',
    confidence: current.confidence || 55,
    priceSource: current.source || 'page',
    oldPriceSource: old?.source || (old ? 'page' : ''),
    pageDetected: !current.source,
    candidates
  };
}

module.exports = { parseShopeePrices, shopeeNumeric };
