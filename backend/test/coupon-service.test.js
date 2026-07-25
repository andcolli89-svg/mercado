import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateCoupons } from '../src/services/couponService.js';

const product = {
  platform: 'mercado_livre',
  title: 'Creatina Monohidratada 500g',
  itemId: 'MLB123',
  price: { current: { amount: 100 } },
};

test('cupons inteligentes escolhem maior economia compatível', () => {
  const result = evaluateCoupons(product, [
    { code: 'FIXO10', type: 'fixed', value: 10, minimumSpend: 80, keywords: ['creatina'] },
    { code: 'PCT20', type: 'percent', value: 20, maxDiscount: 15, keywords: ['creatina'] },
    { code: 'CELULAR', type: 'fixed', value: 50, keywords: ['celular'] },
  ]);
  assert.equal(result.best.code, 'PCT20');
  assert.equal(result.best.estimatedDiscount, 15);
  assert.equal(result.best.estimatedPrice, 85);
  assert.equal(result.compatible.length, 2);
});

test('cupom confirmado fica identificado separadamente de sugestão', () => {
  const result = evaluateCoupons(product, [
    { code: 'CONFIRMA', type: 'fixed', value: 5, confirmed: true },
  ]);
  assert.equal(result.best.confirmation, 'confirmed');
});
