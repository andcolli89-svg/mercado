import test from 'node:test';
import assert from 'node:assert/strict';
import { extractLabeledVisiblePrices, extractStructuredProduct } from '../src/providers/mercadolivre/htmlExtractor.js';
import { selectPriceModel } from '../src/core/priceModel.js';

test('extrai JSON-LD do produto sem usar cashback como preço', () => {
  const html = `
    <meta property="og:title" content="Kit 5 Toalhas">
    <meta property="og:image" content="https://example.test/toalhas.jpg">
    <script type="application/ld+json">
      {"@type":"Product","name":"Kit 5 Toalhas","sku":"MLB1234567890","offers":{"@type":"Offer","price":"142.39","priceCurrency":"BRL"}}
    </script>
    <div>R$ 427,00 de cashback em Meli Dólar</div>
    <div>12x R$ 14,07 com cartão Mercado Pago</div>
    <div>Preço por quilo: R$ 60,59</div>
  `;

  const structured = extractStructuredProduct(html, 'MLB1234567890');
  const visible = extractLabeledVisiblePrices(html, 'MLB1234567890');
  const model = selectPriceModel([...structured.candidates, ...visible], { expectedItemId: 'MLB1234567890' });

  assert.equal(structured.title, 'Kit 5 Toalhas');
  assert.equal(model.current.amount, 142.39);
  assert.equal(model.cashback.amount, 427);
  assert.equal(model.installment.amount, 14.07);
  assert.equal(model.unit.amount, 60.59);
});

test('reconhece preço rotulado no Pix quando não há JSON-LD', () => {
  const html = '<div>OFERTA IMPERDÍVEL</div><div>R$ 806,65 no Pix</div><div>R$ 975,00 de cashback</div>';
  const candidates = extractLabeledVisiblePrices(html, 'MLB123');
  const model = selectPriceModel(candidates, { expectedItemId: 'MLB123' });
  assert.equal(model.current.amount, 806.65);
});

test('par de preço riscado e promocional mantém a ordem correta', () => {
  const html = `
    <div>OFERTA DO DIA</div>
    <span>R$ 185,29</span>
    <strong>R$ 142,39</strong>
    <span>23% OFF</span>
    <div>12x R$ 14,07</div>
    <div>Preço por quilo: R$ 60,59</div>
    <div>R$ 427 de cashback em Meli Dólar</div>
  `;
  const candidates = extractLabeledVisiblePrices(html, 'MLB1234567890');
  const model = selectPriceModel(candidates, { expectedItemId: 'MLB1234567890' });
  assert.equal(model.current.amount, 142.39);
  assert.equal(model.original.amount, 185.29);
  assert.equal(model.discountPercent, 23);
  assert.equal(model.installment.amount, 14.07);
  assert.equal(model.unit.amount, 60.59);
  assert.equal(model.cashback.amount, 427);
});

test('preço original nunca vira atual só por vir depois de Oferta do Dia', () => {
  const html = '<div>OFERTA DO DIA R$ 185,29 R$ 142,39 23% OFF</div>';
  const candidates = extractLabeledVisiblePrices(html, 'MLB1234567890');
  const model = selectPriceModel(candidates, { expectedItemId: 'MLB1234567890' });
  assert.equal(model.current.amount, 142.39);
  assert.notEqual(model.current.amount, 185.29);
});
