import test from 'node:test';
import assert from 'node:assert/strict';
import { runRadar } from '../src/services/radarService.js';

function response(payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { 'content-type': 'application/json' } });
}

test('Radar confirma os MLBs e ordena pelo desconto real', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/sites/MLB/search') {
      return response({ results: [{ id: 'MLB1111111111' }, { id: 'MLB2222222222' }] });
    }
    const itemMatch = url.pathname.match(/^\/items\/(MLB\d+)$/);
    if (itemMatch) {
      const id = itemMatch[1];
      return response({
        id,
        title: id === 'MLB1111111111' ? 'Produto 50 OFF' : 'Produto 20 OFF',
        seller_id: id === 'MLB1111111111' ? 11 : 22,
        price: 100,
        currency_id: 'BRL',
        permalink: `https://produto.mercadolivre.com.br/${id.replace('MLB', 'MLB-')}`,
        pictures: [],
        shipping: { free_shipping: false },
        status: 'active',
        available_quantity: 5,
      });
    }
    const saleMatch = url.pathname.match(/^\/items\/(MLB\d+)\/sale_price$/);
    if (saleMatch) {
      const amount = saleMatch[1] === 'MLB1111111111' ? 50 : 80;
      return response({ amount, regular_amount: 100, currency_id: 'BRL' });
    }
    if (/^\/items\/MLB\d+\/prices$/.test(url.pathname)) return response({ prices: [] });
    if (url.pathname === '/users/11') return response({ nickname: 'LOJA 11' });
    if (url.pathname === '/users/22') return response({ nickname: 'LOJA 22' });
    return response({}, 404);
  };

  const products = await runRadar('produto teste', 2);
  assert.equal(products.length, 2);
  assert.equal(products[0].itemId, 'MLB1111111111');
  assert.equal(products[0].price.current.amount, 50);
  assert.equal(products[0].price.discountPercent, 50);
  assert.equal(products[1].price.discountPercent, 20);
});

test('Radar usa busca pública quando API de pesquisa retorna 403', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/sites/MLB/search') {
      return response({ code: 'PA_UNAUTHORIZED_RESULT_FROM_POLICIES' }, 403);
    }
    if (url.hostname === 'lista.mercadolivre.com.br') {
      return new Response('<a href="https://produto.mercadolivre.com.br/MLB-3333333333-_JM">Oferta</a>', {
        status: 200,
        headers: { 'content-type': 'text/html' },
      });
    }
    if (url.hostname === 'produto.mercadolivre.com.br') {
      return new Response('', { status: 200, headers: { 'content-type': 'text/html' } });
    }
    if (url.pathname === '/items/MLB3333333333') {
      return response({
        id: 'MLB3333333333',
        title: 'Creatina teste',
        seller_id: 33,
        price: 100,
        currency_id: 'BRL',
        permalink: 'https://produto.mercadolivre.com.br/MLB-3333333333-_JM',
        pictures: [],
        shipping: { free_shipping: true },
        status: 'active',
        available_quantity: 5,
      });
    }
    if (url.pathname === '/items/MLB3333333333/sale_price') {
      return response({ amount: 70, regular_amount: 100, currency_id: 'BRL' });
    }
    if (url.pathname === '/items/MLB3333333333/prices') return response({ prices: [] });
    return response({}, 404);
  };

  const products = await runRadar('creatina', 4);
  assert.equal(products.length, 1);
  assert.equal(products[0].itemId, 'MLB3333333333');
  assert.equal(products[0].price.current.amount, 70);
});
