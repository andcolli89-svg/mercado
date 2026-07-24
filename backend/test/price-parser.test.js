'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseAriaMoney, parseMercadoLivrePrices } = require('../src/parsers/mercadoLivrePriceParser');
const { choosePriceSources } = require('../src/services/productService');
const { redirectFromHtml } = require('../src/services/linkResolver');
const { radarItemFromBlock } = require('../src/services/radarService');

const chairHtml = `
<html><body>
  <section class="ui-pdp-price__main-container">
    <s class="andes-money-amount ui-pdp-price__original-value" aria-label="1.248 reais com 75 centavos"></s>
    <div class="ui-pdp-price__second-line">
      <span class="andes-money-amount" aria-label="475 reais com 96 centavos"></span>
      <span>61% OFF</span>
    </div>
    <p>10x de R$ 47,60 sem juros</p>
    <p>Ganhe R$ 30 de cashback</p>
  </section>
</body></html>`;

test('lê reais e centavos em aria-label brasileiro', () => {
  assert.equal(parseAriaMoney('1.248 reais com 75 centavos'), 1248.75);
  assert.equal(parseAriaMoney('475 reais com 96 centavos'), 475.96);
});

test('preço promocional visual vence preço regular da API', () => {
  const result = choosePriceSources(chairHtml, { price: '1248,75' }, null, {});
  assert.equal(result.price, '475,96');
  assert.equal(result.oldPrice, '1248,75');
  assert.equal(result.pageDetected, true);
});

test('não confunde parcela nem cashback com preço final', () => {
  const result = parseMercadoLivrePrices(chairHtml, { apiPrice: '1248,75' });
  assert.equal(result.price, '475,96');
  assert.notEqual(result.price, '47,60');
  assert.notEqual(result.price, '30,00');
});

test('captura creatina com preço visível mesmo sem API', () => {
  const html = `<main><div class="ui-pdp-price__main-container"><span class="andes-money-amount" aria-label="79 reais com 90 centavos"></span></div></main>`;
  const result = parseMercadoLivrePrices(html, {});
  assert.equal(result.price, '79,90');
});

test('detecta redirecionamento HTML de link curto', () => {
  const html = '<meta http-equiv="refresh" content="0;url=https://produto.mercadolivre.com.br/MLB-4812130742">';
  assert.equal(redirectFromHtml(html, 'https://meli.la/2ZY9J9V'), 'https://produto.mercadolivre.com.br/MLB-4812130742');
});

test('Radar escolhe preço promocional no card', () => {
  const card = `<article class="poly-card">
    <a href="https://produto.mercadolivre.com.br/MLB-4812130742" title="Cadeira Presidente Python"></a>
    <s class="andes-money-amount ui-pdp-price__original-value" aria-label="1.248 reais com 75 centavos"></s>
    <span class="andes-money-amount" aria-label="475 reais com 96 centavos"></span>
    <span>61% OFF</span>
  </article>`;
  const item = radarItemFromBlock(card);
  assert.equal(item.price, '475,96');
  assert.equal(item.oldPrice, '1248,75');
  assert.equal(item.discount, 61);
});

test('Shopee converte preços internos de 1/100000 e mantém promoção', () => {
  const { parseShopeePrices } = require('../src/parsers/shopeePriceParser');
  const html = '<script>{"price":47596000,"price_before_discount":124875000}</script>';
  const result = parseShopeePrices(html);
  assert.equal(result.price, '475,96');
  assert.equal(result.oldPrice, '1248,75');
});

test('identifica produto da Shopee em URL direta', () => {
  const { shopeeItemIdFrom } = require('../src/lib/format');
  assert.equal(shopeeItemIdFrom('https://shopee.com.br/Cadeira-i.123456.987654321'), 'SHP123456_987654321');
});
