import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveMercadoLivreProduct } from '../src/providers/mercadolivre/provider.js';

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

test('catálogo usa o MLB vencedor e não mistura preço de contexto especial', async (t) => {
  const originalFetch = globalThis.fetch;
  t.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async (input) => {
    const url = new URL(String(input));
    if (url.pathname === '/products/MLB45678901') {
      return jsonResponse({
        id: 'MLB45678901',
        name: 'Kit 5 Toalhas',
        buy_box_winner: {
          item_id: 'MLB4812130742',
          price: 142.39,
          currency_id: 'BRL',
          seller_id: 987,
          shipping: { free_shipping: true, logistic_type: 'fulfillment' },
        },
      });
    }
    if (url.pathname === '/items/MLB4812130742') {
      return jsonResponse({
        id: 'MLB4812130742',
        title: 'Kit 5 Toalhas Banho Gigante Grossa Hotel Luxo',
        seller_id: 987,
        price: 185.29,
        currency_id: 'BRL',
        permalink: 'https://produto.mercadolivre.com.br/MLB-4812130742',
        thumbnail: 'https://example.test/toalhas.jpg',
        pictures: [{ secure_url: 'https://example.test/toalhas.jpg' }],
        shipping: { free_shipping: true, logistic_type: 'fulfillment' },
        status: 'active',
        available_quantity: 20,
      });
    }
    if (url.pathname === '/items/MLB4812130742/sale_price') {
      return jsonResponse({ amount: 142.39, regular_amount: 185.29, currency_id: 'BRL' });
    }
    if (url.pathname === '/items/MLB4812130742/prices') {
      return jsonResponse({ prices: [
        {
          type: 'promotion', amount: 15.74, regular_amount: 78.99, currency_id: 'BRL',
          conditions: { context_restrictions: ['buyer_loyalty'], min_purchase_unit: 1 },
        },
        {
          type: 'promotion', amount: 142.39, regular_amount: 185.29, currency_id: 'BRL',
          conditions: { context_restrictions: ['channel_marketplace'], min_purchase_unit: 1 },
        },
      ] });
    }
    if (url.pathname === '/users/987') return jsonResponse({ id: 987, nickname: 'LOJA TESTE' });
    return jsonResponse({ message: 'not found' }, 404);
  };

  const product = await resolveMercadoLivreProduct('https://www.mercadolivre.com.br/kit-toalhas/p/MLB45678901');
  assert.equal(product.catalogProductId, 'MLB45678901');
  assert.equal(product.itemId, 'MLB4812130742');
  assert.equal(product.price.current.amount, 142.39);
  assert.equal(product.price.original.amount, 185.29);
  assert.equal(product.price.discountPercent, 23);
  assert.notEqual(product.price.current.amount, 15.74);
  assert.equal(product.seller.nickname, 'LOJA TESTE');
  assert.equal(product.shipping.free, true);
});
