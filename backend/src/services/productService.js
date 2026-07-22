'use strict';

const { URL } = require('node:url');
const { BROWSER_HEADERS: HEADERS, apiHeaders } = require('../config');
const { fetchWithTimeout } = require('../lib/http');
const { clean, decodeHtml, money, numeric, itemIdFrom, attr, meta } = require('../lib/format');

async function fetchSeller(sellerId) {
  if (!sellerId) return '';
  try {
    const response = await fetchWithTimeout(`https://api.mercadolibre.com/users/${sellerId}`, { headers: apiHeaders() });
    if (!response.ok) return '';
    const data = await response.json();
    return data.nickname || data.first_name || '';
  } catch { return ''; }
}

async function fetchApiPrices(id) {
  if (!id) return null;

  const normalize = data => {
    if (!data || typeof data !== 'object') return null;

    // /sale_price retorna diretamente amount e regular_amount.
    if (data.amount != null) {
      return {
        price: money(data.amount),
        oldPrice: money(data.regular_amount),
        source: 'sale_price'
      };
    }

    // /prices retorna uma lista de preços por contexto.
    const list = Array.isArray(data.prices) ? data.prices : [];
    if (!list.length) return null;
    const now = Date.now();
    const active = list.filter(entry => {
      const conditions = entry.conditions || {};
      const start = conditions.start_time ? Date.parse(conditions.start_time) : NaN;
      const end = conditions.end_time ? Date.parse(conditions.end_time) : NaN;
      return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now);
    });
    const marketplace = active.filter(entry => {
      const restrictions = entry.conditions?.context_restrictions || [];
      return !restrictions.length || restrictions.includes('channel_marketplace');
    });
    const candidates = marketplace.length ? marketplace : active;
    const promotions = candidates.filter(entry => entry.type === 'promotion' && numeric(entry.amount) > 0);
    const standards = candidates.filter(entry => entry.type === 'standard' && numeric(entry.amount) > 0);
    const winner = promotions.sort((a, b) => numeric(a.amount) - numeric(b.amount))[0]
      || standards.sort((a, b) => numeric(a.amount) - numeric(b.amount))[0]
      || candidates.find(entry => numeric(entry.amount) > 0);
    if (!winner) return null;
    const standard = standards.sort((a, b) => numeric(a.amount) - numeric(b.amount))[0];
    const current = money(winner.amount);
    let previous = money(winner.regular_amount);
    if (!previous && standard && numeric(standard.amount) > numeric(winner.amount)) previous = money(standard.amount);
    return { price: current, oldPrice: previous, source: 'prices' };
  };

  // O endpoint contextual é o que mais se aproxima do preço mostrado no marketplace.
  const urls = [
    `https://api.mercadolibre.com/items/${id}/sale_price?context=channel_marketplace`,
    `https://api.mercadolibre.com/items/${id}/prices`
  ];

  for (const url of urls) {
    try {
      const response = await fetchWithTimeout(url, {
        headers: apiHeaders()
      });
      if (!response.ok) continue;
      const result = normalize(await response.json());
      if (result?.price) return result;
    } catch { /* tenta o próximo recurso */ }
  }
  return null;
}

async function fetchApiItem(id) {
  if (!id) return null;
  const response = await fetchWithTimeout(`https://api.mercadolibre.com/items/${id}`, { headers: apiHeaders() });
  if (!response.ok) return null;
  const item = await response.json();
  const seller = item.seller?.nickname || await fetchSeller(item.seller_id || item.seller?.id);
  return {
    id: item.id || id,
    title: item.title || '',
    price: money(item.sale_price?.amount || item.price),
    oldPrice: money(item.sale_price?.regular_amount || item.original_price),
    seller,
    sellerId: item.seller_id || item.seller?.id || '',
    catalogProductId: item.catalog_product_id || '',
    image: item.pictures?.[0]?.secure_url || item.pictures?.[0]?.url || item.secure_thumbnail || item.thumbnail || '',
    permalink: item.permalink || '',
    full: item.shipping?.logistic_type === 'fulfillment' || (item.tags || []).some(tag => /full|fulfillment/i.test(tag)),
    freeShipping: Boolean(item.shipping?.free_shipping)
  };
}

function jsonLd(html) {
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const walk = value => {
    if (!value) return null;
    if (Array.isArray(value)) { for (const x of value) { const found = walk(x); if (found) return found; } return null; }
    if (typeof value !== 'object') return null;
    if (String(value['@type'] || '').toLowerCase() === 'product') return value;
    if (value['@graph']) return walk(value['@graph']);
    return null;
  };
  for (const script of scripts) {
    try {
      const raw = decodeHtml(script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim());
      const product = walk(JSON.parse(raw));
      if (!product) continue;
      const offer = Array.isArray(product.offers) ? product.offers[0] : (product.offers || {});
      const seller = offer.seller || product.seller || {};
      return {
        title: product.name || '',
        image: Array.isArray(product.image) ? product.image[0] : (product.image?.url || product.image || ''),
        price: money(offer.price || offer.lowPrice),
        oldPrice: money(offer.highPrice),
        seller: seller.name || seller.alternateName || ''
      };
    } catch { /* próximo bloco */ }
  }
  return {};
}

