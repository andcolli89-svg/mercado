'use strict';

const { attr, decodeHtml, money, numeric, stripTags } = require('../lib/format');

function parseAriaMoney(label = '') {
  const text = decodeHtml(String(label)).toLowerCase().replace(/\s+/g, ' ').trim();
  if (!text) return NaN;

  const direct = text.match(/(?:r\$\s*)?([\d.]+(?:,\d{1,2})?)/i);
  const reais = text.match(/([\d.]+)\s*reais?/i);
  const centavos = text.match(/(?:com\s+)?(\d{1,2})\s*centavos?/i);
  if (reais) {
    const integer = numeric(reais[1]);
    if (Number.isFinite(integer)) return integer + (centavos ? Number(centavos[1]) / 100 : 0);
  }
  return direct ? numeric(direct[1]) : NaN;
}

function priceArea(html = '') {
  const markers = [
    'ui-pdp-price__main-container',
    'ui-pdp-price__second-line',
    'ui-pdp-price',
    'priceToPay',
    'price_to_pay'
  ];
  const positions = markers.map(marker => html.indexOf(marker)).filter(position => position >= 0);
  if (!positions.length) return html.slice(0, 220000);
  const index = Math.min(...positions);
  return html.slice(Math.max(0, index - 10000), Math.min(html.length, index + 90000));
}

function contextAround(source, index, radius = 180) {
  return stripTags(source.slice(Math.max(0, index - radius), Math.min(source.length, index + radius))).toLowerCase();
}

function isRejectedContext(context = '') {
  return /cashback|ganhe|ganhos|de volta|moedas|mercado pontos|parcela de|\d{1,2}x\s+de|juros|por m[eê]s|assinatura/.test(context);
}

function addCandidate(list, value, confidence, kind, context = '') {
  const amount = numeric(value);
  if (!Number.isFinite(amount) || amount <= 1 || amount >= 1000000) return;
  if (kind === 'current' && isRejectedContext(context)) return;
  if (list.some(entry => Math.abs(entry.amount - amount) < 0.005 && entry.kind === kind && entry.confidence >= confidence)) return;
  list.push({ amount, confidence, kind, context });
}

