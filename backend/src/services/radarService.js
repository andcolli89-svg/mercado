'use strict';

const {
  RADAR_SOURCE_URL,
  RADAR_CACHE_TTL,
  RADAR_REFRESH_INTERVAL,
  BROWSER_HEADERS: HEADERS,
  apiHeaders
} = require('../config');
const { fetchWithTimeout } = require('../lib/http');
const { fetchApiPrices } = require('../api/mercadoLivreApi');
const { parseAriaMoney } = require('../parsers/mercadoLivrePriceParser');
const {
  clean,
  decodeHtml,
  money,
  numeric,
  itemIdFrom,
  attr,
  stripTags,
  absoluteUrl
} = require('../lib/format');

const radarCache = new Map();

function radarCategory(title = '') {
  const text = String(title).toLowerCase();
  const groups = {
    tecnologia: ['celular','smartphone','iphone','samsung','motorola','xiaomi','notebook','tablet','fone','headset','smartwatch','tv ','televis','monitor','ssd','memória','memoria','roteador','caixa de som','carregador','cabo usb'],
    casa: ['air fryer','fritadeira','panela','cozinha','cafeteira','liquidificador','batedeira','micro-ondas','geladeira','aspirador','ventilador','ar-condicionado','cama','mesa','banho','toalha','lençol','lencol','organizador','móvel','movel'],
    moda: ['tênis','tenis','sapato','sandália','sandalia','chinelo','camiseta','camisa','calça','calca','bermuda','vestido','jaqueta','moletom','bolsa','mochila','relógio','relogio'],
    beleza: ['perfume','shampoo','condicionador','creme','maquiagem','batom','secador','chapinha','barbeador','saúde','saude','vitamina','protetor solar'],
    fitness: ['academia','halter','peso','bicicleta','esteira','fitness','whey','suplemento','esporte','bola ','chuteira'],
    infantil: ['brinquedo','boneca','carrinho','lego','bebê','bebe','fralda','infantil','criança','crianca'],
    pet: ['ração','racao','cachorro','gato','pet','areia higiênica','areia higienica'],
    automotivo: ['carro','moto','automotivo','pneu','óleo motor','oleo motor','capacete','bateria automotiva']
  };
  for (const [name, words] of Object.entries(groups)) if (words.some(word => text.includes(word))) return name;
  return 'diversos';
}

function radarDiscount(oldPrice, price) {
  const oldValue = numeric(oldPrice);
  const currentValue = numeric(price);
  return Number.isFinite(oldValue) && Number.isFinite(currentValue) && oldValue > currentValue
    ? Math.round((1 - currentValue / oldValue) * 100)
    : 0;
}

function radarScore(item) {
  const current = numeric(item.price);
  const oldValue = numeric(item.oldPrice);
  const discount = Number(item.discount || radarDiscount(item.oldPrice, item.price) || 0);
  const saving = Number.isFinite(current) && Number.isFinite(oldValue) && oldValue > current ? oldValue - current : 0;
  return Math.max(0, Math.round(discount * 2.2 + Math.min(25, Math.log10(Math.max(1, saving)) * 8) + (item.full ? 12 : 0) + (item.freeShipping ? 8 : 0)));
}

function normalizeRadarItem(item = {}) {
  const title = clean(stripTags(item.title || item.name || ''));
  const price = money(item.price || item.salePrice || item.currentPrice);
  const oldPrice = money(item.oldPrice || item.originalPrice || item.regularPrice);
  const link = absoluteUrl(item.link || item.url || item.permalink || '');
  const image = absoluteUrl(Array.isArray(item.image) ? item.image[0] : (item.image?.url || item.image || ''), link || RADAR_SOURCE_URL);
  const normalized = {
    id: clean(item.id || item.itemId || itemIdFrom(link)), title, price, oldPrice, link, image,
    seller: clean(item.seller?.name || item.seller || item.store || ''),
    full: Boolean(item.full || item.fulfillment || /\bfull\b/i.test(String(item.shipping || ''))),
    freeShipping: Boolean(item.freeShipping || item.free_shipping),
    category: item.category || radarCategory(title), source: item.source || 'ofertas'
  };
  normalized.discount = Number(item.discount || radarDiscount(oldPrice, price) || 0);
  normalized.savings = Number.isFinite(numeric(oldPrice)) && Number.isFinite(numeric(price)) && numeric(oldPrice) > numeric(price) ? money(numeric(oldPrice) - numeric(price)) : '';
  normalized.score = radarScore(normalized);
  return normalized;
}

