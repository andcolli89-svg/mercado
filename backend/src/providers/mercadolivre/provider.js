import { ProductNotFoundError } from '../../core/errors.js';
import { priceCandidate, selectPriceModel } from '../../core/priceModel.js';
import { getCatalogProduct, getItem, getPrices, getSalePrice, getUser } from './apiClient.js';
import { extractLabeledVisiblePrices, extractStructuredProduct } from './htmlExtractor.js';
import { resolveMercadoLivreLink } from './linkResolver.js';

function itemPictures(item) {
  const pictures = Array.isArray(item?.pictures) ? item.pictures : [];
  return pictures
    .map((picture) => picture.secure_url || picture.url)
    .filter(Boolean);
}

function candidatesFromApis({ itemId, item, salePrice, prices, catalog }) {
  const candidates = [];
  if (salePrice?.amount) {
    candidates.push(priceCandidate({
      amount: salePrice.amount,
      kind: 'current',
      source: 'sale_price_api',
      confidence: 0.99,
      currency: salePrice.currency_id || 'BRL',
      itemId,
      label: 'Preço vencedor do marketplace',
    }));
  }
  if (salePrice?.regular_amount && salePrice.regular_amount > salePrice.amount) {
    candidates.push(priceCandidate({
      amount: salePrice.regular_amount,
      kind: 'original',
      source: 'sale_price_api',
      confidence: 0.99,
      currency: salePrice.currency_id || 'BRL',
      itemId,
      label: 'Preço regular do preço vencedor',
    }));
  }

  const winner = catalog?.buy_box_winner;
  if (winner?.item_id === itemId && winner.price) {
    candidates.push(priceCandidate({
      amount: winner.price,
      kind: 'current',
      source: 'catalog_buy_box',
      confidence: 0.92,
      currency: winner.currency_id || 'BRL',
      itemId,
      label: 'Preço do anúncio vencedor do catálogo',
    }));
  }

  for (const price of prices?.prices || []) {
    const restrictions = price.conditions?.context_restrictions || [];
    const allowedContexts = new Set(['channel_marketplace']);
    const hasSpecialContext = restrictions.some((context) => !allowedContexts.has(context));
    if (hasSpecialContext || Number(price.conditions?.min_purchase_unit || 0) > 1) continue;
    const kind = price.type === 'promotion' ? 'current' : 'current';
    if (price.amount) {
      candidates.push(priceCandidate({
        amount: price.amount,
        kind,
        source: 'item_api',
        confidence: price.type === 'promotion' ? 0.91 : 0.78,
        currency: price.currency_id || 'BRL',
        itemId,
        label: `Preço ${price.type || 'standard'}`,
        context: restrictions,
      }));
    }
    if (price.regular_amount && price.regular_amount > price.amount) {
      candidates.push(priceCandidate({
        amount: price.regular_amount,
        kind: 'original',
        source: 'item_api',
        confidence: 0.9,
        currency: price.currency_id || 'BRL',
        itemId,
        label: 'Preço regular da promoção',
        context: restrictions,
      }));
    }
  }

  if (item?.price) {
    candidates.push(priceCandidate({
      amount: item.price,
      kind: 'current',
      source: 'item_api',
      confidence: 0.76,
      currency: item.currency_id || 'BRL',
      itemId,
      label: 'Preço legado do item',
    }));
  }
  if (item?.original_price && item.original_price > item.price) {
    candidates.push(priceCandidate({
      amount: item.original_price,
      kind: 'original',
      source: 'item_api',
      confidence: 0.76,
      currency: item.currency_id || 'BRL',
      itemId,
      label: 'Preço original legado do item',
    }));
  }
  return candidates;
}

export async function resolveMercadoLivreProduct(url, { includeSeller = true } = {}) {
  const resolved = await resolveMercadoLivreLink(url);
  let catalog = null;
  let itemId = resolved.type === 'item' ? resolved.id : null;
  let catalogProductId = resolved.type === 'catalog' ? resolved.id : null;

  if (catalogProductId) {
    catalog = await getCatalogProduct(catalogProductId);
    itemId = catalog?.buy_box_winner?.item_id || null;
  }

  if (!itemId) {
    throw new ProductNotFoundError('A página foi identificada, mas não há anúncio vencedor disponível.', {
      catalogProductId,
    });
  }

  const [item, salePrice, prices] = await Promise.all([
    getItem(itemId),
    getSalePrice(itemId),
    getPrices(itemId),
  ]);

  if (!item?.id) {
    throw new ProductNotFoundError('O MLB foi identificado, mas os dados do anúncio não foram confirmados.', { itemId });
  }

  const structured = extractStructuredProduct(resolved.html, itemId);
  const candidates = [
    ...candidatesFromApis({ itemId, item, salePrice, prices, catalog }),
    ...structured.candidates,
    ...extractLabeledVisiblePrices(resolved.html, itemId),
  ];
  const price = selectPriceModel(candidates, { expectedItemId: itemId });
  const seller = includeSeller
    ? await getUser(item.seller_id || catalog?.buy_box_winner?.seller_id || null)
    : null;
  const images = [...new Set([...itemPictures(item), structured.image].filter(Boolean))];

  return {
    platform: 'mercado_livre',
    itemId,
    catalogProductId: catalogProductId || item.catalog_product_id || null,
    title: item.title || catalog?.name || structured.title || 'Produto do Mercado Livre',
    seller: {
      id: item.seller_id || catalog?.buy_box_winner?.seller_id || null,
      nickname: seller?.nickname || null,
    },
    availability: {
      status: item.status || null,
      availableQuantity: Number.isFinite(item.available_quantity) ? item.available_quantity : null,
    },
    shipping: {
      free: Boolean(item.shipping?.free_shipping || catalog?.buy_box_winner?.shipping?.free_shipping),
      logisticType: item.shipping?.logistic_type || catalog?.buy_box_winner?.shipping?.logistic_type || null,
    },
    images,
    thumbnail: images[0] || item.thumbnail || null,
    permalink: item.permalink || resolved.canonicalUrl || resolved.finalUrl,
    sourceUrl: resolved.inputUrl,
    resolvedUrl: resolved.finalUrl,
    price,
    metadata: {
      categoryId: item.category_id || null,
      condition: item.condition || null,
      listingTypeId: item.listing_type_id || null,
      redirects: resolved.redirects,
      apiTokenConfigured: Boolean(process.env.MELI_ACCESS_TOKEN),
    },
  };
}
