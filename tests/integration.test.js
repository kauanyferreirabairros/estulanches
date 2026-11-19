import 'dotenv/config';
import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../src/db.js';
import { createApp } from '../src/app.js';

let server;
let baseUrl;
let token;
let productId;
const secret = process.env.JWT_SECRET || 'development-only-secret';

before(async () => {
  await pool.query('SELECT 1');
  const hash = await bcrypt.hash('SenhaTeste123', 4);
  const user = await pool.query(
    `INSERT INTO users (name,email,password_hash,role) VALUES ('Teste integração','teste-integracao@estulanches.local',$1,'student')
     ON CONFLICT (email) DO UPDATE SET password_hash=EXCLUDED.password_hash RETURNING id`, [hash]
  );
  token = jwt.sign({ id: user.rows[0].id, name: 'Teste integração', role: 'student' }, secret);
  const product = await pool.query("INSERT INTO products (name,description,price) VALUES ('Produto teste integração','Teste',2.50) RETURNING id");
  productId = product.rows[0].id;
  const app = createApp(pool);
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise(resolve => server.close(resolve));
  }

  try {
    if (productId) {
      await pool.query('DELETE FROM products WHERE id=$1', [productId]);
    }

    await pool.query(
      "DELETE FROM users WHERE email='teste-integracao@estulanches.local'"
    );
  } finally {
    await pool.end();
  }
});

test('API lista produtos disponíveis', async () => {
  const response = await fetch(`${baseUrl}/api/products`);
  assert.equal(response.status, 200);
  const products = await response.json();
  assert.ok(products.some(product => product.id === productId));
});

test('API cria pedido e persiste no banco', async () => {
  const response = await fetch(`${baseUrl}/api/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ items: [{ productId, quantity: 2 }] })
  });
  assert.equal(response.status, 201);
  const order = await response.json();
  assert.equal(Number(order.total), 5);
  const stored = await pool.query('SELECT id FROM orders WHERE id=$1', [order.id]);
  assert.equal(stored.rowCount, 1);
  await pool.query('DELETE FROM orders WHERE id=$1', [order.id]);
});
