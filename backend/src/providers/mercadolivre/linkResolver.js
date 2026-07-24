import { ProductNotFoundError } from '../../core/errors.js';
import { fetchWithRedirects, readTextLimited } from '../../http/fetcher.js';

const MLB = 'MLB';

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

function extractCanonical(html) {
  const patterns = [
    /<link[^>]+rel=["'][^"']*canonical[^"']*["'][^>]+href=["']([^"']+)["']/i,
    /<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*canonical[^"']*["']/i,
    /<meta[^>]+property=["']og:url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:url["']/i,
  ];
  for (const pattern of patterns) {
    const match = String(html || '').match(pattern);
    if (match?.[1]) return match[1].replace(/&amp;/g, '&');
  }
  return null;
}

export async function resolveMercadoLivreLink(inputUrl) {
  let parsed;
  try {
    parsed = new URL(String(inputUrl).trim());
  } catch {
    throw new ProductNotFoundError('O link informado é inválido.');
  }

  if (!/(^|\.)(mercadolivre\.com\.br|mercadolivre\.com|meli\.la)$/i.test(parsed.hostname)) {
    throw new ProductNotFoundError('O link não pertence ao Mercado Livre.', { hostname: parsed.hostname });
  }

  const directId = fromUrl(parsed.toString());
  if (directId && parsed.hostname !== 'meli.la') {
    return {
      inputUrl: parsed.toString(),
      finalUrl: parsed.toString(),
      canonicalUrl: parsed.toString(),
      ...directId,
      html: '',
      redirects: [],
      status: null,
    };
  }

  const { response, finalUrl, redirects } = await fetchWithRedirects(parsed.toString());
  const html = await readTextLimited(response);
  const canonicalUrl = extractCanonical(html) || finalUrl;
  const identified = fromUrl(canonicalUrl)
    || fromUrl(finalUrl)
    || fromExplicitMarkup(html);

  if (!identified) {
    throw new ProductNotFoundError('O link foi aberto, mas o MLB não pôde ser confirmado.', {
      status: response.status,
      finalUrl,
      redirects,
    });
  }

  return {
    inputUrl: parsed.toString(),
    finalUrl,
    canonicalUrl,
    ...identified,
    html,
    redirects,
    status: response.status,
  };
}
