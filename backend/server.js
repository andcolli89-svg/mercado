'use strict';

const http = require('node:http');
const { URL } = require('node:url');

const PORT = Number(process.env.PORT || 10000);
const ALLOWED_HOST = /(^|\.)(meli\.la|mercadolivre\.com\.br|mercadolibre\.com|mercadolibre\.com\.br|mlstatic\.com)$/i;
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/json;q=0.9,image/avif,image/webp,image/*,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
  'cache-control': 'no-cache',
  pragma: 'no-cache'
};

function apiHeaders() {
  const token = process.env.MELI_ACCESS_TOKEN || process.env.ACCESS_TOKEN || '';
  return token ? { ...HEADERS, accept: 'application/json', authorization: `Bearer ${token}` } : { ...HEADERS, accept: 'application/json' };
}

function cors(extra = {}) {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Cache-Control': 'no-store',
    ...extra
  };
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, cors(headers));
  res.end(body);
}

function json(res, status, value) {
  send(res, status, JSON.stringify(value), { 'Content-Type': 'application/json; charset=utf-8' });
}

function clean(value = '') {
  return String(value).trim().replace(/[\u200B-\u200D\uFEFF]/g, '').replace(/^[<\[(]+|[>\]),.;]+$/g, '');
}

function decodeHtml(value = '') {
  return String(value)
    .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/\\u002F/g, '/')
    .replace(/\\u0026/g, '&').replace(/\\u003D/g, '=');
}

function money(value) {
  if (value === null || value === undefined || value === '') return '';
  let raw = String(value).trim().replace(/[^\d,.-]/g, '');
  if (!raw) return '';
  if (raw.includes(',') && raw.includes('.')) {
    raw = raw.lastIndexOf(',') > raw.lastIndexOf('.') ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '');
  } else if (raw.includes(',')) raw = raw.replace(',', '.');
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n.toFixed(2).replace('.', ',') : '';
}

function numeric(value) {
  const normalized = money(value);
  return normalized ? Number(normalized.replace(',', '.')) : NaN;
}

function safeDecode(value = '') {
  let result = String(value);
  for (let i = 0; i < 3; i += 1) {
    try {
      const decoded = decodeURIComponent(result);
      if (decoded === result) break;
      result = decoded;
    } catch { break; }
  }
  return result;
}

function itemIdFrom(text = '') {
  const raw = safeDecode(text);
  const patterns = [
    /(?:item_id|wid)(?:=|:)(MLB-?\d{6,})/i,
    /[?&#](?:item_id|wid)=MLB-?(\d{6,})/i,
    /"item_id"\s*:\s*"?(MLB-?\d{6,})/i,
    /"id"\s*:\s*"(MLB\d{6,})"/i,
    /\b(MLB-?\d{6,})\b/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (!match) continue;
    const value = String(match[1]).replace('-', '').toUpperCase();
    return value.startsWith('MLB') ? value : `MLB${value}`;
  }
  return '';
}

async function fetchWithTimeout(url, options = {}, timeout = 20000) {
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), ...options });
}

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


function commerceFromObject(data, preferredId = '') {
  const result = { price: '', oldPrice: '', seller: '', sellerId: '', image: '', title: '', permalink: '', source: '' };
  const seen = new Set();
  const preferred = String(preferredId || '').replace('-', '').toUpperCase();

  const readAmount = value => {
    if (value && typeof value === 'object') {
      return money(value.amount ?? value.value ?? value.decimal_price ?? value.decimalPrice);
    }
    return money(value);
  };

  const visit = (value, depth = 0, path = '') => {
    if (!value || depth > 14 || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      const exact = value.find(x => String(x?.id || '').replace('-', '').toUpperCase() === preferred);
      if (exact) visit(exact, depth + 1, `${path}.preferred`);
      for (const item of value) visit(item, depth + 1, path);
      return;
    }

    const objectId = String(value.id || value.item_id || value.itemId || '').replace('-', '').toUpperCase();
    const isPreferred = preferred && objectId === preferred;
    const price = readAmount(value.sale_price ?? value.salePrice ?? value.price_to_pay ?? value.priceToPay ?? value.price);
    const oldPrice = readAmount(value.original_price ?? value.originalPrice ?? value.regular_amount ?? value.regularAmount ?? value.list_price ?? value.listPrice);

    // Evita confundir valor de parcela com preço do produto.
    if (price && !/installment|financing|shipping/i.test(path)) {
      if (!result.price || isPreferred) {
        result.price = price;
        result.source = path || 'api-object';
      }
    }
    if (oldPrice && numeric(oldPrice) > numeric(result.price || price)) result.oldPrice = oldPrice;

    const seller = value.seller?.nickname || value.seller_name || value.sellerName || value.official_store_name || value.nickname;
    if (!result.seller && typeof seller === 'string') result.seller = clean(seller);
    result.sellerId ||= value.seller_id || value.seller?.id || '';
    result.title ||= typeof value.title === 'string' ? value.title : '';
    result.permalink ||= typeof value.permalink === 'string' ? value.permalink : '';
    result.image ||= value.pictures?.[0]?.secure_url || value.pictures?.[0]?.url || value.secure_thumbnail || value.thumbnail || value.image || '';

    for (const [key, child] of Object.entries(value)) visit(child, depth + 1, `${path}.${key}`);
  };

  visit(data);
  return result;
}

async function fetchApiFallbacks(id, catalogProductId = '') {
  const endpoints = [];
  if (catalogProductId) {
    endpoints.push(
      [`https://api.mercadolibre.com/products/${catalogProductId}`, 'catalog-product'],
      [`https://api.mercadolibre.com/products/${catalogProductId}/items`, 'catalog-items']
    );
  }
  if (id) endpoints.push([`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(id)}`, 'search']);

  for (const [url, source] of endpoints) {
    try {
      const response = await fetchWithTimeout(url, { headers: apiHeaders() });
      if (!response.ok) continue;
      const found = commerceFromObject(await response.json(), id);
      if (found.price) return { ...found, source };
    } catch { /* tenta o próximo endpoint */ }
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
    full: item.shipping?.logistic_type === 'fulfillment' || (item.tags || []).some(tag => /full|fulfillment/i.test(tag))
  };
}

