'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  extractPriceCandidates,
  moneyFromAriaLabel,
  extractPrimaryImage
} = require('../src/services/productService');
const { normalizeRadarItem } = require('../src/services/radarService');
const {
  itemIdFrom,
  localizedNumber,
  money
} = require('../src/lib/format');

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

function visibleText(html) {
  return String(html)
    .replace(/<script\b[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style\b[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

test('lê reais e centavos em aria-label brasileiro', () => {
  assert.equal(moneyFromAriaLabel('1.248 reais com 75 centavos'), '1248,75');
  assert.equal(moneyFromAriaLabel('475 reais com 96 centavos'), '475,96');
});

test('preço promocional visual vence preço regular da API', () => {
  const result = extractPriceCandidates(chairHtml, `${visibleText(chairHtml)} 61% OFF`, '1248,75');
  assert.equal(result.price, '475,96');
  assert.equal(result.oldPrice, '1248,75');
  assert.equal(result.pageDetected, true);
});

test('não confunde parcela nem cashback com preço final', () => {
  const text = `${visibleText(chairHtml)} 61% OFF 10x R$ 47,60 R$ 30 de cashback`;
  const result = extractPriceCandidates(chairHtml, text, '1248,75');
  assert.equal(result.price, '475,96');
  assert.notEqual(result.price, '47,60');
  assert.notEqual(result.price, '30,00');
});

test('captura preço visível mesmo sem API', () => {
  const html = '<main><div class="ui-pdp-price__main-container"><span class="andes-money-amount" aria-label="79 reais com 90 centavos"></span></div></main>';
  const result = extractPriceCandidates(html, visibleText(html), '');
  assert.equal(result.price, '79,90');
});

test('wid do anúncio vence o código de catálogo', () => {
  const link = 'https://www.mercadolivre.com.br/produto/p/MLB55027309#position=1&wid=MLB4812130742';
  assert.equal(itemIdFrom(link), 'MLB4812130742');
});

test('Radar preserva o preço promocional e o preço antigo', () => {
  const item = normalizeRadarItem({
    id: 'MLB4812130742',
    title: 'Cadeira Presidente Python',
    price: '475,96',
    oldPrice: '1.248,75',
    link: 'https://produto.mercadolivre.com.br/MLB-4812130742'
  });
  assert.equal(item.price, '475,96');
  assert.equal(item.oldPrice, '1248,75');
  assert.equal(item.discount, 62);
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

test('conversor brasileiro mantém milhares e centavos', () => {
  assert.equal(localizedNumber('2.500'), 2500);
  assert.equal(localizedNumber('1.248,75'), 1248.75);
  assert.equal(localizedNumber('475,96'), 475.96);
  assert.equal(money('2.500'), '2500,00');
});

test('Galaxy A17 mantém preço atual, original e identificação do wid', () => {
  const link = 'https://www.mercadolivre.com.br/celular-samsung-galaxy-a17/p/MLB55027309#position=1&wid=MLB1234567890';
  const item = normalizeRadarItem({
    id: itemIdFrom(link),
    title: 'Celular Samsung Galaxy A17 5G',
    price: '806,65',
    oldPrice: '1.855,71',
    link
  });
  assert.equal(item.id, 'MLB1234567890');
  assert.equal(item.price, '806,65');
  assert.equal(item.oldPrice, '1855,71');
  assert.equal(item.discount, 57);
});

test('link de catálogo sem wid não se transforma em anúncio diferente', () => {
  const catalog = 'https://www.mercadolivre.com.br/produto/p/MLB55027309';
  assert.equal(itemIdFrom(catalog), 'MLB55027309');
  const selected = `${catalog}#position=1&wid=MLB4812130742`;
  assert.equal(itemIdFrom(selected), 'MLB4812130742');
});


test('imagem principal usa og:image do HTML real do Mercado Livre', () => {
  const html = '<meta property="og:image" content="https://http2.mlstatic.com/D_NQ_NP_682372-MLA103217659554_012026-O.webp">';
  assert.equal(extractPrimaryImage(html, '', ''), 'https://http2.mlstatic.com/D_NQ_NP_682372-MLA103217659554_012026-O.webp');
});

test('imagem principal monta URL a partir de pictures.id', () => {
  const html = '{"pictures":{"pictures":[{"id":"682372-MLA103217659554_012026"}]}}';
  assert.equal(extractPrimaryImage(html, '', ''), 'https://http2.mlstatic.com/D_NQ_NP_682372-MLA103217659554_012026-O.webp');
});