function pageText(html) {
  return decodeHtml(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSeller(html, text) {
  const candidates = [
    text.match(/Loja oficial\s+([^|•·]{2,80}?)(?=\s+(?:Ganhos|Compartilhar|Conferir|Vendido|$))/i)?.[1],
    text.match(/Vendido por\s+([^|•·]{2,80}?)(?=\s+(?:MercadoLíder|MercadoLider|\+?\d|Compra Garantida|Devolução|$))/i)?.[1],
    html.match(/"official_store_name"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"seller_name"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"nickname"\s*:\s*"([^"]+)"/i)?.[1]
  ];
  return clean(candidates.find(Boolean) || '').replace(/\s+/g, ' ');
}

function extractPriceCandidates(html, text, apiPrice) {
  const current = [];
  const old = [];
  const other = [];
  const add = (list, value) => {
    const n = numeric(value);
    if (Number.isFinite(n) && n > 1 && n < 1000000 && !list.some(x => Math.abs(x - n) < 0.005)) list.push(n);
  };

  // Primeiro olha apenas a área principal de preço da página. Isso evita capturar
  // valores de cashback, outras variações e recomendações.
  const priceAreaIndex = html.search(/ui-pdp-price__main-container|ui-pdp-price__second-line|ui-pdp-price/i);
  const area = priceAreaIndex >= 0
    ? html.slice(Math.max(0, priceAreaIndex - 4000), priceAreaIndex + 45000)
    : html.slice(0, 160000);

  for (const tag of area.match(/<(?:span|div)\b[^>]*(?:andes-money-amount|aria-label=["'][^"']*(?:reais?|R\$))[^>]*>/gi) || []) {
    const aria = attr(tag, 'aria-label');
    const match = aria.match(/(?:R\$\s*)?([\d.]+(?:,\d{1,2})?)/i);
    if (!match) continue;
    if (/previous|original|antes|tachado|ui-pdp-price__original-value/i.test(tag)) add(old, match[1]);
    else add(current, match[1]);
  }

  // Marcações internas atuais do Mercado Livre.
  const jsonPatterns = [
    /"priceToPay"\s*:\s*\{[\s\S]{0,1600}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*"?([\d.]+(?:,\d{1,2})?)/gi,
    /"(?:price_to_pay|sale_price|discounted_price|bestPrice|currentPrice)"\s*:\s*(?:\{[\s\S]{0,800}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*)?"?([\d.]+(?:,\d{1,2})?)/gi
  ];
  for (const pattern of jsonPatterns) {
    let m;
    while ((m = pattern.exec(area))) add(current, m[1]);
  }

  const oldPatterns = [
    /"(?:original_price|originalPrice|price_before_discount|previous_price|regular_price)"\s*:\s*(?:\{[\s\S]{0,800}?"(?:amount|value)"\s*:\s*)?"?([\d.]+(?:,\d{1,2})?)/gi
  ];
  for (const pattern of oldPatterns) {
    let m;
    while ((m = pattern.exec(area))) add(old, m[1]);
  }

  // Texto visível: cobre "51% OFF R$ 345 R$ 169" e pequenas variações.
  const promoPatterns = [
    /(?:\d{1,2}%\s*OFF\s*)R\$\s*([\d.]+(?:,\d{2})?)\s*R\$\s*([\d.]+(?:,\d{2})?)/i,
    /R\$\s*([\d.]+(?:,\d{2})?)\s*(?:\d{1,2}%\s*OFF\s*)R\$\s*([\d.]+(?:,\d{2})?)/i,
    /(?:de\s*)?R\$\s*([\d.]+(?:,\d{2})?)\s*(?:por\s*)R\$\s*([\d.]+(?:,\d{2})?)/i
  ];
  for (const pattern of promoPatterns) {
    const match = text.match(pattern);
    if (match) { add(old, match[1]); add(current, match[2]); break; }
  }

  const otherMatch = text.match(/ou\s+R\$\s*([\d.]+(?:,\d{2})?)\s+em outros meios/i);
  if (otherMatch) add(other, otherMatch[1]);

  const api = numeric(apiPrice);
  // O preço visual é a fonte principal. Entre candidatos visuais, o menor costuma
  // ser o preço promocional, mas descartamos valores absurdamente distantes da API.
  const sensible = current.filter(n => !Number.isFinite(api) || (n >= api * 0.25 && n <= api * 1.6));
  const chosenCurrent = sensible.length ? Math.min(...sensible) : (current.length ? Math.min(...current) : api);
  const chosenOld = old.filter(n => n > chosenCurrent).sort((a, b) => a - b)[0]
    || (Number.isFinite(api) && api > chosenCurrent ? api : NaN);

  return {
    price: Number.isFinite(chosenCurrent) ? money(chosenCurrent) : '',
    oldPrice: Number.isFinite(chosenOld) ? money(chosenOld) : '',
    otherPrice: other.length ? money(other[0]) : '',
    pageDetected: current.length > 0
  };
}

function extractInstallments(html, text, selectedPrice) {
  const candidates = [];
  const add = (count, amount, interest = '') => {
    const n = Number(count);
    const value = numeric(amount);
    if (!Number.isInteger(n) || n < 2 || n > 48 || !Number.isFinite(value) || value <= 0) return;
    if (!candidates.some(x => x.count === n && Math.abs(x.amount - value) < 0.005)) {
      candidates.push({ count: n, amount: value, interest });
    }
  };

  const patterns = [
    /(\d{1,2})x\s+(?:de\s+)?R\$\s*([\d.]+[,\.]\d{2})(?:\s+(sem juros|com juros))?/gi,
    /(\d{1,2})x\s+(?:de\s+)?R\$\s*([\d.]+)\s+(\d{2})(?:\s+(sem juros|com juros))?/gi
  ];
  for (const pattern of patterns) {
    let m;
    while ((m = pattern.exec(text))) {
      const amount = m[3] && /^\d{2}$/.test(m[3]) ? `${m[2]},${m[3]}` : m[2];
      const interest = m[4] || (m[3] && !/^\d{2}$/.test(m[3]) ? m[3] : '');
      add(m[1], amount, interest);
    }
  }

  // Aceita apenas campos explicitamente ligados a parcelamento.
  // O campo genérico "quantity" foi removido porque pode representar
  // quantidade de peças/unidades do produto, e não número de parcelas.
  const jsonPatterns = [
    /"installments"\s*:\s*(\d{1,2})[\s\S]{0,400}?"(?:installment_amount|amount)"\s*:\s*([\d.]+)/gi
  ];
  for (const pattern of jsonPatterns) {
    let m;
    while ((m = pattern.exec(html))) add(m[1], m[2], '');
  }

  if (!candidates.length) return { count: '', amount: '', interest: '' };
  const price = numeric(selectedPrice);
  let chosen = candidates[0];
  if (Number.isFinite(price)) {
    chosen = [...candidates].sort((a, b) => {
      const da = Math.abs((a.count * a.amount) - price) / price;
      const db = Math.abs((b.count * b.amount) - price) / price;
      return da - db;
    })[0];
    // Evita usar parcelamentos de outros anúncios/recomendações da página.
    const relativeDifference = Math.abs((chosen.count * chosen.amount) - price) / price;
    if (relativeDifference > 0.25) return { count: '', amount: '', interest: '' };
  }
  return { count: String(chosen.count), amount: money(chosen.amount), interest: chosen.interest || '' };
}

async function productFromUrl(source) {
  const input = new URL(clean(source));
  if (!['http:', 'https:'].includes(input.protocol) || !ALLOWED_HOST.test(input.hostname)) throw new Error('Use um link do Mercado Livre ou meli.la.');

  const landing = await fetchWithTimeout(input.href, { headers: HEADERS });
  if (!landing.ok) throw new Error(`O Mercado Livre respondeu com código ${landing.status}.`);
  const finalUrl = landing.url;
  const html = await landing.text();
  const id = itemIdFrom(finalUrl) || itemIdFrom(html);
  const [api, apiPrices] = await Promise.all([fetchApiItem(id), fetchApiPrices(id)]);
  const structured = jsonLd(html);
  const text = pageText(html);
  const prices = extractPriceCandidates(html, text, apiPrices?.price || api?.price || structured.price);
  const seller = extractSeller(html, text) || structured.seller || api?.seller || '';
  const title = structured.title || api?.title || meta(html, 'og:title').replace(/\s*\|\s*Mercado Livre.*$/i, '').trim();
  const image = api?.image || structured.image || meta(html, 'og:image');

  if (!title) throw new Error('Não foi possível identificar o produto. Abra o anúncio e copie novamente o link de Compartilhar.');
  // O valor exibido na página deve vencer o valor genérico da API, pois pode
  // haver promoção, preço por contexto ou variação selecionada.
  const chosenPrice = prices.price || structured.price || apiPrices?.price || api?.price || '';
  const chosenOldPrice = prices.oldPrice || structured.oldPrice || apiPrices?.oldPrice || api?.oldPrice || '';
  const installment = extractInstallments(html, text, chosenPrice);

  return {
    id: api?.id || id,
    title,
    price: chosenPrice,
    pixPrice: chosenPrice,
    oldPrice: chosenOldPrice,
    otherPrice: prices.otherPrice || '',
    otherPaymentPrice: prices.otherPrice || '',
    seller,
    store: seller,
    installments: installment.count,
    installmentAmount: installment.amount,
    installmentInterest: installment.interest,
    image,
    imageProxy: image ? `/api/image?url=${encodeURIComponent(image)}` : '',
    permalink: finalUrl || api?.permalink || input.href,
    full: Boolean(api?.full),
    freeShipping: Boolean(api?.freeShipping),
    source: { itemId: id || null, priceSource: prices.pageDetected ? 'page' : (apiPrices?.source || 'items'), pagePriceDetected: Boolean(prices.pageDetected) }
  };
}

module.exports = { productFromUrl, fetchApiItem, fetchApiPrices };
