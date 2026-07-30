import { config } from '../config.js';
import { UpstreamError } from '../core/errors.js';

const DEFAULT_HEADERS = Object.freeze({
  'user-agent': 'Mozilla/5.0 (Linux; Android 13; CbOfertas/6.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Mobile Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8',
  'accept-language': 'pt-BR,pt;q=0.9,en;q=0.6',
  'cache-control': 'no-cache',
});

function mergeCookies(current, response) {
  const setCookie = response.headers.getSetCookie?.() || [];
  const jar = new Map();
  for (const entry of (current || '').split(';')) {
    const [name, ...rest] = entry.trim().split('=');
    if (name && rest.length) jar.set(name, rest.join('='));
  }
  for (const entry of setCookie) {
    const pair = entry.split(';', 1)[0];
    const [name, ...rest] = pair.split('=');
    if (name && rest.length) jar.set(name.trim(), rest.join('=').trim());
  }
  return [...jar.entries()].map(([key, value]) => `${key}=${value}`).join('; ');
}

export async function fetchWithRedirects(url, options = {}) {
  let currentUrl = new URL(url).toString();
  let method = options.method || 'GET';
  let body = options.body;
  let cookies = options.cookies || '';
  const redirects = [];

  for (let attempt = 0; attempt <= (options.maxRedirects ?? config.maxRedirects); attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? config.requestTimeoutMs);
    const headers = new Headers({ ...DEFAULT_HEADERS, ...(options.headers || {}) });
    if (cookies) headers.set('cookie', cookies);

    let response;
    try {
      response = await fetch(currentUrl, {
        method,
        body,
        headers,
        redirect: 'manual',
        signal: controller.signal,
      });
    } catch (error) {
      throw new UpstreamError(`Falha ao acessar ${new URL(currentUrl).hostname}.`, {
        details: { url: currentUrl, reason: error.message },
        cause: error,
      });
    } finally {
      clearTimeout(timeout);
    }

    cookies = mergeCookies(cookies, response);
    const location = response.headers.get('location');
    const isRedirect = [301, 302, 303, 307, 308].includes(response.status) && location;

    if (!isRedirect) {
      return { response, finalUrl: currentUrl, redirects, cookies };
    }

    const nextUrl = new URL(location, currentUrl).toString();
    if (typeof options.isRedirectAllowed === 'function' && !options.isRedirectAllowed(nextUrl, currentUrl)) {
      throw new UpstreamError('O redirecionamento saiu dos domínios permitidos.', {
        details: { from: currentUrl, to: nextUrl, redirects },
      });
    }
    redirects.push({ status: response.status, from: currentUrl, to: nextUrl });
    currentUrl = nextUrl;

    if ([301, 302, 303].includes(response.status) && method !== 'GET' && method !== 'HEAD') {
      method = 'GET';
      body = undefined;
    }
  }

  throw new UpstreamError('O link possui redirecionamentos demais.', {
    details: { url, redirects },
  });
}

export async function readTextLimited(response, maxBytes = config.maxHtmlBytes) {
  const reader = response.body?.getReader();
  if (!reader) return '';
  const decoder = new TextDecoder();
  let total = 0;
  let output = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    output += decoder.decode(value, { stream: true });
  }
  output += decoder.decode();
  return output;
}

export async function fetchJson(url, { token = '', headers = {}, timeoutMs } = {}) {
  const authHeaders = { accept: 'application/json', ...headers };
  if (token) authHeaders.authorization = `Bearer ${token}`;
  const { response, finalUrl, redirects } = await fetchWithRedirects(url, {
    headers: authHeaders,
    timeoutMs,
  });
  const text = await readTextLimited(response, 5_000_000);
  let payload = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    // A resposta será tratada como erro abaixo.
  }
  return { ok: response.ok, status: response.status, payload, text, finalUrl, redirects, headers: response.headers };
}
