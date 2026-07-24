'use strict';

const { URL } = require('node:url');
const { ALLOWED_PRODUCT_HOST } = require('../config');
const { clean, decodeHtml, money, numeric, listingItemIdFrom, catalogProductIdFrom, shopeeItemIdFrom, meta } = require('../lib/format');
const { fetchApiItem, fetchApiPrices, fetchCatalogProduct } = require('../api/mercadoLivreApi');
const { parseMercadoLivrePrices } = require('../parsers/mercadoLivrePriceParser');
const { parseShopeePrices } = require('../parsers/shopeePriceParser');
const { resolveProductLink } = require('./linkResolver');

function jsonLd(html) {
  const scripts = String(html).match(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
  const walk = value => {
    if (!value) return null;
    if (Array.isArray(value)) {
      for (const entry of value) {
        const found = walk(entry);
        if (found) return found;
      }
      return null;
    }
    if (typeof value !== 'object') return null;
    if (String(value['@type'] || '').toLowerCase() === 'product') return value;
    if (value['@graph']) return walk(value['@graph']);
    for (const child of Object.values(value)) {
      const found = walk(child);
      if (found) return found;
    }
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
    } catch { /* tenta o próximo JSON-LD */ }
  }
  return {};
}

function pageText(html) {
  return decodeHtml(String(html))
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractSeller(html, text) {
  const candidates = [
    text.match(/Loja oficial\s+([^|•·]{2,80}?)(?=\s+(?:Ganhos|Compartilhar|Conferir|Vendido|$))/i)?.[1],
    text.match(/Vendido por\s+([^|•·]{2,80}?)(?=\s+(?:MercadoL[ií]der|\+?\d|Compra Garantida|Devolu[cç][aã]o|$))/i)?.[1],
    html.match(/"official_store_name"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"seller_name"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"nickname"\s*:\s*"([^"]+)"/i)?.[1]
  ];
  return clean(candidates.find(Boolean) || '').replace(/\s+/g, ' ');
}

function extractOtherPaymentPrice(text) {
  const match = String(text).match(/ou\s+R\$\s*([\d.]+(?:,\d{1,2})?)\s+em outros meios/i);
  return match ? money(match[1]) : '';
}

function extractInstallments(html, text, selectedPrice) {
  const candidates = [];
  const add = (count, amount, interest = '') => {
    const quantity = Number(count);
    const value = numeric(amount);
    if (!Number.isInteger(quantity) || quantity < 2 || quantity > 48 || !Number.isFinite(value) || value <= 0) return;
    if (!candidates.some(entry => entry.count === quantity && Math.abs(entry.amount - value) < 0.005)) {
      candidates.push({ count: quantity, amount: value, interest: String(interest || '').trim() });
    }
  };

  const visiblePatterns = [
    /(\d{1,2})x\s+(?:de\s+)?R\$\s*([\d.]+[,\.]\d{2})(?:\s+(sem juros|com juros))?/gi,
    /(\d{1,2})x\s+(?:de\s+)?R\$\s*([\d.]+)\s+(\d{2})(?:\s+(sem juros|com juros))?/gi
  ];
  for (const pattern of visiblePatterns) {
    let match;
    while ((match = pattern.exec(text))) {
      const amount = match[3] && /^\d{2}$/.test(match[3]) ? `${match[2]},${match[3]}` : match[2];
      const interest = match[4] || (match[3] && !/^\d{2}$/.test(match[3]) ? match[3] : '');
      add(match[1], amount, interest);
    }
  }

  const jsonPatterns = [
    /"installments"\s*:\s*(\d{1,2})[\s\S]{0,500}?"(?:installment_amount|installmentAmount|amount)"\s*:\s*([\d.]+)/gi,
    /"quantity"\s*:\s*(\d{1,2})[\s\S]{0,250}?"installment_amount"\s*:\s*([\d.]+)/gi
  ];
  for (const pattern of jsonPatterns) {
    let match;
    while ((match = pattern.exec(html))) add(match[1], match[2], '');
  }

  if (!candidates.length) return { count: '', amount: '', interest: '' };
  const price = numeric(selectedPrice);
  let chosen = candidates[0];
  if (Number.isFinite(price)) {
    chosen = [...candidates].sort((a, b) => {
      const differenceA = Math.abs(a.count * a.amount - price) / price;
      const differenceB = Math.abs(b.count * b.amount - price) / price;
      return differenceA - differenceB;
    })[0];
    if (Math.abs(chosen.count * chosen.amount - price) / price > 0.28) return { count: '', amount: '', interest: '' };
  }
  return { count: String(chosen.count), amount: money(chosen.amount), interest: chosen.interest };
}

