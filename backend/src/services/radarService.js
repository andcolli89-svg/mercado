import { searchItems } from '../providers/mercadolivre/apiClient.js';
import { resolveMercadoLivreProduct } from '../providers/mercadolivre/provider.js';
import { fetchWithRedirects, readTextLimited } from '../http/fetcher.js';

async function mapWithConcurrency(values, concurrency, mapper) {
  const results = new Array(values.length);
  let nextIndex = 0;

  async function worker() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= values.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await mapper(values[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, worker));
  return results;
}

function normalizeItemId(value) {
  const match = String(value || '').match(/MLB[-_]?(\d{7,})/i);
  return match ? `MLB${match[1]}` : null;
}

function publicSearchLinks(html) {
  const links = [];
  const seen = new Set();
  const patterns = [
    /https:\/\/produto\.mercadolivre\.com\.br\/MLB[-_]\d+[^"' <]*/gi,
    /https:\/\/www\.mercadolivre\.com\.br\/[^"' <]*\/p\/MLB\d+[^"' <]*/gi,
  ];

  for (const pattern of patterns) {
    for (const match of String(html || '').matchAll(pattern)) {
      const link = match[0].replace(/&amp;/g, '&');
      const id = normalizeItemId(link) || link.match(/\/p\/(MLB\d+)/i)?.[1]?.toUpperCase();
      const key = id || link;
      if (!seen.has(key)) {
        seen.add(key);
        links.push(link);
      }
    }
  }
  return links;
}

async function searchPublicHtml(query, limit) {
  const url = `https://lista.mercadolivre.com.br/${encodeURIComponent(query).replace(/%20/g, '-')}`;
  const { response } = await fetchWithRedirects(url, { timeoutMs: 18_000 });
  const html = await readTextLimited(response, 4_000_000);
  return publicSearchLinks(html).slice(0, limit);
}

function apiCandidates(search, limit) {
  const results = Array.isArray(search?.results) ? search.results : [];
  const seen = new Set();
  const links = [];

  for (const item of results) {
    const id = normalizeItemId(item?.id);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    links.push(item?.permalink || `https://produto.mercadolivre.com.br/MLB-${id.slice(3)}-_JM`);
    if (links.length >= limit) break;
  }

  return links;
}

function scoreProduct(product) {
  const discount = Number(product.price?.discountPercent || 0);
  const confidence = Number(product.price?.confidence || 0);
  const freeShipping = product.shipping?.free ? 8 : 0;
  const seller = product.seller?.nickname ? 4 : 0;
  return discount * 2 + confidence * 20 + freeShipping + seller;
}

export async function runRadar(query, limit = 8) {
  const desired = Math.min(12, Math.max(1, limit));
  const candidateLimit = Math.min(24, desired * 3);

  let links = [];
  let apiSearchError = null;

  try {
    const search = await searchItems(query, candidateLimit);
    links = apiCandidates(search, candidateLimit);
  } catch (error) {
    apiSearchError = error;
  }

  if (!links.length) {
    try {
      links = await searchPublicHtml(query, candidateLimit);
    } catch (error) {
      if (!apiSearchError) apiSearchError = error;
    }
  }

  const uniqueLinks = [...new Set(links)];
  const settled = await mapWithConcurrency(uniqueLinks, 3, (link) =>
    resolveMercadoLivreProduct(link, { includeSeller: false }));

  const products = settled
    .filter((entry) => entry.status === 'fulfilled')
    .map((entry) => entry.value)
    .filter((product) => product.price?.confirmed && product.price?.current?.amount)
    .filter((product, index, array) => {
      const key = product.itemId || product.catalogProductId || product.permalink;
      return array.findIndex((entry) =>
        (entry.itemId || entry.catalogProductId || entry.permalink) === key) === index;
    })
    .sort((a, b) => scoreProduct(b) - scoreProduct(a))
    .slice(0, desired);

  return products;
}