function productFromJsonObject(value) {
  if (!value || typeof value !== 'object') return null;
  const type = String(value['@type'] || '').toLowerCase();
  if (type !== 'product') return null;
  const offer = Array.isArray(value.offers) ? value.offers[0] : (value.offers || {});
  return normalizeRadarItem({
    id: value.sku || value.productID || '', title: value.name, image: value.image,
    price: offer.price || offer.lowPrice, oldPrice: offer.highPrice,
    link: offer.url || value.url, seller: offer.seller || value.seller,
    source: 'ofertas-json'
  });
}

function radarItemsFromJsonLd(html) {
  const result = [];
  const scripts = html.match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const visit = value => {
    if (!value) return;
    if (Array.isArray(value)) return value.forEach(visit);
    if (typeof value !== 'object') return;
    const item = productFromJsonObject(value);
    if (item?.title && item.link) result.push(item);
    Object.values(value).forEach(visit);
  };
  for (const script of scripts) {
    try { visit(JSON.parse(decodeHtml(script.replace(/^<script\b[^>]*>/i, '').replace(/<\/script>$/i, '').trim()))); } catch { }
  }
  return result;
}

function valueFromTag(block, attributeNames = []) {
  const tags = block.match(/<(?:img|a|span|div|h2|h3)\b[^>]*>/gi) || [];
  for (const tag of tags) {
    for (const name of attributeNames) {
      const value = attr(tag, name);
      if (value) return value;
    }
  }
  return '';
}

