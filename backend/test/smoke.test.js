'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createServer } = require('../src/app');
const { productFromUrl } = require('../src/services/productService');
const { normalizeRadarItem } = require('../src/services/radarService');
const { localizedNumber, money } = require('../src/lib/format');

async function withServer(callback) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    return await callback(server.address().port);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('health informa versão e recursos da V5.2.1', async () => {
  await withServer(async port => {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    assert.equal(response.status, 200);
    const data = await response.json();
    assert.equal(data.version, '5.2.1');
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

test('conversor brasileiro preserva separador de milhares', () => {
  assert.equal(localizedNumber('2.500'), 2500);
  assert.equal(localizedNumber('1.500'), 1500);
  assert.equal(localizedNumber('1.499,90'), 1499.9);
  assert.equal(localizedNumber('868,63'), 868.63);
  assert.equal(money('2.500'), '2500,00');
});

test('Radar não transforma milhares em centavos', () => {
  const item = normalizeRadarItem({
    title: 'Smart TV 43 polegadas',
    price: '2.500',
    oldPrice: '3.000',
    link: 'https://produto.mercadolivre.com.br/MLB-123456789'
  });
  assert.equal(item.price, '2500,00');
  assert.equal(item.oldPrice, '3000,00');
  assert.equal(item.discount, 17);
});



test('wid do anúncio vence o código de catálogo', () => {
  const { itemIdFrom } = require('../src/lib/format');
  const link = 'https://www.mercadolivre.com.br/produto/p/MLB25929487?pdp_filters=x#position=3&wid=MLB4812130742&sid=offers';
  assert.equal(itemIdFrom(link), 'MLB4812130742');
});

test('web app contém biblioteca automática de afiliados', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '../../android/app/src/main/assets/www/app.js'), 'utf8');
  assert.match(app, /AFFILIATE_LIBRARY_STORAGE_KEY/);
  assert.match(app, /saveAffiliateAssociation/);
  assert.match(app, /affiliateFor/);
});

test('resolvedor segue 302 e reaproveita cookie até o anúncio final', async () => {
  const { resolveProductLink } = require('../src/services/linkResolver');
  const calls = [];
  const fetcher = async (url, options) => {
    calls.push({ url, cookie: options.headers.cookie || '' });
    if (calls.length === 1) {
      return new Response('', {
        status: 302,
        headers: {
          location: 'https://www.mercadolivre.com.br/produto/p/MLB55027309',
          'set-cookie': 'ml-session=abc123; Path=/; HttpOnly'
        }
      });
    }
    assert.match(options.headers.cookie, /ml-session=abc123/);
    return new Response('<html><title>Produto</title></html>', { status: 200 });
  };
  const result = await resolveProductLink('https://meli.la/2ZY9J9V', 6, { fetcher });
  assert.equal(result.response.status, 200);
  assert.equal(result.finalUrl, 'https://www.mercadolivre.com.br/produto/p/MLB55027309');
  assert.equal(result.unresolvedRedirect, false);
  assert.equal(calls.length, 2);
});

test('produto usa API mesmo quando a página termina em 302', async () => {
  const product = await productFromUrl('https://meli.la/2ZY9J9V', {
    resolveProductLink: async () => ({
      response: { status: 302, ok: false },
      finalUrl: 'https://www.mercadolivre.com.br/celular/p/MLB55027309',
      html: '',
      hops: ['https://meli.la/2ZY9J9V'],
      unresolvedRedirect: true
    }),
    fetchCatalogProduct: async () => ({
      catalogProductId: 'MLB55027309',
      itemId: 'MLB4812130742',
      title: 'Celular Samsung Galaxy A17 5G',
      price: '949,00',
      oldPrice: '1855,71',
      permalink: 'https://www.mercadolivre.com.br/celular/p/MLB55027309'
    }),
    fetchApiItem: async () => ({
      id: 'MLB4812130742',
      catalogProductId: 'MLB55027309',
      title: 'Celular Samsung Galaxy A17 5G',
      price: '949,00',
      oldPrice: '1855,71',
      seller: 'LOJA TESTE',
      permalink: 'https://produto.mercadolivre.com.br/MLB-4812130742'
    }),
    fetchApiPrices: async () => ({ price: '806,65', oldPrice: '1855,71', source: 'sale_price' })
  });
  assert.equal(product.price, '806,65');
  assert.equal(product.oldPrice, '1855,71');
  assert.equal(product.id, 'MLB4812130742');
  assert.equal(product.catalogProductId, 'MLB55027309');
  assert.equal(product.permalink, 'https://meli.la/2ZY9J9V');
  assert.equal(product.source.pageStatus, 302);
});

test('web app preserva a oferta do Radar quando a validação ao vivo falha', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const app = fs.readFileSync(path.join(__dirname, '../../android/app/src/main/assets/www/app.js'), 'utf8');
  const fetchStart = app.indexOf('async function fetchProduct()');
  const tryStart = app.indexOf('  try {', fetchStart);
  const beforeTry = app.slice(fetchStart, tryStart);
  assert.doesNotMatch(beforeTry, /el\.title\.value\s*=\s*''/);
  assert.match(beforeTry, /Mantém os dados que vieram do Radar/);
});

test('Radar não exibe desconto quando preço atual e antigo são iguais', () => {
  const item = normalizeRadarItem({
    title: 'Celular em oferta',
    price: '1855,00',
    oldPrice: '1855,00',
    discount: 56,
    link: 'https://produto.mercadolivre.com.br/MLB-1234567890'
  });
  assert.equal(item.oldPrice, '');
  assert.equal(item.discount, 0);
  assert.equal(item.reportedDiscount, 56);
});

test('resolvedor aceita 302 com redirecionamento dentro do HTML', async () => {
  const { resolveProductLink } = require('../src/services/linkResolver');
  let count = 0;
  const fetcher = async () => {
    count += 1;
    if (count === 1) {
      return new Response('<meta http-equiv="refresh" content="0;url=https://produto.mercadolivre.com.br/MLB-4812130742">', { status: 302 });
    }
    return new Response('<html><body>Produto final</body></html>', { status: 200 });
  };
  const result = await resolveProductLink('https://meli.la/2ZY9J9V', 5, { fetcher });
  assert.equal(result.response.status, 200);
  assert.equal(result.finalUrl, 'https://produto.mercadolivre.com.br/MLB-4812130742');
});