function discountPercent(oldPrice, price) {
  const oldValue = numeric(oldPrice);
  const currentValue = numeric(price);
  return Number.isFinite(oldValue) && Number.isFinite(currentValue) && oldValue > currentValue
    ? Math.round((1 - currentValue / oldValue) * 100)
    : 0;
}

function choosePriceSources(html, api, apiPrices, structured) {
  const parsed = parseMercadoLivrePrices(html, {
    apiPrice: apiPrices?.price || api?.price || structured.price,
    apiOldPrice: apiPrices?.oldPrice || api?.oldPrice || structured.oldPrice
  });

  const apiCurrent = apiPrices?.price || api?.price || structured.price || '';
  const apiOld = apiPrices?.oldPrice || api?.oldPrice || structured.oldPrice || '';
  let price = parsed.price || apiCurrent;
  let oldPrice = parsed.oldPrice || apiOld;

  // Se a página identificou um preço promocional forte, ele vence o preço regular da API.
  // Ex.: aria-label="475 reais com 96 centavos" e preço original R$ 1.248,75.
  if (parsed.pageDetected && parsed.confidence >= 85) {
    price = parsed.price;
    oldPrice = parsed.oldPrice || (numeric(apiCurrent) > numeric(parsed.price) ? apiCurrent : apiOld);
  }

  if (numeric(oldPrice) <= numeric(price)) oldPrice = '';
  return { ...parsed, price: money(price), oldPrice: money(oldPrice) };
}

function marketplaceFromHost(hostname = '') {
  return /(^|\.)shopee\.com\.br$|(^|\.)shope\.ee$/i.test(hostname) ? 'shopee' : 'mercado-livre';
}

function shortAffiliateLink(url) {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === 'meli.la' || host.endsWith('.meli.la') || host === 'shope.ee' || host.endsWith('.shope.ee') || host === 's.shopee.com.br';
  } catch { return false; }
}

function extractShopeeSeller(html, text) {
  const candidates = [
    html.match(/"shop_name"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"shopname"\s*:\s*"([^"]+)"/i)?.[1],
    html.match(/"username"\s*:\s*"([^"]+)"/i)?.[1],
    text.match(/Vendido por\s+([^|•·]{2,80}?)(?=\s+(?:Avaliações|Produtos|Chat|$))/i)?.[1]
  ];
  return clean(candidates.find(Boolean) || '').replace(/\\u[0-9a-f]{4}/gi, '').replace(/\s+/g, ' ');
}

