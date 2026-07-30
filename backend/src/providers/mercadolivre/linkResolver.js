import { ProductNotFoundError } from '../../core/errors.js';
import { fetchWithRedirects, readTextLimited } from '../../http/fetcher.js';

const MLB = 'MLB';
const TRUSTED_REDIRECT_HOSTS = new Set([
  'go.promozone.ai',
]);

function normalizedHostname(value) {
  return String(value || '').trim().toLowerCase().replace(/\.$/, '');
}

export function isMercadoLivreHostname(value) {
  const hostname = normalizedHostname(value);
  return /(^|\.)(mercadolivre\.com\.br|mercadolivre\.com|meli\.la)$/i.test(hostname);
}

export function isTrustedRedirectHostname(value) {
  return TRUSTED_REDIRECT_HOSTS.has(normalizedHostname(value));
}

export function isSupportedMercadoLivreInputHostname(value) {
  return isMercadoLivreHostname(value) || isTrustedRedirectHostname(value);
}

function normalizeId(value) {
  const match = String(value || '').match(/MLB[-_]?([0-9]{4,})/i);
  return match ? `${MLB}${match[1]}` : null;
}

function fromUrl(value) {
  let url;
  try {
    url = new URL(String(value));
  } catch {
    return null;
  }

  // Páginas /p/ representam produtos de catálogo. É essencial testar isso
  // antes do padrão genérico MLB, pois catálogo e anúncio usam o mesmo prefixo.
  const catalogPath = url.pathname.match(/\/p\/(MLB[0-9]{4,})(?:[/?#-]|$)/i);
  if (catalogPath) return { id: normalizeId(catalogPath[1]), type: 'catalog' };

  const catalogParam = url.searchParams.get('catalog_product_id') || url.searchParams.get('product_id');
  if (catalogParam && normalizeId(catalogParam)) return { id: normalizeId(catalogParam), type: 'catalog' };

  const itemParam = url.searchParams.get('item_id') || url.searchParams.get('itemId');
  if (itemParam && normalizeId(itemParam)) return { id: normalizeId(itemParam), type: 'item' };

  const itemPath = url.pathname.match(/(?:^|\/)(MLB)[-_]([0-9]{7,})(?:[-_/?#]|$)/i)
    || url.pathname.match(/(?:^|\/)(MLB[0-9]{7,})(?:[-_/?#]|$)/i);
  if (itemPath) return { id: normalizeId(itemPath[0]), type: 'item' };

  return null;
}

function fromExplicitMarkup(value) {
  const text = String(value || '');
  const itemPatterns = [
    /["']item_id["']\s*:\s*["'](MLB[0-9]{7,})["']/i,
    /["']itemId["']\s*:\s*["'](MLB[0-9]{7,})["']/i,
    /(?:item_id|itemId)=((?:MLB)[0-9]{7,})/i,
    /<meta[^>]+(?:property|name)=["']product:retailer_item_id["'][^>]+content=["'](MLB[0-9]{7,})["']/i,
  ];
  for (const pattern of itemPatterns) {
    const id = normalizeId(text.match(pattern)?.[1]);
    if (id) return { id, type: 'item' };
  }

  const catalogPatterns = [
    /["']catalog_product_id["']\s*:\s*["'](MLB[0-9]{4,})["']/i,
    /["']product_id["']\s*:\s*["'](MLB[0-9]{4,})["']/i,
    /(?:catalog_product_id|product_id)=((?:MLB)[0-9]{4,})/i,
  ];
  for (const pattern of catalogPatterns) {
    const id = normalizeId(text.match(pattern)?.[1]);
    if (id) return { id, type: 'catalog' };
  }
  return null;
}

export function extractMercadoLivreId(value) {
  if (!value) return null;
  const decoded = runCatchingDecode(value);
  return fromUrl(decoded)
    || fromExplicitMarkup(decoded)
    || (() => {
      // Aceita IDs isolados para uso interno e testes. Um ID simples é tratado
      // como anúncio; páginas de catálogo devem ser identificadas pelo /p/ ou
      // pelo campo catalog_product_id.
      const clean = decoded.trim();
      if (/^MLB[-_]?[0-9]{7,}$/i.test(clean)) return { id: normalizeId(clean), type: 'item' };
      return null;
    })();
}

function runCatchingDecode(value) {
  try {
    return decodeURIComponent(String(value));
  } catch {
    return String(value);
  }
}

function cleanEmbeddedUrl(value, baseUrl = '') {
  const unescaped = String(value || '')
    .replace(/\\u0026/gi, '&')
    .replace(/\\\//g, '/')
    .replace(/&amp;/gi, '&')
    .replace(/["'<>\s]+$/g, '')
    .trim();
  if (!unescaped) return null;
  try {
    return new URL(unescaped, baseUrl || undefined).toString();
  } catch {
    return null;
  }
}

function mercadoLivreTarget(value, baseUrl = '') {
  const target = cleanEmbeddedUrl(value, baseUrl);
  if (!target) return null;
  try {
    return isMercadoLivreHostname(new URL(target).hostname) ? target : null;
  } catch {
    return null;
  }
}

function extractCanonical(html, baseUrl = '') {
  const patterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i,
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match?.[1]) return cleanEmbeddedUrl(match[1], baseUrl);
  }
  return null;
}

/**
 * Encontra um destino do Mercado Livre dentro de páginas intermediárias.
 * Suporta meta refresh, JavaScript, links comuns e URLs codificadas.
 */
export function extractMercadoLivreTarget(html, baseUrl = '') {
  const text = String(html || '');
  const decoded = runCatchingDecode(text);
  const sources = decoded === text ? [text] : [text, decoded];
  const patterns = [
    /<meta[^>]+http-equiv=["']?refresh["']?[^>]+content=["'][^"']*url\s*=\s*([^"';>]+)["']/gi,
    /(?:window\.)?location(?:\.href)?\s*=\s*["']([^"']+)["']/gi,
    /location\.replace\(\s*["']([^"']+)["']\s*\)/gi,
    /<a[^>]+href=["']([^"']+)["']/gi,
    /(https?:\\?\/\\?\/(?:[^\s"'<>\\]|\\.)+)/gi,
  ];

  const canonical = extractCanonical(text, baseUrl);
  const canonicalTarget = mercadoLivreTarget(canonical, baseUrl);
  if (canonicalTarget) return canonicalTarget;

  for (const source of sources) {
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      for (const match of source.matchAll(pattern)) {
        const target = mercadoLivreTarget(match[1], baseUrl);
        if (target) return target;
      }
    }
  }
  return null;
}

function redirectAllowed(nextUrl) {
  try {
    return isSupportedMercadoLivreInputHostname(new URL(nextUrl).hostname);
  } catch {
    return false;
  }
}

async function fetchPage(url) {
  const result = await fetchWithRedirects(url, { isRedirectAllowed: redirectAllowed });
  const html = await readTextLimited(result.response);
  return { ...result, html };
}

export async function resolveMercadoLivreLink(inputUrl) {
  let parsed;
  try {
    parsed = new URL(String(inputUrl).trim());
  } catch {
    throw new ProductNotFoundError('O link informado é inválido.');
  }

  if (!isSupportedMercadoLivreInputHostname(parsed.hostname)) {
    throw new ProductNotFoundError('O link não pertence ao Mercado Livre nem a um redirecionador habilitado.', {
      hostname: parsed.hostname,
    });
  }

  const allRedirects = [];
  let currentUrl = parsed.toString();
  let page = null;

  // Uma página intermediária, como go.promozone.ai, pode usar redirecionamento
  // HTTP, meta refresh ou JavaScript. Seguimos no máximo três etapas públicas.
  for (let step = 0; step < 3; step += 1) {
    page = await fetchPage(currentUrl);
    allRedirects.push(...page.redirects);

    const finalHost = new URL(page.finalUrl).hostname;
    const embeddedTarget = extractMercadoLivreTarget(page.html, page.finalUrl);
    if (!isMercadoLivreHostname(finalHost) && embeddedTarget) {
      allRedirects.push({ status: 200, from: page.finalUrl, to: embeddedTarget, kind: 'html' });
      currentUrl = embeddedTarget;
      continue;
    }
    break;
  }

  if (!page) throw new ProductNotFoundError('O link não pôde ser aberto.');

  const finalUrl = page.finalUrl;
  const finalHost = new URL(finalUrl).hostname;
  const canonicalCandidate = extractCanonical(page.html, finalUrl);
  const canonicalUrl = mercadoLivreTarget(canonicalCandidate, finalUrl)
    || (isMercadoLivreHostname(finalHost) ? finalUrl : extractMercadoLivreTarget(page.html, finalUrl));

  const identified = fromUrl(canonicalUrl)
    || fromUrl(finalUrl)
    || fromExplicitMarkup(page.html);

  if (!identified) {
    throw new ProductNotFoundError('O link foi aberto, mas o MLB não pôde ser confirmado.', {
      status: page.response.status,
      finalUrl,
      redirects: allRedirects,
    });
  }

  return {
    inputUrl: parsed.toString(),
    finalUrl,
    canonicalUrl: canonicalUrl || finalUrl,
    ...identified,
    html: page.html,
    redirects: allRedirects,
    status: page.response.status,
  };
}
