'use strict';

const PORT = Number(process.env.PORT || 10000);
const RADAR_SOURCE_URL = process.env.RADAR_SOURCE_URL || 'https://www.mercadolivre.com.br/ofertas';
const RADAR_CACHE_TTL = Number(process.env.RADAR_CACHE_TTL || 10 * 60 * 1000);
const RADAR_REFRESH_INTERVAL = Number(process.env.RADAR_REFRESH_INTERVAL || 15 * 60 * 1000);
const ALLOWED_IMAGE_HOST = /(^|\.)(meli\.la|mercadolivre\.com\.br|mercadolibre\.com|mercadolibre\.com\.br|mlstatic\.com)$/i;

const BROWSER_HEADERS = Object.freeze({
  'user-agent': 'Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Mobile Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/json;q=0.9,image/avif,image/webp,image/*,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
  'cache-control': 'no-cache',
  pragma: 'no-cache'
});

function apiHeaders() {
  const token = process.env.MELI_ACCESS_TOKEN || process.env.ACCESS_TOKEN || '';
  const headers = { ...BROWSER_HEADERS, accept: 'application/json' };
  return token ? { ...headers, authorization: `Bearer ${token}` } : headers;
}

module.exports = {
  PORT,
  RADAR_SOURCE_URL,
  RADAR_CACHE_TTL,
  RADAR_REFRESH_INTERVAL,
  ALLOWED_IMAGE_HOST,
  BROWSER_HEADERS,
  apiHeaders
};
