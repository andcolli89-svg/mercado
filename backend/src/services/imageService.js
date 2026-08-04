'use strict';

const { URL } = require('node:url');
const {
  ALLOWED_IMAGE_HOST: ALLOWED_HOST,
  BROWSER_HEADERS: HEADERS
} = require('../config');
const { fetchWithTimeout, send } = require('../lib/http');

async function proxyImage(source, res) {
  const imageUrl = new URL(source);
  if (!['http:', 'https:'].includes(imageUrl.protocol) || !ALLOWED_HOST.test(imageUrl.hostname)) return send(res, 403, 'Imagem não permitida');
  const response = await fetchWithTimeout(imageUrl.href, {
    headers: { ...HEADERS, referer: 'https://www.mercadolivre.com.br/', origin: 'https://www.mercadolivre.com.br' }
  });
  if (!response.ok) return send(res, response.status, 'Imagem indisponível');
  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const buffer = Buffer.from(await response.arrayBuffer());
  send(res, 200, buffer, { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=86400' });
}

module.exports = { proxyImage };
