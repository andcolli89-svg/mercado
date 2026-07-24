'use strict';

const { apiHeaders } = require('../config');
const { fetchWithTimeout } = require('../lib/http');
const { money, numeric } = require('../lib/format');

async function apiJson(url) {
  try {
    const response = await fetchWithTimeout(url, { headers: apiHeaders() }, 18000);
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function fetchSeller(sellerId) {
  const seller = sellerId ? await apiJson(`https://api.mercadolibre.com/users/${sellerId}`) : null;
  return seller?.nickname || seller?.first_name || '';
}

function normalizePricePayload(data) {
  if (!data || typeof data !== 'object') return null;
  if (data.amount != null) {
    return { price: money(data.amount), oldPrice: money(data.regular_amount), source: 'sale_price' };
  }
  const list = Array.isArray(data.prices) ? data.prices : [];
  if (!list.length) return null;
  const now = Date.now();
  const active = list.filter(entry => {
    const start = Date.parse(entry.conditions?.start_time || '');
    const end = Date.parse(entry.conditions?.end_time || '');
    return (!Number.isFinite(start) || start <= now) && (!Number.isFinite(end) || end >= now);
  });
  const marketplace = active.filter(entry => {
    const restrictions = entry.conditions?.context_restrictions || [];
    return !restrictions.length || restrictions.includes('channel_marketplace');
  });
  const candidates = marketplace.length ? marketplace : (active.length ? active : list);
  const promotional = candidates.filter(entry => /promotion|discount/i.test(entry.type || '') && numeric(entry.amount) > 0);
  const standards = candidates.filter(entry => /standard/i.test(entry.type || '') && numeric(entry.amount) > 0);
  const winner = [...promotional].sort((a, b) => numeric(a.amount) - numeric(b.amount))[0]
    || [...standards].sort((a, b) => numeric(a.amount) - numeric(b.amount))[0]
    || candidates.find(entry => numeric(entry.amount) > 0);
  if (!winner) return null;
  const standard = [...standards].sort((a, b) => numeric(b.amount) - numeric(a.amount))[0];
  const oldPrice = money(winner.regular_amount) || (standard && numeric(standard.amount) > numeric(winner.amount) ? money(standard.amount) : '');
  return { price: money(winner.amount), oldPrice, source: 'prices' };
}

async function fetchApiPrices(id) {
  if (!id) return null;
  const urls = [
    `https://api.mercadolibre.com/items/${id}/sale_price?context=channel_marketplace`,
    `https://api.mercadolibre.com/items/${id}/prices`
  ];
  for (const url of urls) {
    const normalized = normalizePricePayload(await apiJson(url));
    if (normalized?.price) return normalized;
  }
  return null;
}

async function fetchApiItem(id) {
  if (!id) return null;
  const item = await apiJson(`https://api.mercadolibre.com/items/${id}`);
  if (!item) return null;
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

module.exports = { apiJson, fetchApiItem, fetchApiPrices, fetchSeller, normalizePricePayload };
