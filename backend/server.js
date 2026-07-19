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

function itemIdFrom(text = '') {
  const raw = String(text);
  const patterns = [
    /\bMLB-?(\d{6,})\b/i,
    /[?&]item_id=MLB-?(\d{6,})/i,
    /"item_id"\s*:\s*"?MLB-?(\d{6,})/i,
    /"id"\s*:\s*"MLB(\d{6,})"/i
  ];
  for (const pattern of patterns) {
    const match = raw.match(pattern);
    if (match) return `MLB${match[1]}`;
  }
  return '';
}

async function fetchWithTimeout(url, options = {}, timeout = 20000) {
  return fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(timeout), ...options });
}

async function fetchSeller(sellerId) {
  if (!sellerId) return '';
  try {
    const response = await fetchWithTimeout(`https://api.mercadolibre.com/users/${sellerId}`, { headers: HEADERS });
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
        headers: { ...HEADERS, accept: 'application/json' }
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
  const response = await fetchWithTimeout(`https://api.mercadolibre.com/items/${id}`, { headers: HEADERS });
  if (!response.ok) return null;
  const item = await response.json();
  const seller = item.seller?.nickname || await fetchSeller(item.seller_id || item.seller?.id);
  return {
    id: item.id || id,
    title: item.title || '',
    price: money(item.price),
    oldPrice: money(item.original_price),
    seller,
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
  const add = (list, value) => { const n = numeric(value); if (Number.isFinite(n) && n > 1 && n < 1000000 && !list.some(x => Math.abs(x - n) < 0.005)) list.push(n); };

  const priceAreaIndex = html.search(/ui-pdp-price__main-container|ui-pdp-price__second-line|ui-pdp-price/i);
  const area = priceAreaIndex >= 0 ? html.slice(Math.max(0, priceAreaIndex - 2000), priceAreaIndex + 30000) : html.slice(0, 120000);
  for (const tag of area.match(/<(?:span|div)\b[^>]*(?:andes-money-amount|aria-label=["'][^"']*(?:reais?|R\$))[^>]*>/gi) || []) {
    const aria = attr(tag, 'aria-label');
    const match = aria.match(/(?:R\$\s*)?([\d.]+(?:,\d{1,2})?)/i);
    if (!match) continue;
    if (/previous|original|antes|tachado|ui-pdp-price__original-value/i.test(tag)) add(old, match[1]);
    else add(current, match[1]);
  }

  const jsonPatterns = [
    /"priceToPay"\s*:\s*\{[\s\S]{0,1200}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*"?([\d.]+(?:,\d{1,2})?)/gi,
    /"(?:price_to_pay|sale_price|discounted_price|bestPrice|currentPrice)"\s*:\s*(?:\{[\s\S]{0,500}?"(?:amount|value|decimal_price|decimalPrice)"\s*:\s*)?"?([\d.]+(?:,\d{1,2})?)/gi
  ];
  for (const pattern of jsonPatterns) {
    let m; while ((m = pattern.exec(html))) add(current, m[1]);
  }

  const oldPatterns = [
    /"(?:original_price|originalPrice|price_before_discount|previous_price|regular_price)"\s*:\s*(?:\{[\s\S]{0,500}?"(?:amount|value)"\s*:\s*)?"?([\d.]+(?:,\d{1,2})?)/gi
  ];
  for (const pattern of oldPatterns) { let m; while ((m = pattern.exec(html))) add(old, m[1]); }

  const promo = text.match(/(?:OFERTA DO DIA\s*)?(\d{1,2})%\s*OFF\s*R\$\s*([\d.]+(?:,\d{2})?)\s*R\$\s*([\d.]+(?:,\d{2})?)/i);
  if (promo) { add(old, promo[2]); add(current, promo[3]); }
  const otherMatch = text.match(/ou\s+R\$\s*([\d.]+(?:,\d{2})?)\s+em outros meios/i);
  if (otherMatch) add(other, otherMatch[1]);

  const api = numeric(apiPrice);
  const sensible = current.filter(n => !Number.isFinite(api) || n >= api * 0.25 && n <= api * 1.35);
  const chosenCurrent = sensible.length ? Math.min(...sensible) : (current.length ? current[0] : api);
  const chosenOld = old.filter(n => n > chosenCurrent).sort((a, b) => a - b)[0] || (Number.isFinite(api) && api > chosenCurrent ? api : NaN);
  return {
    price: Number.isFinite(chosenCurrent) ? money(chosenCurrent) : '',
    oldPrice: Number.isFinite(chosenOld) ? money(chosenOld) : '',
    otherPrice: other.length ? money(other[0]) : ''
  };
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
  return {
    id: api?.id || id,
    title,
    price: apiPrices?.price || prices.price || structured.price || api?.price || '',
    oldPrice: apiPrices?.oldPrice || prices.oldPrice || structured.oldPrice || api?.oldPrice || '',
    otherPrice: prices.otherPrice || '',
    seller,
    image,
    imageProxy: image ? `/api/image?url=${encodeURIComponent(image)}` : '',
    permalink: finalUrl || api?.permalink || input.href,
    full: Boolean(api?.full),
    source: { itemId: id || null, priceSource: apiPrices?.source || (prices.price ? 'page' : 'items'), pagePriceDetected: Boolean(prices.price) }
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
    if (url.pathname === '/' || url.pathname === '/health') return json(res, 200, { status: 'ok', version: '17.0', message: 'Servidor PromoZap funcionando' });
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
}).listen(PORT, '0.0.0.0', () => console.log(`PromoZap V17 disponível na porta ${PORT}`));