function attr(tag, name) {
  const match = String(tag).match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return match ? decodeHtml(match[1]) : '';
}

function meta(html, key) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) || []) {
    const name = attr(tag, 'property') || attr(tag, 'name') || attr(tag, 'itemprop');
    if (name.toLowerCase() === key.toLowerCase()) return attr(tag, 'content');
  }
  return '';
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


function embeddedJsonObjects(html) {
  const values = [];
  const scripts = html.match(/<script\b[^>]*>[\s\S]*?<\/script>/gi) || [];
  for (const script of scripts) {
    const raw = script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim();
    if (!raw || raw.length > 5000000) continue;
    const candidates = [raw];
    const firstBrace = raw.indexOf('{');
    const lastBrace = raw.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) candidates.push(raw.slice(firstBrace, lastBrace + 1));
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(decodeHtml(candidate));
        values.push(parsed);
        break;
      } catch { /* scripts de aplicação nem sempre são JSON puro */ }
    }
  }
  return values;
}

function findStructuredCommerce(html) {
  const result = { price: '', oldPrice: '', installments: '', installmentAmount: '', seller: '' };
  const seen = new Set();
  const visit = (value, depth = 0) => {
    if (!value || depth > 14 || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      for (const item of value) visit(item, depth + 1);
      return;
    }

    const get = (...keys) => {
      for (const key of keys) if (value[key] !== undefined && value[key] !== null) return value[key];
      return undefined;
    };
    const amountOf = candidate => {
      if (candidate && typeof candidate === 'object') return get.call(candidate, 'amount', 'value', 'decimal_price', 'decimalPrice');
      return candidate;
    };

    const currentRaw = get('priceToPay', 'price_to_pay', 'sale_price', 'salePrice', 'discounted_price', 'discountedPrice', 'currentPrice', 'bestPrice');
    const oldRaw = get('original_price', 'originalPrice', 'regular_amount', 'regularAmount', 'previous_price', 'previousPrice', 'price_before_discount');
    const current = money(currentRaw && typeof currentRaw === 'object' ? (currentRaw.amount ?? currentRaw.value ?? currentRaw.decimal_price ?? currentRaw.decimalPrice) : currentRaw);
    const previous = money(oldRaw && typeof oldRaw === 'object' ? (oldRaw.amount ?? oldRaw.value) : oldRaw);
    if (!result.price && current) result.price = current;
    if (!result.oldPrice && previous) result.oldPrice = previous;

    const count = Number(get('installments', 'installment_quantity', 'installmentQuantity', 'quantity'));
    const installmentRaw = get('installment_amount', 'installmentAmount');
    const installment = money(installmentRaw && typeof installmentRaw === 'object' ? (installmentRaw.amount ?? installmentRaw.value) : installmentRaw);
    if (!result.installments && Number.isInteger(count) && count >= 2 && count <= 48 && installment) {
      result.installments = String(count);
      result.installmentAmount = installment;
    }

    const seller = get('official_store_name', 'seller_name', 'sellerName', 'nickname');
    if (!result.seller && typeof seller === 'string' && seller.trim().length >= 2) result.seller = clean(seller);

    for (const child of Object.values(value)) visit(child, depth + 1);
  };
  for (const value of embeddedJsonObjects(html)) visit(value);
  return result;
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

  // Dados estruturados usados pelo front-end do anúncio.
  const jsonPatterns = [
    /"installments"\s*:\s*(\d{1,2})[\s\S]{0,400}?"(?:installment_amount|amount)"\s*:\s*([\d.]+)/gi,
    /"quantity"\s*:\s*(\d{1,2})[\s\S]{0,400}?"amount"\s*:\s*([\d.]+)/gi
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
  const api = await fetchApiItem(id);
  const [apiPrices, apiFallback] = await Promise.all([
    fetchApiPrices(id),
    fetchApiFallbacks(id, api?.catalogProductId || '')
  ]);
  const structured = jsonLd(html);
  const metaPrice = money(meta(html, 'product:price:amount') || meta(html, 'og:price:amount'));
  const metaOldPrice = money(meta(html, 'product:original_price:amount') || meta(html, 'product:price:original_amount'));
  const commerce = findStructuredCommerce(html);
  const text = pageText(html);
  const prices = extractPriceCandidates(html, text, apiPrices?.price || api?.price || structured.price);
  const seller = extractSeller(html, text) || commerce.seller || structured.seller || apiFallback?.seller || api?.seller || '';
  const title = structured.title || apiFallback?.title || api?.title || meta(html, 'og:title').replace(/\s*\|\s*Mercado Livre.*$/i, '').trim();
  const image = api?.image || apiFallback?.image || structured.image || meta(html, 'og:image');

  if (!title) throw new Error('Não foi possível identificar o produto. Abra o anúncio e copie novamente o link de Compartilhar.');
  // O valor exibido na página deve vencer o valor genérico da API, pois pode
  // haver promoção, preço por contexto ou variação selecionada.
  const chosenPrice = prices.price || commerce.price || structured.price || metaPrice || apiPrices?.price || apiFallback?.price || api?.price || '';
  const chosenOldPrice = prices.oldPrice || commerce.oldPrice || structured.oldPrice || metaOldPrice || apiPrices?.oldPrice || apiFallback?.oldPrice || api?.oldPrice || '';
  const parsedInstallment = extractInstallments(html, text, chosenPrice);
  const installment = parsedInstallment.count ? parsedInstallment : {
    count: commerce.installments || '',
    amount: commerce.installmentAmount || '',
    interest: ''
  };
  const currentNumber = numeric(chosenPrice);
  const oldNumber = numeric(chosenOldPrice);
  const discount = Number.isFinite(currentNumber) && Number.isFinite(oldNumber) && oldNumber > currentNumber
    ? Math.round((1 - currentNumber / oldNumber) * 100)
    : '';

  return {
    id: api?.id || id,
    title,
    price: chosenPrice,
    currentPrice: chosenPrice,
    salePrice: chosenPrice,
    pixPrice: chosenPrice,
    oldPrice: chosenOldPrice,
    originalPrice: chosenOldPrice,
    listPrice: chosenOldPrice,
    otherPrice: prices.otherPrice || '',
    otherPaymentPrice: prices.otherPrice || '',
    seller,
    store: seller,
    installments: installment.count,
    installmentAmount: installment.amount,
    installmentValue: installment.amount,
    installmentInterest: installment.interest,
    discount,
    image,
    imageProxy: image ? `/api/image?url=${encodeURIComponent(image)}` : '',
    permalink: finalUrl || api?.permalink || input.href,
    full: Boolean(api?.full),
    source: { itemId: id || null, priceSource: prices.pageDetected ? 'page' : (metaPrice ? 'meta' : (apiPrices?.source || apiFallback?.source || 'items')), pagePriceDetected: Boolean(prices.pageDetected) }
  };
}

async function proxyImage(source, res) {
  const imageUrl = new URL(source);
  if (!['http:', 'https:'].includes(imageUrl.protocol) || !ALLOWED_HOST.test(imageUrl.hostname)) return send(res, 403, 'Imagem não permitida');
  const response = await fetchWithTimeout(imageUrl.href, {
    headers: { ...HEADERS, referer: 'https://www.mercadolivre.com.br/', origin: 'https://www.mercadolivre.com.br' }
  });
  if (!response.ok) return send(res, response.status, 'Imagem indisponível');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  send(res, 200, buffer, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' });
}

http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') return send(res, 204, '');
    const url = new URL(req.url, `http://${req.headers.host}`);
    if (url.pathname === '/' || url.pathname === '/health') return json(res, 200, { status: 'ok', version: '22.0', message: 'Servidor PromoZap funcionando' });
    if (url.pathname === '/api/product') {
      const source = url.searchParams.get('url');
      if (!source) return json(res, 400, { error: 'Informe o link do produto.' });
      return json(res, 200, await productFromUrl(source));
    }
    if (url.pathname === '/api/image') {
      const source = url.searchParams.get('url');
      if (!source) return send(res, 400, 'Informe a imagem.');
      return proxyImage(source, res);
    }
    return json(res, 404, { error: 'Rota não encontrada.' });
  } catch (error) {
    console.error(error);
    return json(res, 422, { error: error.message || 'Não foi possível consultar o produto.' });
  }
}).listen(PORT, '0.0.0.0', () => console.log(`PromoZap V22 disponível na porta ${PORT}`));