function radarItemFromBlock(block) {
  const hrefMatch = block.match(/<a\b[^>]*href=["']([^"']*(?:mercadolivre\.com\.br|meli\.la)[^"']*)["']/i);
  const link = absoluteUrl(hrefMatch?.[1] || '');
  if (!link || (!itemIdFrom(link) && !/\/p\/MLB|produto\.mercadolivre/i.test(link))) return null;
  let title = valueFromTag(block, ['title', 'aria-label', 'alt']);
  if (!title) title = stripTags(block.match(/<(?:h2|h3)\b[^>]*>[\s\S]*?<\/(?:h2|h3)>/i)?.[0] || '');
  title = title.replace(/\s*[-|]\s*Mercado Livre.*$/i, '').trim();
  if (!title || title.length < 4) return null;

  const imageTag = block.match(/<img\b[^>]*>/i)?.[0] || '';
  const image = absoluteUrl(attr(imageTag, 'data-src') || attr(imageTag, 'src') || attr(imageTag, 'srcset').split(/\s+/)[0], link);
  const visible = stripTags(block);
  const moneyValues = [];
  const tagRegex = /<(?:span|div|s)\b[^>]*(?:aria-label=["'][^"']*(?:reais?|centavos?|R\$)|andes-money-amount)[^>]*>/gi;
  let tagMatch;
  while ((tagMatch = tagRegex.exec(block))) {
    const tag = tagMatch[0];
    const value = parseAriaMoney(attr(tag, 'aria-label'));
    if (!Number.isFinite(value)) continue;
    const around = stripTags(block.slice(Math.max(0, tagMatch.index - 120), tagMatch.index + 240)).toLowerCase();
    if (/parcela|\d{1,2}x|cashback|de volta|ganhe/.test(around)) continue;
    moneyValues.push({
      value,
      old: /previous|original|antes|tachado|line-through|ui-pdp-price__original-value/i.test(`${tag} ${around}`)
    });
  }

  const explicitCurrent = moneyValues.filter(entry => !entry.old).map(entry => entry.value);
  const explicitOld = moneyValues.filter(entry => entry.old).map(entry => entry.value);
  const discountMatch = visible.match(/(\d{1,2})%\s*OFF/i);
  let price = explicitCurrent.length ? Math.min(...explicitCurrent) : NaN;
  let oldPrice = explicitOld.filter(value => !Number.isFinite(price) || value > price).sort((a, b) => a - b)[0] || NaN;

  if (!Number.isFinite(price)) {
    const values = [...visible.matchAll(/R\$\s*([\d.]+(?:,\d{1,2})?)/gi)].map(match => numeric(match[1])).filter(Number.isFinite);
    if (values.length) {
      price = discountMatch && values.length > 1 ? Math.min(...values) : values[0];
      const larger = values.filter(value => value > price * 1.01).sort((a, b) => a - b);
      if (larger.length) oldPrice = larger[0];
    }
  }

  return normalizeRadarItem({
    title,
    price: money(price),
    oldPrice: money(oldPrice),
    link,
    image,
    discount: discountMatch?.[1] || 0,
    full: /\bFULL\b/i.test(visible),
    freeShipping: /frete gr[aá]tis/i.test(visible),
    source: 'ofertas-card'
  });
}
function radarItemsFromCards(html) {
  const result = [];
  const blocks = html.match(/<(?:li|article|div)\b[^>]*class=["'][^"']*(?:poly-card|promotion-item|ui-search-result|andes-card)[^"']*["'][^>]*>[\s\S]{200,30000}?<\/(?:li|article|div)>/gi) || [];
  blocks.forEach(block => { const item = radarItemFromBlock(block); if (item) result.push(item); });
  if (result.length) return result;
  const linkPattern = /<a\b[^>]*href=["']([^"']*(?:mercadolivre\.com\.br|meli\.la)[^"']*)["'][^>]*>/gi;
  let match;
  while ((match = linkPattern.exec(html)) && result.length < 100) {
    const start = Math.max(0, match.index - 2500);
    const item = radarItemFromBlock(html.slice(start, match.index + 7000));
    if (item) result.push(item);
  }
  return result;
}

function dedupeRadarItems(items) {
  const seen = new Set();
  return items.filter(item => {
    const normalized = normalizeRadarItem(item);
    const key = normalized.id || normalized.link.replace(/[?#].*$/, '') || normalized.title.toLowerCase();
    if (!normalized.title || !normalized.link || !normalized.price || seen.has(key)) return false;
    seen.add(key);
    Object.assign(item, normalized);
    return true;
  });
}

async function radarFromSearchApi(query, limit = 50) {
  if (!query) return [];
  try {
    const response = await fetchWithTimeout(`https://api.mercadolibre.com/sites/MLB/search?q=${encodeURIComponent(query)}&limit=${Math.min(50, limit)}`, { headers: apiHeaders() });
    if (!response.ok) return [];
    const data = await response.json();
    return (data.results || []).map(item => normalizeRadarItem({
      id: item.id, title: item.title, price: item.sale_price?.amount || item.price,
      oldPrice: item.sale_price?.regular_amount || item.original_price, link: item.permalink,
      image: item.secure_thumbnail || item.thumbnail, seller: item.seller?.nickname,
      full: item.shipping?.logistic_type === 'fulfillment', freeShipping: item.shipping?.free_shipping,
      source: 'search-api'
    }));
  } catch { return []; }
}

async function radarFromSearchPage(query) {
  if (!query) return [];
  const slug = query.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  if (!slug) return [];
  try {
    const response = await fetchWithTimeout(`https://lista.mercadolivre.com.br/${encodeURIComponent(slug)}`, { headers: HEADERS }, 25000);
    if (!response.ok) return [];
    return dedupeRadarItems(radarItemsFromCards(await response.text()));
  } catch { return []; }
}

async function radarFromOffersPage() {
  const response = await fetchWithTimeout(RADAR_SOURCE_URL, { headers: HEADERS }, 25000);
  if (!response.ok) throw new Error(`A página de ofertas respondeu com código ${response.status}.`);
  const html = await response.text();
  return dedupeRadarItems([...radarItemsFromJsonLd(html), ...radarItemsFromCards(html)]);
}

async function enrichPromotionalPrices(items, maxItems = 12) {
  const candidates = items.filter(item => item.id && (!item.discount || !item.oldPrice)).slice(0, maxItems);
  if (!candidates.length) return items;
  const queue = [...candidates];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      const prices = await fetchApiPrices(item.id);
      if (!prices?.price) continue;
      const current = numeric(prices.price);
      const existing = numeric(item.price);
      const promotional = !Number.isFinite(existing) || current < existing || numeric(prices.oldPrice) > current;
      if (promotional) {
        item.price = prices.price;
        item.oldPrice = prices.oldPrice || (Number.isFinite(existing) && existing > current ? money(existing) : item.oldPrice);
        item.discount = radarDiscount(item.oldPrice, item.price);
        item.savings = numeric(item.oldPrice) > current ? money(numeric(item.oldPrice) - current) : '';
        item.score = radarScore(item);
        item.source = `${item.source}+sale-price`;
      }
    }
  });
  await Promise.all(workers);
  return items;
}

async function getRadarOffers(options = {}) {
  const query = clean(options.query || '');
  const category = clean(options.category || '');
  const minDiscount = Math.max(0, Math.min(95, Number(options.minDiscount || 0)));
  const maxPrice = Math.max(0, Number(options.maxPrice || 0));
  const onlyFull = String(options.onlyFull || '') === '1';
  const limit = Math.max(1, Math.min(60, Number(options.limit || 24)));
  const cacheKey = JSON.stringify({ query, category, minDiscount, maxPrice, onlyFull, limit });
  const cached = radarCache.get(cacheKey);
  if (!options.refresh && cached && Date.now() - cached.at < RADAR_CACHE_TTL) return { ...cached.value, cached: true };

  let items = query ? await radarFromSearchApi(query, 50) : [];
  let source = items.length ? 'Pesquisa do Mercado Livre' : 'Ofertas do Mercado Livre';
  if (query && !items.length) { items = await radarFromSearchPage(query); if (items.length) source = 'Pesquisa pública do Mercado Livre'; }
  if (!items.length) items = await radarFromOffersPage();
  items = await enrichPromotionalPrices(dedupeRadarItems(items), Math.min(16, limit));
  const normalizedQuery = query.toLowerCase();
  items = dedupeRadarItems(items)
    .filter(item => !normalizedQuery || item.title.toLowerCase().includes(normalizedQuery))
    .filter(item => !category || item.category === category)
    .filter(item => !minDiscount || item.discount >= minDiscount)
    .filter(item => !maxPrice || numeric(item.price) <= maxPrice)
    .filter(item => !onlyFull || item.full)
    .sort((a, b) => b.score - a.score || b.discount - a.discount)
    .slice(0, limit);
  const value = { items, total: items.length, source, updatedAt: Date.now(), cached: false };
  radarCache.set(cacheKey, { at: Date.now(), value });
  return value;
}

async function warmRadarCache() {
  try {
    await getRadarOffers({ minDiscount: 15, limit: 36, refresh: true });
    console.log('Radar automático atualizado em', new Date().toISOString());
  } catch (error) {
    console.warn('Radar automático não pôde ser atualizado:', error.message);
  }
}

function startRadarScheduler() {
  const firstRun = setTimeout(warmRadarCache, 2500);
  const interval = setInterval(
    warmRadarCache,
    Math.max(5 * 60 * 1000, RADAR_REFRESH_INTERVAL)
  );
  firstRun.unref();
  interval.unref();
  return () => {
    clearTimeout(firstRun);
    clearInterval(interval);
  };
}

module.exports = {
  getRadarOffers,
  normalizeRadarItem,
  startRadarScheduler,
  radarItemFromBlock,
  enrichPromotionalPrices
};
