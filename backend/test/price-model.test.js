import test from 'node:test';
import assert from 'node:assert/strict';
import { priceCandidate, selectPriceModel } from '../src/core/priceModel.js';

function c(amount, kind, source = 'visible_labeled_price', extra = {}) {
  return priceCandidate({ amount, kind, source, confidence: extra.confidence ?? 0.9, itemId: 'MLB123', ...extra });
}

test('Galaxy A17: escolhe preço Pix e ignora cashback e parcela', () => {
  const model = selectPriceModel([
    c(1855.71, 'original', 'sale_price_api', { confidence: 0.99 }),
    c(806.65, 'current', 'sale_price_api', { confidence: 0.99 }),
    c(63.27, 'installment', 'visible_labeled_price', { label: '15x R$ 63,27' }),
    c(975, 'cashback', 'visible_labeled_price', { label: 'R$ 975 de cashback em Meli Dólar' }),
  ], { expectedItemId: 'MLB123' });

  assert.equal(model.current.amount, 806.65);
  assert.equal(model.original.amount, 1855.71);
  assert.equal(model.discountPercent, 56);
  assert.equal(model.cashback.amount, 975);
  assert.equal(model.installment.amount, 63.27);
  assert.equal(model.confirmed, true);
});

test('Toalhas: preço promocional 142,39 e original 185,29', () => {
  const model = selectPriceModel([
    c(142.39, 'current', 'sale_price_api', { confidence: 0.99 }),
    c(185.29, 'original', 'sale_price_api', { confidence: 0.99 }),
    c(14.07, 'installment', 'visible_labeled_price', { label: '12x R$ 14,07' }),
    c(427, 'cashback', 'visible_labeled_price', { label: 'R$ 427 de cashback' }),
    c(60.59, 'unit', 'visible_labeled_price', { label: 'Preço por quilo R$ 60,59' }),
  ], { expectedItemId: 'MLB123' });

  assert.equal(model.current.amount, 142.39);
  assert.equal(model.original.amount, 185.29);
  assert.equal(model.discountPercent, 23);
  assert.equal(model.savings, 42.9);
});

test('Cadeira Python: preserva centavos e preço original', () => {
  const model = selectPriceModel([
    c(475.96, 'current', 'sale_price_api', { confidence: 0.99 }),
    c(1248.75, 'original', 'sale_price_api', { confidence: 0.99 }),
    c(1248, 'current', 'item_api', { confidence: 0.75 }),
  ], { expectedItemId: 'MLB123' });

  assert.equal(model.current.amount, 475.96);
  assert.equal(model.original.amount, 1248.75);
  assert.equal(model.discountPercent, 61);
});

test('não mistura candidatos de MLB diferente', () => {
  const model = selectPriceModel([
    c(142.39, 'current', 'sale_price_api', { confidence: 0.99, itemId: 'MLB123' }),
    c(15.74, 'current', 'sale_price_api', { confidence: 0.99, itemId: 'MLB999' }),
    c(185.29, 'original', 'sale_price_api', { confidence: 0.99, itemId: 'MLB123' }),
  ], { expectedItemId: 'MLB123' });

  assert.equal(model.current.amount, 142.39);
  assert.equal(model.original.amount, 185.29);
});

test('não confirma somente cashback ou parcela', () => {
  const model = selectPriceModel([
    c(427, 'cashback', 'visible_labeled_price', { label: 'cashback' }),
    c(14.07, 'installment', 'visible_labeled_price', { label: '12x R$ 14,07' }),
  ], { expectedItemId: 'MLB123' });

  assert.equal(model.confirmed, false);
  assert.equal(model.current, null);
});
