import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateTotal, normalizeEmail } from '../src/domain.js';

test('calcula o total de um pedido', () => {
  assert.equal(
    calculateTotal([
      { price: 5, quantity: 2 },
      { price: 3.5, quantity: 1 },
    ]),
    13.5,
  );
});

test('rejeita pedido sem itens', () => {
  assert.throws(() => calculateTotal([]), /pelo menos um produto/);
});

test('rejeita quantidade inválida', () => {
  assert.throws(() => calculateTotal([{ price: 5, quantity: 0 }]), /inválida/);
});

test('normaliza e-mail', () => {
  assert.equal(normalizeEmail('  ALUNO@EXEMPLO.COM '), 'aluno@exemplo.com');
});
