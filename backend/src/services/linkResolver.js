'use strict';

const { URL } = require('node:url');
const { BROWSER_HEADERS, ALLOWED_PRODUCT_HOST } = require('../config');
const { fetchWithTimeout } = require('../lib/http');
const { clean, decodeHtml } = require('../lib/format');

function redirectFromHtml(html = '', baseUrl = '') {
  const decoded = decodeHtml(String(html));
  const candidates = [
    decoded.match(/<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url=([^"'>\s]+)/i)?.[1],
    decoded.match(/(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/i)?.[1],
    decoded.match(/"url"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]*)*)"/i)?.[1]
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return new URL(candidate.replace(/\\\//g, '/'), baseUrl).href; } catch { /* próximo */ }
  }
  return '';
}

async function resolveProductLink(source, maxHops = 8) {
  let current = clean(source);
  const visited = new Set();
  let lastResponse = null;
  let html = '';

  for (let hop = 0; hop < maxHops; hop += 1) {
    if (visited.has(current)) break;
    const currentUrl = new URL(current);
    if (!ALLOWED_PRODUCT_HOST.test(currentUrl.hostname)) throw new Error('O redirecionamento saiu dos domínios permitidos.');
    visited.add(current);
    const response = await fetchWithTimeout(current, { headers: BROWSER_HEADERS, redirect: 'manual' }, 25000);
    lastResponse = response;
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) break;
      current = new URL(location, current).href;
      continue;
    }
    html = await response.text();
    const htmlRedirect = redirectFromHtml(html, current);
    if (htmlRedirect && htmlRedirect !== current && !visited.has(htmlRedirect)) {
      current = htmlRedirect;
      continue;
    }
    return { response, finalUrl: response.url || current, html, hops: [...visited] };
  }

  if (lastResponse && !html) html = await lastResponse.text().catch(() => '');
  return { response: lastResponse, finalUrl: lastResponse?.url || current, html, hops: [...visited] };
}

module.exports = { resolveProductLink, redirectFromHtml };
