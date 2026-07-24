'use strict';

const {
  RADAR_SOURCE_URL,
  RADAR_CACHE_TTL,
  RADAR_REFRESH_INTERVAL,
  BROWSER_HEADERS: HEADERS,
  apiHeaders
} = require('../config');
const { fetchWithTimeout } = require('../lib/http');
const { fetchApiPrices, fetchCatalogProduct } = require('../api/mercadoLivreApi');
const { parseAriaMoney, parseMercadoLivrePrices } = require('../parsers/mercadoLivrePriceParser');
const { resolveProductLink } = require('./linkResolver');
const {
  clean,
  decodeHtml,
  money,
  numeric,
  itemIdFrom,
  listingItemIdFrom,
  catalogProductIdFrom,
  attr,
  stripTags,
  absoluteUrl
} = require('../lib/format');

const radarCache = new Map();
const radarPriceCache = new Map();

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
  const link = absoluteUrl(item.link || item.url || item.permalink || '');
  let itemId = clean(item.id || item.itemId || listingItemIdFrom(link));
  const catalogProductId = clean(item.catalogProductId || catalogProductIdFrom(link));
  if (itemId && catalogProductId && itemId.replace('-', '').toUpperCase() === catalogProductId.replace('-', '').toUpperCase()) itemId = '';
  const price = money(item.price || item.salePrice || item.currentPrice);
  let oldPrice = money(item.oldPrice || item.originalPrice || item.regularPrice);
  if (numeric(oldPrice) <= numeric(price)) oldPrice = '';
  const image = absoluteUrl(Array.isArray(item.image) ? item.image[0] : (item.image?.url || item.image || ''), link || RADAR_SOURCE_URL);
  const normalized = {
    id: itemId,
    itemId,
    catalogProductId,
    title,
    price,
    oldPrice,
    link,
    image,
    seller: clean(item.seller?.name || item.seller || item.store || ''),
    full: Boolean(item.full || item.fulfillment || /\bfull\b/i.test(String(item.shipping || ''))),
    freeShipping: Boolean(item.freeShipping || item.free_shipping),
    category: item.category || radarCategory(title),
    source: item.source || 'ofertas',
    priceConfidence: Number(item.priceConfidence || 0),
    reportedDiscount: Math.max(0, Number(item.reportedDiscount || item.discount || 0))
  };
  const computedDiscount = radarDiscount(oldPrice, price);
  const providedDiscount = normalized.reportedDiscount;
  normalized.discount = computedDiscount
    ? (providedDiscount && Math.abs(providedDiscount - computedDiscount) <= 2 ? providedDiscount : computedDiscount)
    : 0;
  normalized.savings = Number.isFinite(numeric(oldPrice)) && Number.isFinite(numeric(price)) && numeric(oldPrice) > numeric(price)
    ? money(numeric(oldPrice) - numeric(price))
    : '';
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

