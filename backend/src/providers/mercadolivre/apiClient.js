import { config } from '../../config.js';
import { fetchJson } from '../../http/fetcher.js';

const API = 'https://api.mercadolibre.com';

function endpoint(path) {
  return `${API}${path}`;
}

async function request(path, { optional = false } = {}) {
  const result = await fetchJson(endpoint(path), { token: config.mercadoLivreToken });
  if (!result.ok && !optional) {
    const error = new Error(`Mercado Livre API respondeu ${result.status}.`);
    error.status = result.status;
    error.payload = result.payload;
    throw error;
  }
  return result.ok ? result.payload : null;
}

export function getItem(itemId) {
  return request(`/items/${encodeURIComponent(itemId)}?include_attributes=all`);
}

export function getSalePrice(itemId) {
  return request(`/items/${encodeURIComponent(itemId)}/sale_price?context=channel_marketplace`, { optional: true });
}

export function getPrices(itemId) {
  return request(`/items/${encodeURIComponent(itemId)}/prices`, { optional: true });
}

export function getCatalogProduct(productId) {
  return request(`/products/${encodeURIComponent(productId)}`, { optional: true });
}

export function getUser(userId) {
  if (!userId) return Promise.resolve(null);
  return request(`/users/${encodeURIComponent(userId)}`, { optional: true });
}

export function searchItems(query, limit = 20) {
  const q = encodeURIComponent(query);
  return request(`/sites/${config.mercadoLivreSite}/search?q=${q}&limit=${Math.min(50, Math.max(1, limit))}`, { optional: true });
}
