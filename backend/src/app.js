import { config } from './config.js';
import { AppError, ValidationError } from './core/errors.js';
import { resolveProduct } from './services/productService.js';
import { runRadar } from './services/radarService.js';
import { evaluateCoupons } from './services/couponService.js';

function corsHeaders(origin) {
  const allowed = config.allowedOrigins.includes('*') || config.allowedOrigins.includes(origin) ? origin || '*' : 'null';
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,authorization',
    'access-control-max-age': '86400',
  };
}

function sendJson(response, status, payload, origin = '') {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    ...corsHeaders(origin),
  });
  response.end(JSON.stringify(payload));
}

async function readJson(request) {
  const chunks = [];
  let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > 1_000_000) throw new ValidationError('O corpo da requisição é muito grande.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ValidationError('JSON inválido.');
  }
}

function legacyProduct(product) {
  const current = product.price?.current?.amount || null;
  const original = product.price?.original?.amount || null;
  const installment = product.price?.installment;
  const installmentMatch = String(installment?.label || '').match(/(\d{1,2})x/i);
  return {
    id: product.itemId,
    platform: product.platform,
    catalogProductId: product.catalogProductId,
    title: product.title,
    price: current,
    currentPrice: current,
    pixPrice: current,
    oldPrice: original,
    originalPrice: original,
    discount: product.price?.discountPercent || 0,
    seller: product.seller?.nickname || '',
    store: product.seller?.nickname || '',
    installments: installmentMatch ? Number(installmentMatch[1]) : 0,
    installmentAmount: installment?.amount || null,
    image: product.thumbnail || product.images?.[0] || '',
    permalink: product.permalink,
    originalPermalink: product.permalink,
    full: product.shipping?.logisticType === 'fulfillment',
    freeShipping: Boolean(product.shipping?.free),
    freight: product.shipping?.free ? 'Frete grátis' : '',
    source: {
      platform: product.platform,
      itemId: product.itemId,
      catalogProductId: product.catalogProductId,
      priceSource: product.price?.current?.source || '',
      priceConfidence: product.price?.confidence || 0,
      resolvedUrl: product.resolvedUrl,
    },
  };
}

function legacyRadarItem(product) {
  return {
    id: product.itemId,
    itemId: product.itemId,
    catalogProductId: product.catalogProductId,
    title: product.title,
    price: product.price?.current?.amount || null,
    oldPrice: product.price?.original?.amount || null,
    discount: product.price?.discountPercent || 0,
    link: product.permalink,
    image: product.thumbnail || product.images?.[0] || '',
    seller: product.seller?.nickname || '',
    full: product.shipping?.logisticType === 'fulfillment',
    freeShipping: Boolean(product.shipping?.free),
    priceConfidence: product.price?.confidence || 0,
    score: Math.round((product.price?.discountPercent || 0) * 2 + (product.shipping?.free ? 8 : 0)),
  };
}

export function createApp() {
  return async function app(request, response) {
    const origin = request.headers.origin || '';
    if (request.method === 'OPTIONS') {
      response.writeHead(204, corsHeaders(origin));
      response.end();
      return;
    }

    const requestUrl = new URL(request.url || '/', `http://${request.headers.host || 'localhost'}`);
    try {
      if (request.method === 'GET' && (requestUrl.pathname === '/' || requestUrl.pathname === '/health')) {
        sendJson(response, 200, {
          ok: true,
          service: 'cbofertas-v6-api',
          version: config.version,
          timestamp: new Date().toISOString(),
          mercadoLivreTokenConfigured: Boolean(config.mercadoLivreToken),
          compatibility: ['v6', 'v5.2.1'],
          features: ['radar-fallback', 'smart-coupons', 'automatic-product-images', 'promozone-redirects'],
        }, origin);
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/v1/products/resolve') {
        const body = await readJson(request);
        const product = await resolveProduct(body.url);
        sendJson(response, 200, { ok: true, product }, origin);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/v1/products/resolve') {
        const product = await resolveProduct(requestUrl.searchParams.get('url'));
        sendJson(response, 200, { ok: true, product }, origin);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/v1/radar') {
        const query = requestUrl.searchParams.get('query')?.trim();
        if (!query) throw new ValidationError('Informe o termo do Radar.');
        const limit = Number.parseInt(requestUrl.searchParams.get('limit') || '8', 10);
        const products = await runRadar(query, Math.min(12, Math.max(1, limit)));
        sendJson(response, 200, { ok: true, query, products }, origin);
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/v1/coupons/evaluate') {
        const body = await readJson(request);
        if (!body.product) throw new ValidationError('Informe o produto.');
        const result = evaluateCoupons(body.product, Array.isArray(body.coupons) ? body.coupons : []);
        sendJson(response, 200, { ok: true, ...result }, origin);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/product') {
        const product = await resolveProduct(requestUrl.searchParams.get('url'));
        sendJson(response, 200, legacyProduct(product), origin);
        return;
      }

      if (request.method === 'GET' && requestUrl.pathname === '/api/radar') {
        const query = requestUrl.searchParams.get('query')?.trim();
        if (!query) throw new ValidationError('Informe o termo do Radar.');
        const limit = Number.parseInt(requestUrl.searchParams.get('limit') || '8', 10);
        const products = await runRadar(query, Math.min(12, Math.max(1, limit)));
        sendJson(response, 200, {
          items: products.map(legacyRadarItem),
          total: products.length,
          source: 'CbOfertas V6 Alpha 5.5',
          updatedAt: Date.now(),
          cached: false,
        }, origin);
        return;
      }

      sendJson(response, 404, { ok: false, error: { code: 'NOT_FOUND', message: 'Rota não encontrada.' } }, origin);
    } catch (error) {
      const normalized = error instanceof AppError
        ? error
        : new AppError('Erro interno ao processar a solicitação.', { cause: error });
      if (!(error instanceof AppError)) console.error(error);
      sendJson(response, normalized.status, {
        ok: false,
        error: {
          code: normalized.code,
          message: normalized.message,
          details: normalized.details,
        },
      }, origin);
    }
  };
}
