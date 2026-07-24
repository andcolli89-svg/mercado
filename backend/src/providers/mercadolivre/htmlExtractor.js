import { parseMoney } from '../../core/money.js';
import { priceCandidate } from '../../core/priceModel.js';

function decodeEntities(value) {
  return String(value || '')
    .replace(/&quot;|&#34;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;|&#160;/g, ' ');
}

function safeJson(value) {
  try {
    return JSON.parse(decodeEntities(value));
  } catch {
    return null;
  }
}

function walk(node, visitor, path = []) {
  if (!node || typeof node !== 'object') return;
  visitor(node, path);
  if (Array.isArray(node)) {
    node.forEach((child, index) => walk(child, visitor, [...path, index]));
  } else {
    Object.entries(node).forEach(([key, child]) => walk(child, visitor, [...path, key]));
  }
}

function structuredBlocks(html) {
  return [...String(html || '').matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
    .map((match) => safeJson(match[1]))
    .filter(Boolean);
}

function meta(html, property) {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, 'i'),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, 'i'),
  ];
  for (const pattern of patterns) {
    const value = String(html || '').match(pattern)?.[1];
    if (value) return decodeEntities(value);
  }
  return '';
}

function itemIdFromNode(node, expectedItemId) {
  const candidates = [node.sku, node.productID, node.mpn, node.item_id, node.itemId];
  for (const value of candidates) {
    const id = String(value || '').match(/MLB[0-9]{7,}/i)?.[0]?.toUpperCase();
    if (id) return id;
  }
  return expectedItemId;
}

export function extractStructuredProduct(html, expectedItemId = null) {
  const product = {
    title: meta(html, 'og:title') || null,
    image: meta(html, 'og:image') || null,
    permalink: meta(html, 'og:url') || null,
    candidates: [],
  };

  const metaPrice = parseMoney(meta(html, 'product:price:amount'));
  if (metaPrice) {
    product.candidates.push(priceCandidate({
      amount: metaPrice,
      kind: 'current',
      source: 'structured_data',
      confidence: 0.78,
      itemId: expectedItemId,
      label: 'Meta product:price:amount',
    }));
  }

  for (const block of structuredBlocks(html)) {
    walk(block, (node) => {
      const type = Array.isArray(node['@type']) ? node['@type'] : [node['@type']];
      const isProduct = type.includes('Product') || type.includes('Offer') || type.includes('AggregateOffer');
      if (!isProduct) return;

      if (!product.title && typeof node.name === 'string') product.title = node.name;
      if (!product.image) {
        const image = Array.isArray(node.image) ? node.image[0] : node.image;
        if (typeof image === 'string') product.image = image;
        else if (image?.url) product.image = image.url;
      }

      const itemId = itemIdFromNode(node, expectedItemId);
      const price = parseMoney(node.price ?? node.lowPrice);
      const highPrice = parseMoney(node.highPrice ?? node.regularPrice);
      if (price) {
        product.candidates.push(priceCandidate({
          amount: price,
          kind: 'current',
          source: 'structured_data',
          confidence: itemId && expectedItemId && itemId === expectedItemId ? 0.86 : 0.74,
          currency: node.priceCurrency || 'BRL',
          itemId,
          label: 'Preço estruturado da oferta',
        }));
      }
      if (highPrice && (!price || highPrice > price)) {
        product.candidates.push(priceCandidate({
          amount: highPrice,
          kind: 'original',
          source: 'structured_data',
          confidence: 0.78,
          currency: node.priceCurrency || 'BRL',
          itemId,
          label: 'Preço regular estruturado',
        }));
      }
    });
  }

  return product;
}