function collectJsonCandidates(area, candidates) {
  const patterns = [
    { kind: 'current', confidence: 100, regex: /"priceToPay"\s*:\s*\{[\s\S]{0,1800}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*"?([\d.]+(?:,\d{1,2})?)/gi },
    { kind: 'current', confidence: 98, regex: /"price_to_pay"\s*:\s*(?:\{[\s\S]{0,1200}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*)?"?([\d.]+(?:,\d{1,2})?)/gi },
    { kind: 'current', confidence: 95, regex: /"(?:sale_price|discounted_price|best_price|bestPrice|current_price|currentPrice)"\s*:\s*(?:\{[\s\S]{0,900}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*)?"?([\d.]+(?:,\d{1,2})?)/gi },
    { kind: 'old', confidence: 95, regex: /"(?:regular_amount|original_price|originalPrice|price_before_discount|previous_price|previousPrice|regular_price|regularPrice)"\s*:\s*(?:\{[\s\S]{0,900}?"(?:amount|value)"\s*:\s*)?"?([\d.]+(?:,\d{1,2})?)/gi }
  ];
  for (const { kind, confidence, regex } of patterns) {
    let match;
    while ((match = regex.exec(area))) addCandidate(candidates, match[1], confidence, kind, contextAround(area, match.index));
  }
}

function collectMoneyTags(area, candidates) {
  const tagRegex = /<(?:span|div|s)\b[^>]*(?:andes-money-amount|aria-label=["'][^"']*(?:reais?|centavos?|R\$))[^>]*>/gi;
  let match;
  while ((match = tagRegex.exec(area))) {
    const tag = match[0];
    const aria = attr(tag, 'aria-label');
    const value = parseAriaMoney(aria);
    if (!Number.isFinite(value)) continue;
    const rawContext = area.slice(Math.max(0, match.index - 500), Math.min(area.length, match.index + 500)).toLowerCase();
    const context = `${tag.toLowerCase()} ${contextAround(area, match.index, 140)}`;
    const tagContext = tag.toLowerCase();
    const old = /^<s\b/.test(tagContext) || /previous|original|before|tachado|strikethrough|line-through|ui-pdp-price__original-value|andes-money-amount--previous/.test(tagContext);
    const main = /ui-pdp-price__second-line|ui-pdp-price__main-container|price-to-pay|price_to_pay/.test(rawContext);
    addCandidate(candidates, value, old ? 94 : (main ? 92 : 72), old ? 'old' : 'current', main ? tagContext : context);
  }
}

function collectVisibleText(text, candidates) {
  const normalized = decodeHtml(text).replace(/\s+/g, ' ');
  const patterns = [
    /(?:de\s*)?R\$\s*([\d.]+(?:,\d{1,2})?)\s*(?:por|agora por)\s*R\$\s*([\d.]+(?:,\d{1,2})?)/gi,
    /R\$\s*([\d.]+(?:,\d{1,2})?)\s*(\d{1,2}%\s*OFF)\s*R\$\s*([\d.]+(?:,\d{1,2})?)/gi,
    /(\d{1,2}%\s*OFF)\s*R\$\s*([\d.]+(?:,\d{1,2})?)\s*R\$\s*([\d.]+(?:,\d{1,2})?)/gi
  ];

  let match;
  while ((match = patterns[0].exec(normalized))) {
    addCandidate(candidates, match[1], 88, 'old', match[0]);
    addCandidate(candidates, match[2], 90, 'current', match[0]);
  }
  while ((match = patterns[1].exec(normalized))) {
    addCandidate(candidates, match[1], 86, 'old', match[0]);
    addCandidate(candidates, match[3], 88, 'current', match[0]);
  }
  while ((match = patterns[2].exec(normalized))) {
    addCandidate(candidates, match[2], 86, 'old', match[0]);
    addCandidate(candidates, match[3], 88, 'current', match[0]);
  }
}

function chooseCurrent(candidates, apiPrice) {
  const current = candidates.filter(entry => entry.kind === 'current');
  if (!current.length) return Number.isFinite(apiPrice) ? { amount: apiPrice, confidence: 55, source: 'api' } : null;

  const api = Number(apiPrice);
  const sensible = current.filter(entry => {
    if (!Number.isFinite(api) || api <= 0) return true;
    const ratio = entry.amount / api;
    return ratio >= 0.12 && ratio <= 1.8;
  });
  const pool = sensible.length ? sensible : current;
  pool.sort((a, b) => b.confidence - a.confidence || a.amount - b.amount);
  return { ...pool[0], source: 'page' };
}

function chooseOld(candidates, currentAmount, apiOldPrice, apiPrice) {
  const old = candidates
    .filter(entry => entry.kind === 'old' && entry.amount > currentAmount * 1.01)
    .sort((a, b) => b.confidence - a.confidence || a.amount - b.amount);
  if (old.length) return { ...old[0], source: 'page' };
  const apiOld = Number(apiOldPrice);
  if (Number.isFinite(apiOld) && apiOld > currentAmount * 1.01) return { amount: apiOld, confidence: 60, source: 'api' };
  const apiCurrent = Number(apiPrice);
  if (Number.isFinite(apiCurrent) && apiCurrent > currentAmount * 1.01) return { amount: apiCurrent, confidence: 52, source: 'api-as-original' };
  return null;
}

function parseMercadoLivrePrices(html = '', options = {}) {
  const area = priceArea(String(html));
  const text = stripTags(area);
  const candidates = [];
  collectJsonCandidates(area, candidates);
  collectMoneyTags(area, candidates);
  collectVisibleText(text, candidates);

  const apiPrice = numeric(options.apiPrice);
  const apiOldPrice = numeric(options.apiOldPrice);
  const current = chooseCurrent(candidates, apiPrice);
  if (!current) return { price: '', oldPrice: '', confidence: 0, pageDetected: false, candidates };
  const old = chooseOld(candidates, current.amount, apiOldPrice, apiPrice);

  return {
    price: money(current.amount),
    oldPrice: old ? money(old.amount) : '',
    confidence: current.confidence,
    priceSource: current.source,
    oldPriceSource: old?.source || '',
    pageDetected: current.source === 'page',
    candidates
  };
}

module.exports = { parseAriaMoney, parseMercadoLivrePrices, priceArea };