async function productFromUrl(source, dependencies = {}) {
  let input;
  try {
    input = new URL(clean(source));
  } catch {
    throw new Error('Cole um link completo do Mercado Livre, meli.la ou Shopee.');
  }
  if (!['http:', 'https:'].includes(input.protocol) || !ALLOWED_PRODUCT_HOST.test(input.hostname)) {
    throw new Error('Use um link do Mercado Livre, meli.la ou Shopee.');
  }

  const resolveLink = dependencies.resolveProductLink || resolveProductLink;
  const loadItem = dependencies.fetchApiItem || fetchApiItem;
  const loadPrices = dependencies.fetchApiPrices || fetchApiPrices;
  const loadCatalog = dependencies.fetchCatalogProduct || fetchCatalogProduct;
  const requestedPlatform = marketplaceFromHost(input.hostname);
  const affiliateLink = shortAffiliateLink(input.href) ? input.href : '';
  const requestedItemId = requestedPlatform === 'shopee' ? shopeeItemIdFrom(input.href) : listingItemIdFrom(input.href);
  const requestedCatalogId = requestedPlatform === 'mercado-livre' ? catalogProductIdFrom(input.href) : '';

  let resolutionError = null;
  let resolved;
  try {
    resolved = await resolveLink(input.href);
  } catch (error) {
    resolutionError = error;
    resolved = { response: null, finalUrl: input.href, html: '', hops: [], unresolvedRedirect: true };
  }

  const finalUrl = resolved.finalUrl || input.href;
  let finalHost = input.hostname;
  try { finalHost = new URL(finalUrl).hostname; } catch { /* usa o host inicial */ }
  const platform = marketplaceFromHost(finalHost || input.hostname);
  const html = resolved.html || '';
  const pageStatus = Number(resolved.response?.status || 0);

  let catalogProductId = platform === 'mercado-livre'
    ? (requestedCatalogId || catalogProductIdFrom(finalUrl) || catalogProductIdFrom(html))
    : '';
  let id = platform === 'shopee'
    ? (requestedItemId || shopeeItemIdFrom(finalUrl) || shopeeItemIdFrom(html))
    : (requestedItemId || listingItemIdFrom(finalUrl) || listingItemIdFrom(html));

  const catalog = platform === 'mercado-livre' && catalogProductId
    ? await loadCatalog(catalogProductId)
    : null;
  if (!id && catalog?.itemId) id = catalog.itemId;

  const [api, apiPrices] = platform === 'mercado-livre' && id
    ? await Promise.all([loadItem(id), loadPrices(id)])
    : [null, null];
  catalogProductId = api?.catalogProductId || catalog?.catalogProductId || catalogProductId;

  const structured = jsonLd(html);
  const text = pageText(html);
  const fallbackApi = api || catalog || {};
  const prices = platform === 'shopee'
    ? parseShopeePrices(html, {
      apiPrice: structured.price || meta(html, 'product:price:amount') || meta(html, 'og:price:amount'),
      apiOldPrice: structured.oldPrice || meta(html, 'product:original_price:amount')
    })
    : choosePriceSources(html, fallbackApi, apiPrices, {
      ...structured,
      price: structured.price || catalog?.price || '',
      oldPrice: structured.oldPrice || catalog?.oldPrice || ''
    });

  const seller = platform === 'shopee'
    ? (extractShopeeSeller(html, text) || structured.seller || '')
    : (extractSeller(html, text) || structured.seller || api?.seller || '');
  const title = (structured.title || api?.title || catalog?.title || meta(html, 'og:title') || '')
    .replace(/\s*[|\-]\s*(?:Mercado Livre|Shopee Brasil).*$/i, '')
    .trim();
  const image = structured.image || api?.image || catalog?.image || meta(html, 'og:image');

  if (!title) {
    if (resolutionError) throw new Error(`Não foi possível abrir o link do produto: ${resolutionError.message}`);
    if (pageStatus >= 300 && pageStatus < 400) {
      throw new Error('O link redirecionou, mas o anúncio final não pôde ser identificado. Copie novamente pelo botão Compartilhar.');
    }
    if (pageStatus >= 400) throw new Error(`A loja respondeu com código ${pageStatus} e o produto não pôde ser identificado.`);
    throw new Error('Não foi possível identificar o produto. Abra o anúncio e copie novamente o link de Compartilhar.');
  }
  if (!prices.price) {
    if (pageStatus >= 300 && pageStatus < 400) {
      throw new Error('O produto foi identificado, mas o redirecionamento não entregou o preço atual. Tente novamente em alguns segundos.');
    }
    throw new Error('O produto foi identificado, mas o preço atual não pôde ser confirmado. Use o link de Compartilhar do anúncio.');
  }

  const installment = extractInstallments(html, text, prices.price);
  const otherPrice = extractOtherPaymentPrice(text);
  const canonicalLink = api?.permalink || catalog?.permalink || finalUrl || input.href;
  const freeShipping = Boolean(api?.freeShipping || catalog?.freeShipping) || /frete gr[aá]tis/i.test(text);
  const full = Boolean(api?.full || catalog?.full);

  return {
    id: api?.id || id,
    platform,
    catalogProductId,
    title,
    price: prices.price,
    currentPrice: prices.price,
    pixPrice: prices.price,
    oldPrice: prices.oldPrice,
    originalPrice: prices.oldPrice,
    discount: discountPercent(prices.oldPrice, prices.price),
    otherPrice,
    otherPaymentPrice: otherPrice,
    seller,
    store: seller,
    installments: installment.count,
    installmentAmount: installment.amount,
    installmentInterest: installment.interest,
    image,
    imageProxy: image ? `/api/image?url=${encodeURIComponent(image)}` : '',
    permalink: affiliateLink || canonicalLink,
    originalPermalink: canonicalLink,
    affiliateLink,
    affiliateConfirmed: Boolean(affiliateLink),
    full,
    freeShipping,
    freight: freeShipping ? 'Frete grátis' : '',
    source: {
      platform,
      itemId: id || null,
      requestedItemId: requestedItemId || null,
      catalogProductId: catalogProductId || null,
      affiliate: Boolean(affiliateLink),
      priceSource: prices.priceSource || apiPrices?.source || (platform === 'shopee' ? 'shopee-page' : (catalog?.price ? 'catalog-buy-box' : 'items')),
      oldPriceSource: prices.oldPriceSource || '',
      pagePriceDetected: Boolean(prices.pageDetected),
      priceConfidence: Number(prices.confidence || 0),
      pageStatus: pageStatus || null,
      resolvedUrl: canonicalLink,
      redirectResolved: !resolved.unresolvedRedirect,
      redirectHops: resolved.hops?.length || 1
    }
  };
}

module.exports = {
  productFromUrl,
  fetchApiItem,
  fetchApiPrices,
  choosePriceSources,
  extractInstallments,
  jsonLd,
  marketplaceFromHost,
  extractShopeeSeller
};