function moneyFromCardTag(block, tag, index) {
  const aria = attr(tag, 'aria-label');
  const ariaValue = parseAriaMoney(aria);
  if (Number.isFinite(ariaValue)) return ariaValue;

  const segment = block.slice(index, Math.min(block.length, index + 900));
  const fraction = stripTags(segment.match(/<span\b[^>]*class=["'][^"']*andes-money-amount__fraction[^"']*["'][^>]*>[\s\S]{0,80}?<\/span>/i)?.[0] || '')
    .match(/[\d.]+/)?.[0];
  const cents = stripTags(segment.match(/<span\b[^>]*class=["'][^"']*andes-money-amount__cents[^"']*["'][^>]*>[\s\S]{0,40}?<\/span>/i)?.[0] || '')
    .match(/\d{1,2}/)?.[0];
  if (fraction) return numeric(cents ? `${fraction},${cents}` : fraction);

  const visible = stripTags(segment.slice(0, 260));
  const match = visible.match(/R\$\s*([\d.]+(?:,\d{1,2})?)/i);
  return match ? numeric(match[1]) : NaN;
}

function collectRadarMoneyCandidates(block) {
  const candidates = [];
  const regex = /<(s|span|div)\b[^>]*(?:andes-money-amount|aria-label=["'][^"']*(?:reais?|centavos?|R\$))[^>]*>/gi;
  let match;
  while ((match = regex.exec(block))) {
    const tagName = String(match[1] || '').toLowerCase();
    const tag = match[0];
    const value = moneyFromCardTag(block, tag, match.index);
    if (!Number.isFinite(value) || value <= 1 || value > 1000000) continue;

    const tagText = tag.toLowerCase();
    const before = stripTags(block.slice(Math.max(0, match.index - 110), match.index)).toLowerCase();
    const after = stripTags(block.slice(match.index + tag.length, Math.min(block.length, match.index + tag.length + 90))).toLowerCase();
    const nearBefore = before.slice(-60);
    const nearAfter = after.slice(0, 45);
    const context = `${nearBefore} ${nearAfter}`;
    const old = tagName === 's'
      || /previous|original|before|tachado|strike|line-through|ui-pdp-price__original-value|andes-money-amount--previous/.test(tagText);
    const installmentTag = /installment|parcel/.test(tagText) || /(?:parcela|\b\d{1,2}x)(?:\s+de)?\s*$/.test(nearBefore);
    const cashbackTag = /cashback|meli d[oó]lar|de volta|ganhe|ganhos/.test(context);
    const rejected = !old && (installmentTag || cashbackTag || /por m[eê]s/.test(context));
    const currentHint = /current|price__current|price-to-pay|price_to_pay|second-line|poly-price__current/.test(tagText);
    candidates.push({ value, old, rejected, currentHint, index: match.index, context });
  }
  return candidates;
}

function visibleMoneyCandidates(block) {
  const result = [];
  const regex = /R\$\s*([\d.]+(?:,\d{1,2})?)/gi;
  let match;
  while ((match = regex.exec(stripTags(block)))) {
    const value = numeric(match[1]);
    if (Number.isFinite(value) && value > 1 && value < 1000000) result.push(value);
  }
  return result;
}

function bestDiscountPair(oldCandidates, currentCandidates, discount) {
  if (!discount) return null;
  let best = null;
  for (const oldValue of oldCandidates) {
    for (const currentValue of currentCandidates) {
      if (!(oldValue > currentValue * 1.01)) continue;
      const calculated = Math.round((1 - currentValue / oldValue) * 100);
      const error = Math.abs(calculated - discount);
      if (!best || error < best.error || (error === best.error && currentValue < best.current)) {
        best = { old: oldValue, current: currentValue, error, calculated };
      }
    }
  }
  return best && best.error <= 4 ? best : null;
}

function radarItemFromBlock(block) {
  const hrefMatch = block.match(/<a\b[^>]*href=["']([^"']*(?:mercadolivre\.com\.br|meli\.la)[^"']*)["']/i);
  const link = absoluteUrl(hrefMatch?.[1] || '');
  const itemId = listingItemIdFrom(link);
  const catalogProductId = catalogProductIdFrom(link);
  if (!link || (!itemId && !catalogProductId && !/produto\.mercadolivre/i.test(link))) return null;

  let title = valueFromTag(block, ['title', 'aria-label', 'alt']);
  if (!title) title = stripTags(block.match(/<(?:h2|h3)\b[^>]*>[\s\S]*?<\/(?:h2|h3)>/i)?.[0] || '');
  title = title.replace(/\s*[-|]\s*Mercado Livre.*$/i, '').trim();
  if (!title || title.length < 4) return null;

  const imageTag = block.match(/<img\b[^>]*>/i)?.[0] || '';
  const image = absoluteUrl(attr(imageTag, 'data-src') || attr(imageTag, 'src') || attr(imageTag, 'srcset').split(/\s+/)[0], link);
  const visible = stripTags(block);
  const discount = Number(visible.match(/(\d{1,2})%\s*OFF/i)?.[1] || 0);
  const candidates = collectRadarMoneyCandidates(block);
  const explicitOld = candidates.filter(entry => entry.old).map(entry => entry.value);
  const explicitCurrent = candidates.filter(entry => !entry.old && !entry.rejected).map(entry => entry.value);
  const hintedCurrent = candidates.filter(entry => !entry.old && !entry.rejected && entry.currentHint).map(entry => entry.value);

  let pair = bestDiscountPair(explicitOld, explicitCurrent, discount);
  if (!pair && discount) {
    const visibleValues = visibleMoneyCandidates(block);
    pair = bestDiscountPair(visibleValues, visibleValues, discount);
  }

  let price = pair?.current;
  let oldPrice = pair?.old;
  let priceConfidence = pair ? 98 : 0;

  if (!Number.isFinite(price)) {
    const pool = hintedCurrent.length ? hintedCurrent : explicitCurrent;
    if (pool.length) {
      price = Math.min(...pool);
      priceConfidence = hintedCurrent.length ? 90 : 78;
    }
  }
  if (!Number.isFinite(oldPrice) && Number.isFinite(price)) {
    oldPrice = explicitOld.filter(value => value > price * 1.01).sort((a, b) => a - b)[0];
  }

  if (!Number.isFinite(price)) {
    const values = visibleMoneyCandidates(block);
    if (values.length) {
      price = discount && values.length > 1 ? Math.min(...values) : values[0];
      const larger = values.filter(value => value > price * 1.01).sort((a, b) => a - b);
      if (larger.length) oldPrice = larger[0];
      priceConfidence = discount ? 74 : 55;
    }
  }

  return normalizeRadarItem({
    id: itemId,
    itemId,
    catalogProductId,
    title,
    price: money(price),
    oldPrice: money(oldPrice),
    link,
    image,
    discount,
    priceConfidence,
    full: /\bFULL\b/i.test(visible),
    freeShipping: /frete gr[aá]tis|chegar[aá] gr[aá]tis/i.test(visible),
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
    const key = normalized.id || normalized.catalogProductId || normalized.link.replace(/[?#].*$/, '') || normalized.title.toLowerCase();
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
      id: item.id, catalogProductId: item.catalog_product_id || '', title: item.title, price: item.sale_price?.amount || item.price,
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

function radarPriceSuspicious(item = {}) {
  const current = numeric(item.price);
  const oldValue = numeric(item.oldPrice);
  const shownDiscount = Number(item.reportedDiscount || item.discount || 0);
  const calculated = radarDiscount(item.oldPrice, item.price);
  return !Number.isFinite(current)
    || (shownDiscount > 0 && (!Number.isFinite(oldValue) || oldValue <= current || Math.abs(shownDiscount - calculated) > 4))
    || Number(item.priceConfidence || 0) < 75;
}

function firstOldPriceAbove(current, values = []) {
  for (const value of values) {
    const amount = numeric(value);
    if (Number.isFinite(amount) && amount > current * 1.01) return money(amount);
  }
  return '';
}

async function resolveRadarLivePrice(item) {
  const key = item.id || item.catalogProductId || item.link;
  const cached = radarPriceCache.get(key);
  if (cached && Date.now() - cached.at < 5 * 60 * 1000) return cached.value;

  let catalog = null;
  let itemId = item.id || '';
  if (item.catalogProductId) {
    catalog = await fetchCatalogProduct(item.catalogProductId);
    if (!itemId && catalog?.itemId) itemId = catalog.itemId;
  }

  const apiPrices = itemId ? await fetchApiPrices(itemId) : null;
  let pagePrices = null;
  const shouldReadPage = Boolean(item.link) && (radarPriceSuspicious(item) || Boolean(item.catalogProductId) || !apiPrices?.price);
  if (shouldReadPage) {
    try {
      const resolved = await resolveProductLink(item.link, 14);
      if (resolved.html) {
        pagePrices = parseMercadoLivrePrices(resolved.html, {
          apiPrice: apiPrices?.price || catalog?.price || item.price,
          apiOldPrice: apiPrices?.oldPrice || catalog?.oldPrice || item.oldPrice
        });
      }
    } catch { /* API e preço do card continuam como fallback */ }
  }

  const existing = numeric(item.price);
  const pageCurrent = numeric(pagePrices?.price);
  const apiCurrent = numeric(apiPrices?.price);
  const catalogCurrent = numeric(catalog?.price);
  let current = NaN;
  let source = '';
  let confidence = Number(item.priceConfidence || 0);

  if (pagePrices?.pageDetected && Number(pagePrices.confidence || 0) >= 85 && Number.isFinite(pageCurrent)) {
    current = pageCurrent;
    source = 'page-price-to-pay';
    confidence = Number(pagePrices.confidence || 0);
  } else if (confidence >= 90 && Number.isFinite(existing)) {
    current = existing;
    source = 'radar-card';
  } else if (Number.isFinite(apiCurrent)) {
    current = apiCurrent;
    source = apiPrices?.source || 'sale-price';
    confidence = Math.max(confidence, 88);
  } else if (Number.isFinite(catalogCurrent)) {
    current = catalogCurrent;
    source = 'catalog-buy-box';
    confidence = Math.max(confidence, 82);
  } else if (Number.isFinite(existing)) {
    current = existing;
    source = 'radar-card-fallback';
  }

  if (!Number.isFinite(current)) return null;
  const oldPrice = firstOldPriceAbove(current, [
    pagePrices?.oldPrice,
    apiPrices?.oldPrice,
    catalog?.oldPrice,
    item.oldPrice,
    Number.isFinite(existing) && existing > current ? existing : ''
  ]);
  const value = {
    itemId,
    catalogProductId: catalog?.catalogProductId || item.catalogProductId || '',
    price: money(current),
    oldPrice,
    priceConfidence: confidence,
    source
  };
  radarPriceCache.set(key, { at: Date.now(), value });
  return value;
}

async function enrichPromotionalPrices(items, maxItems = 18) {
  const candidates = items
    .map((item, index) => ({ item, index, priority: radarPriceSuspicious(item) ? 2 : ((item.reportedDiscount || item.discount) ? 1 : 0) }))
    .sort((a, b) => b.priority - a.priority || a.index - b.index)
    .slice(0, Math.max(0, maxItems))
    .map(entry => entry.item);
  if (!candidates.length) return items;

  const queue = [...candidates];
  const workers = Array.from({ length: Math.min(4, queue.length) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      const live = await resolveRadarLivePrice(item);
      if (!live?.price) continue;
      const normalized = normalizeRadarItem({
        ...item,
        id: live.itemId || item.id,
        itemId: live.itemId || item.itemId,
        catalogProductId: live.catalogProductId || item.catalogProductId,
        price: live.price,
        oldPrice: live.oldPrice,
        priceConfidence: live.priceConfidence,
        source: `${item.source}+${live.source}`
      });
      Object.assign(item, normalized);
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
  items = await enrichPromotionalPrices(dedupeRadarItems(items), Math.min(24, limit));
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
