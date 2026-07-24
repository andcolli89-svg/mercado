import { config } from './config.js';
import { AppError, ValidationError } from './core/errors.js';
import { resolveProduct } from './services/productService.js';
import { runRadar } from './services/radarService.js';

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
      if (request.method === 'GET' && requestUrl.pathname === '/health') {
        sendJson(response, 200, {
          ok: true,
          service: 'cbofertas-v6-api',
          version: config.version,
          timestamp: new Date().toISOString(),
          mercadoLivreTokenConfigured: Boolean(config.mercadoLivreToken),
        }, origin);
        return;
      }

      if (request.method === 'POST' && requestUrl.pathname === '/v1/products/resolve') {
        const body = await readJson(request);
        const product = await resolveProduct(body.url);
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
