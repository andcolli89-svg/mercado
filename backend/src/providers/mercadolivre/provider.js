import { ProductNotFoundError } from '../../core/errors.js';
import { priceCandidate, selectPriceModel } from '../../core/priceModel.js';
import { getCatalogProduct, getItem, getPrices, getSalePrice, getUser } from './apiClient.js';
import { extractLabeledVisiblePrices, extractStructuredProduct } from './htmlExtractor.js';
import { extractMercadoLivreId, resolveMercadoLivreLink } from './linkResolver.js';

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

    if (price.amount) {
      candidates.push(priceCandidate({
        amount: price.amount,
        kind: 'current',
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

function settledValue(result) {
  return result?.status === 'fulfilled' ? result.value : null;
}

function settledError(result) {
  if (result?.status !== 'rejected') return null;

  const error = result.reason;
  return {
    message: error?.message || 'Falha desconhecida',
    status: Number.isFinite(error?.status) ? error.status : null,
    code: error?.payload?.code || error?.code || null,
  };
}

async function settle(promise) {
  const [result] = await Promise.allSettled([promise]);
  return result;
}

export async function resolveMercadoLivreProduct(url, { includeSeller = true } = {}) {
  const resolved = await resolveMercadoLivreLink(url);
  const catalogProductId = resolved.type === 'catalog' ? resolved.id : null;

  let catalog = null;
  let catalogResult = null;
  let itemId = resolved.type === 'item' ? resolved.id : null;

  // IMPORTANTE:
  // A API de catálogo pode responder 403 por política mesmo com token válido.
  // Por isso, ela nunca pode derrubar a consulta pública do anúncio.
  if (catalogProductId) {
    catalogResult = await settle(getCatalogProduct(catalogProductId));
    catalog = settledValue(catalogResult);

    itemId = catalog?.buy_box_winner?.item_id || null;

    // Tenta encontrar o MLB do anúncio vencedor no HTML já aberto pelo link curto.
    if (!itemId) {
      const embedded = extractMercadoLivreId(resolved.html);
      if (embedded?.type === 'item') itemId = embedded.id;
    }
  }

  const structuredWithoutItem = extractStructuredProduct(resolved.html, itemId);

  // Se o catálogo não entregou o MLB, ainda permitimos retornar os dados públicos
  // quando título/imagem/preço foram confirmados pelo HTML. Isso evita erro 500.
  if (!itemId) {
    const publicCandidates = [
      ...structuredWithoutItem.candidates,
      ...extractLabeledVisiblePrices(resolved.html, null),
    ];
    const publicPrice = selectPriceModel(publicCandidates);

    if (!structuredWithoutItem.title && !structuredWithoutItem.image && !publicPrice.confirmed) {
      throw new ProductNotFoundError(
        'A página foi aberta, mas o anúncio vencedor e os dados públicos não puderam ser confirmados.',
        {
          catalogProductId,
          catalogApiError: settledError(catalogResult),
        },
      );
    }

    return {
      platform: 'mercado_livre',
      itemId: null,
      catalogProductId,
      title: structuredWithoutItem.title || catalog?.name || 'Produto do Mercado Livre',
      seller: { id: null, nickname: null },
      availability: { status: null, availableQuantity: null },
      shipping: {
        free: Boolean(catalog?.buy_box_winner?.shipping?.free_shipping),
        logisticType: catalog?.buy_box_winner?.shipping?.logistic_type || null,
      },
      images: [structuredWithoutItem.image].filter(Boolean),
      thumbnail: structuredWithoutItem.image || null,
      permalink: structuredWithoutItem.permalink || resolved.canonicalUrl || resolved.finalUrl,
      sourceUrl: resolved.inputUrl,
      resolvedUrl: resolved.finalUrl,
      price: publicPrice,
      metadata: {
        categoryId: null,
        condition: null,
        listingTypeId: null,
        redirects: resolved.redirects,
        apiTokenConfigured: Boolean(process.env.MELI_ACCESS_TOKEN),
        apiFallbackUsed: true,
        catalogApiError: settledError(catalogResult),
        itemIdPending: true,
      },
    };
  }

  // Todas as chamadas protegidas são opcionais. Um 401/403/404 não derruba o produto.
  const [itemResult, salePriceResult, pricesResult] = await Promise.allSettled([
    getItem(itemId),
    getSalePrice(itemId),
    getPrices(itemId),
  ]);

  const item = settledValue(itemResult) || {};
  const salePrice = settledValue(salePriceResult);
  const prices = settledValue(pricesResult);
  const structured = extractStructuredProduct(resolved.html, itemId);
  const candidates = [
    ...candidatesFromApis({ itemId, item, salePrice, prices, catalog }),
    ...structured.candidates,
    ...extractLabeledVisiblePrices(resolved.html, itemId),
  ];
  const price = selectPriceModel(candidates, { expectedItemId: itemId });

  if (!item.id && !structured.title && !structured.image && !price.confirmed) {
    throw new ProductNotFoundError(
      'O MLB foi identificado, mas os dados públicos do anúncio não puderam ser confirmados.',
      {
        itemId,
        apiErrors: {
          catalog: settledError(catalogResult),
          item: settledError(itemResult),
          salePrice: settledError(salePriceResult),
          prices: settledError(pricesResult),
        },
      },
    );
  }

  const sellerId = item.seller_id || catalog?.buy_box_winner?.seller_id || null;
  let seller = null;
  let sellerResult = null;

  // A consulta de vendedor também pode receber 403 e não deve gerar erro interno.
  if (includeSeller && sellerId) {
    sellerResult = await settle(getUser(sellerId));
    seller = settledValue(sellerResult);
  }

  const images = [...new Set([...itemPictures(item), structured.image].filter(Boolean))];

  return {
    platform: 'mercado_livre',
    itemId,
    catalogProductId: catalogProductId || item.catalog_product_id || null,
    title: item.title || catalog?.name || structured.title || 'Produto do Mercado Livre',
    seller: {
      id: sellerId,
      nickname: seller?.nickname || null,
    },
    availability: {
      status: item.status || null,
      availableQuantity: Number.isFinite(item.available_quantity)
        ? item.available_quantity
        : null,
    },
    shipping: {
      free: Boolean(
        item.shipping?.free_shipping
        || catalog?.buy_box_winner?.shipping?.free_shipping,
      ),
      logisticType:
        item.shipping?.logistic_type
        || catalog?.buy_box_winner?.shipping?.logistic_type
        || null,
    },
    images,
    thumbnail: images[0] || item.thumbnail || null,
    permalink:
      item.permalink
      || structured.permalink
      || resolved.canonicalUrl
      || resolved.finalUrl,
    sourceUrl: resolved.inputUrl,
    resolvedUrl: resolved.finalUrl,
    price,
    metadata: {
      categoryId: item.category_id || null,
      condition: item.condition || null,
      listingTypeId: item.listing_type_id || null,
      redirects: resolved.redirects,
      apiTokenConfigured: Boolean(process.env.MELI_ACCESS_TOKEN),
      apiFallbackUsed: !item.id,
      apiErrors: {
        catalog: settledError(catalogResult),
        item: settledError(itemResult),
        salePrice: settledError(salePriceResult),
        prices: settledError(pricesResult),
        seller: settledError(sellerResult),
      },
    },
  };
}