function plainText(html) {
  return decodeEntities(String(html || ''))
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function amountFromGroups(integerPart, centsPart) {
  if (!integerPart) return null;
  const integer = String(integerPart).replace(/\D/g, '');
  const cents = String(centsPart || '').replace(/\D/g, '').padEnd(2, '0').slice(0, 2);
  return parseMoney(`${integer},${cents || '00'}`);
}

function addPair(candidates, original, current, label, expectedItemId, confidence = 0.84) {
  if (!original || !current || original <= current) return;
  candidates.push(
    priceCandidate({
      amount: current,
      kind: 'current',
      source: 'visible_labeled_price',
      confidence,
      itemId: expectedItemId,
      label: `${label} — preço atual`,
    }),
    priceCandidate({
      amount: original,
      kind: 'original',
      source: 'visible_labeled_price',
      confidence: Math.max(0.72, confidence - 0.03),
      itemId: expectedItemId,
      label: `${label} — preço original`,
    }),
  );
}

export function extractLabeledVisiblePrices(html, expectedItemId = null) {
  const plain = plainText(html);
  const candidates = [];

  for (const match of plain.matchAll(/R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?\s+de\s+cashback/gi)) {
    const amount = amountFromGroups(match[1], match[2]);
    if (amount) candidates.push(priceCandidate({ amount, kind: 'cashback', source: 'visible_labeled_price', confidence: 0.99, itemId: expectedItemId, label: match[0] }));
  }

  for (const match of plain.matchAll(/(\d{1,2})x\s+(?:de\s+)?R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?/gi)) {
    const amount = amountFromGroups(match[2], match[3]);
    if (amount) candidates.push(priceCandidate({ amount, kind: 'installment', source: 'visible_labeled_price', confidence: 0.98, itemId: expectedItemId, label: match[0], context: [`installments:${match[1]}`] }));
  }

  for (const match of plain.matchAll(/pre[cç]o\s+por\s+(?:quilo|kg|unidade)[^R]{0,30}R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?/gi)) {
    const amount = amountFromGroups(match[1], match[2]);
    if (amount) candidates.push(priceCandidate({ amount, kind: 'unit', source: 'visible_labeled_price', confidence: 0.98, itemId: expectedItemId, label: match[0] }));
  }

  // Formato recorrente do anúncio: preço riscado, preço atual e percentual OFF.
  // A ordem é importante: o primeiro valor é original e o segundo é atual.
  for (const match of plain.matchAll(/R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?\s+R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?\s+(\d{1,2})%\s*OFF/gi)) {
    const original = amountFromGroups(match[1], match[2]);
    const current = amountFromGroups(match[3], match[4]);
    addPair(candidates, original, current, match[0], expectedItemId, 0.88);
  }

  for (const match of plain.matchAll(/(?:antes|pre[cç]o\s+original|de)\s*:?[ ]*R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?[^R]{0,80}(?:agora|por|no\s+pix)\s*:?[ ]*R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?/gi)) {
    const original = amountFromGroups(match[1], match[2]);
    const current = amountFromGroups(match[3], match[4]);
    addPair(candidates, original, current, match[0], expectedItemId, 0.9);
  }

  // Texto de acessibilidade do Mercado Livre: “142 reais com 39 centavos”.
  for (const match of plain.matchAll(/(?:agora|por|no\s+pix|pre[cç]o\s+atual)[^\d]{0,30}([\d.]+)\s+reais(?:\s+com\s+(\d{1,2})\s+centavos)?/gi)) {
    const amount = amountFromGroups(match[1], match[2]);
    if (amount) candidates.push(priceCandidate({ amount, kind: 'current', source: 'visible_labeled_price', confidence: 0.84, itemId: expectedItemId, label: match[0] }));
  }

  for (const match of plain.matchAll(/R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?\s+no\s+pix/gi)) {
    const amount = amountFromGroups(match[1], match[2]);
    if (amount) candidates.push(priceCandidate({ amount, kind: 'pix', source: 'visible_labeled_price', confidence: 0.86, itemId: expectedItemId, label: match[0] }));
  }

  // Um valor isolado só é aceito quando possui rótulo explícito. “Oferta do dia”
  // não entra aqui, pois normalmente vem antes do preço riscado.
  for (const match of plain.matchAll(/(?:agora|por|no\s+pix|pre[cç]o\s+atual)\s*:?[ ]*R\$\s*([\d.]+)(?:\s*[, ]\s*(\d{2}))?/gi)) {
    const amount = amountFromGroups(match[1], match[2]);
    if (amount) candidates.push(priceCandidate({ amount, kind: 'current', source: 'visible_labeled_price', confidence: 0.82, itemId: expectedItemId, label: match[0] }));
  }

  return candidates;
}
