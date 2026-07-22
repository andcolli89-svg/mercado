'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/app');
const { productFromUrl } = require('../src/services/productService');
const { normalizeRadarItem } = require('../src/services/radarService');

async function withServer(callback) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(server.address().port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('health informa versão e recursos da V4.0', async () => {
  await withServer(async port => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.version, '4.0.1');
    assert.ok(data.features.includes('favoritos'));
  });
});

test('rotas desconhecidas retornam 404', async () => {
  await withServer(async port => {
    const response = await fetch(`http://127.0.0.1:${port}/nao-existe`);
    assert.equal(response.status, 404);
  });
});



test('rota de produto devolve erro amigável para host externo', async () => {
  await withServer(async port => {
    const response = await fetch(`http://127.0.0.1:${port}/api/product?url=${encodeURIComponent('https://example.com/produto')}`);
    assert.equal(response.status, 422);
    const data = await response.json();
    assert.match(data.error, /Mercado Livre|meli\.la/i);
    assert.doesNotMatch(data.error, /ALLOWED_HOST|ReferenceError/i);
  });
});

test('validação de produto rejeita host externo sem ReferenceError', async () => {
  await assert.rejects(
    productFromUrl('https://example.com/produto'),
    error => error instanceof Error
      && error.name !== 'ReferenceError'
      && /Mercado Livre|meli\.la/i.test(error.message)
  );
});

test('Radar calcula desconto e pontuação de uma oferta normalizada', () => {
  const item = normalizeRadarItem({
    id: 'MLB123',
    title: 'Kit musculação com halteres',
    price: 80,
    oldPrice: 100,
    link: 'https://produto.mercadolivre.com.br/MLB-123',
    full: true,
    freeShipping: true
  });
  assert.equal(item.discount, 20);
  assert.equal(item.category, 'fitness');
  assert.ok(item.score > 0);
});
