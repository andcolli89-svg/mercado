'use strict';

const http = require('node:http');
const { URL } = require('node:url');
const { json, send } = require('./lib/http');
const { productFromUrl } = require('./services/productService');
const { getRadarOffers } = require('./services/radarService');
const { proxyImage } = require('./services/imageService');

function createRequestHandler() {
  return async function requestHandler(req, res) {
    try {
      if (req.method === 'OPTIONS') return send(res, 204, '');
      if (req.method !== 'GET') return json(res, 405, { error: 'Método não permitido.' });

      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);

      if (url.pathname === '/' || url.pathname === '/health') {
        return json(res, 200, {
          status: 'ok',
          version: '5.2.0',
          app: 'CbOfertas',
          features: ['produto', 'shopee', 'radar', 'cupons-inteligentes', 'historico', 'favoritos', 'biblioteca-afiliados', 'frases-automaticas', 'preco-promocional-validado']
        });
      }

      if (url.pathname === '/api/radar') {
        const options = {
          query: url.searchParams.get('query') || '',
          category: url.searchParams.get('category') || '',
          minDiscount: url.searchParams.get('minDiscount') || '0',
          maxPrice: url.searchParams.get('maxPrice') || '0',
          onlyFull: url.searchParams.get('onlyFull') || '0',
          limit: url.searchParams.get('limit') || '24',
          refresh: url.searchParams.get('refresh') === '1'
        };
        return json(res, 200, await getRadarOffers(options));
      }

      if (url.pathname === '/api/product') {
        const source = url.searchParams.get('url');
        if (!source) return json(res, 400, { error: 'Informe o link do produto.' });
        return json(res, 200, await productFromUrl(source));
      }

      if (url.pathname === '/api/image') {
        const source = url.searchParams.get('url');
        if (!source) return send(res, 400, 'Informe a imagem.');
        return proxyImage(source, res);
      }

      return json(res, 404, { error: 'Rota não encontrada.' });
    } catch (error) {
      console.error(error);
      return json(res, 422, { error: error.message || 'Não foi possível concluir a consulta.' });
    }
  };
}

function createServer() {
  return http.createServer(createRequestHandler());
}

module.exports = { createServer, createRequestHandler };
