'use strict';

const { URL } = require('node:url');
const { BROWSER_HEADERS, ALLOWED_PRODUCT_HOST } = require('../config');
const { fetchWithTimeout } = require('../lib/http');
const { clean, decodeHtml } = require('../lib/format');

function redirectFromHtml(html = '', baseUrl = '') {
  const decoded = decodeHtml(String(html));
  const candidates = [
    decoded.match(/<meta\b[^>]*http-equiv=["']?refresh["']?[^>]*content=["'][^"']*url\s*=\s*([^"'>\s]+)/i)?.[1],
    decoded.match(/<meta\b[^>]*content=["'][^"']*url\s*=\s*([^"'>\s]+)[^"']*["'][^>]*http-equiv=["']?refresh/i)?.[1],
    decoded.match(/(?:window\.)?location(?:\.href|\.replace|\.assign)?\s*(?:=|\()\s*["']([^"']+)["']/i)?.[1],
    decoded.match(/"(?:url|redirect|redirect_url|permalink)"\s*:\s*"(https?:\\?\/\\?\/[^"\\]+(?:\\.[^"\\]*)*)"/i)?.[1]
  ].filter(Boolean);
  for (const candidate of candidates) {
    try {
      return new URL(candidate.replace(/\\\//g, '/').replace(/[);]+$/, ''), baseUrl).href;
    } catch { /* tenta o próximo */ }
  }
  return '';
}

function redirectStatus(status) {
  return [301, 302, 303, 307, 308].includes(Number(status));
}

function setCookieValues(headers) {
  if (!headers) return [];
  if (typeof headers.getSetCookie === 'function') return headers.getSetCookie();
  const raw = headers.get?.('set-cookie') || '';
  return raw ? raw.split(/,(?=\s*[^;,=\s]+=[^;,]*)/) : [];
}

function updateCookieJar(jar, headers) {
  for (const value of setCookieValues(headers)) {
    const pair = String(value).split(';', 1)[0];
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    const cookieValue = pair.slice(separator + 1).trim();
    if (name) jar.set(name, cookieValue);
  }
}

function cookieHeader(jar) {
  return [...jar.entries()].map(([name, value]) => `${name}=${value}`).join('; ');
}

function validateTarget(target, allowedHost = ALLOWED_PRODUCT_HOST) {
  const parsed = new URL(target);
  if (!['http:', 'https:'].includes(parsed.protocol) || !allowedHost.test(parsed.hostname)) {
    throw new Error('O redirecionamento saiu dos domínios permitidos.');
  }
  parsed.hash = '';
  return parsed.href;
}

async function resolveProductLink(source, maxHops = 14, options = {}) {
  const allowedHost = options.allowedHost || ALLOWED_PRODUCT_HOST;
  const fetcher = options.fetcher || fetchWithTimeout;
  const timeout = Number(options.timeout || 25000);
  let current = validateTarget(clean(source), allowedHost);
  const visited = new Set();
  const cookies = new Map();
  let lastResponse = null;
  let html = '';

  for (let hop = 0; hop < maxHops; hop += 1) {
    const visitKey = current.replace(/#.*$/, '');
    if (visited.has(visitKey)) {
      return {
        response: lastResponse,
        finalUrl: current,
        html,
        hops: [...visited],
        unresolvedRedirect: true,
        redirectLoop: true
      };
    }
    visited.add(visitKey);

    const headers = { ...BROWSER_HEADERS, ...(options.headers || {}) };
    const cookie = cookieHeader(cookies);
    if (cookie) headers.cookie = cookie;

    const response = await fetcher(current, { headers, redirect: 'manual' }, timeout);
    lastResponse = response;
    updateCookieJar(cookies, response.headers);
    html = await response.text().catch(() => '');

    const location = response.headers?.get?.('location') || '';
    const htmlRedirect = redirectFromHtml(html, current);
    if (redirectStatus(response.status) || htmlRedirect) {
      const target = location || htmlRedirect;
      if (!target) {
        return {
          response,
          finalUrl: current,
          html,
          hops: [...visited],
          unresolvedRedirect: true
        };
      }
      current = validateTarget(new URL(target, current).href, allowedHost);
      continue;
    }

    return {
      response,
      finalUrl: response.url || current,
      html,
      hops: [...visited],
      unresolvedRedirect: false
    };
  }

  return {
    response: lastResponse,
    finalUrl: current,
    html,
    hops: [...visited],
    unresolvedRedirect: true,
    maxHopsReached: true
  };
}

module.exports = {
  resolveProductLink,
  redirectFromHtml,
  redirectStatus,
  validateTarget,
  updateCookieJar
};
