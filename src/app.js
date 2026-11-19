import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { calculateTotal, normalizeEmail } from './domain.js';

export function createApp(pool) {
  const app = express();
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  app.use(express.static('public'));

  const secret = process.env.JWT_SECRET || 'development-only-secret';
  const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);

  function authenticate(req, res, next) {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    if (!token) return res.status(401).json({ error: 'Autenticação necessária.' });
    try {
      req.user = jwt.verify(token, secret);
      next();
    } catch {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }
  }

  function adminOnly(req, res, next) {
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Acesso restrito ao administrador.' });
    next();
  }

  app.get('/api/health', asyncRoute(async (_req, res) => {
    await pool.query('SELECT 1');
    res.json({ status: 'ok', database: 'connected' });
  }));

  app.post('/api/auth/register', asyncRoute(async (req, res) => {
    const { name, email, password } = req.body;
    const normalizedEmail = normalizeEmail(email);
    if (!name?.trim() || !/^\S+@\S+\.\S+$/.test(normalizedEmail) || typeof password !== 'string' || password.length < 8) {
      return res.status(400).json({ error: 'Informe nome, e-mail válido e senha com pelo menos 8 caracteres.' });
    }
    const hash = await bcrypt.hash(password, 12);
    try {
      const result = await pool.query(
        'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email, role',
        [name.trim(), normalizedEmail, hash]
      );
      res.status(201).json({ user: result.rows[0] });
    } catch (error) {
      if (error.code === '23505') return res.status(409).json({ error: 'Este e-mail já está cadastrado.' });
      throw error;
    }
  }));

  app.post('/api/auth/login', asyncRoute(async (req, res) => {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || typeof password !== 'string' || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
    }
    const token = jwt.sign({ id: user.id, name: user.name, role: user.role }, secret, { expiresIn: '8h' });
    res.json({ token, user: { id: user.id, name: user.name, email: user.email, role: user.role } });
  }));

  app.get('/api/products', asyncRoute(async (_req, res) => {
    const result = await pool.query('SELECT id, name, description, price, available FROM products WHERE available = TRUE ORDER BY name');
    res.json(result.rows);
  }));

  app.post('/api/products', authenticate, adminOnly, asyncRoute(async (req, res) => {
    const { name, description = '', price } = req.body;
    const numericPrice = Number(price);
    if (!name?.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) {
      return res.status(400).json({ error: 'Informe nome e preço válido.' });
    }
    const result = await pool.query(
      'INSERT INTO products (name, description, price) VALUES ($1, $2, $3) RETURNING *',
      [name.trim(), description, numericPrice]
    );
    res.status(201).json(result.rows[0]);
  }));

  app.put('/api/products/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
    const { name, description = '', price, available = true } = req.body;
    const numericPrice = Number(price);
    if (!name?.trim() || !Number.isFinite(numericPrice) || numericPrice < 0) return res.status(400).json({ error: 'Dados inválidos.' });
    const result = await pool.query(
      'UPDATE products SET name=$1, description=$2, price=$3, available=$4 WHERE id=$5 RETURNING *',
      [name.trim(), description, numericPrice, Boolean(available), req.params.id]
    );
    if (!result.rowCount) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.json(result.rows[0]);
  }));

  app.delete('/api/products/:id', authenticate, adminOnly, asyncRoute(async (req, res) => {
    const result = await pool.query('UPDATE products SET available=FALSE WHERE id=$1 RETURNING id', [req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Produto não encontrado.' });
    res.status(204).end();
  }));

  app.post('/api/orders', authenticate, asyncRoute(async (req, res) => {
    const items = req.body.items;
    if (!Array.isArray(items) || items.length === 0 || items.length > 30) return res.status(400).json({ error: 'Informe de 1 a 30 itens.' });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const ids = [...new Set(items.map(item => Number(item.productId)))];
      if (ids.some(id => !Number.isInteger(id) || id < 1)) throw Object.assign(new Error('Produto inválido.'), { status: 400 });
      const products = await client.query('SELECT id, name, price FROM products WHERE available=TRUE AND id = ANY($1::int[])', [ids]);
      if (products.rows.length !== ids.length) throw Object.assign(new Error('Um ou mais produtos não estão disponíveis.'), { status: 400 });
      const byId = new Map(products.rows.map(product => [product.id, product]));
      const normalized = items.map(item => ({ product: byId.get(Number(item.productId)), quantity: Number(item.quantity) }));
      const total = calculateTotal(normalized.map(item => ({ price: item.product.price, quantity: item.quantity })));
      const order = await client.query('INSERT INTO orders (user_id, total) VALUES ($1, $2) RETURNING *', [req.user.id, total]);
      for (const item of normalized) {
        await client.query(
          'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES ($1, $2, $3, $4)',
          [order.rows[0].id, item.product.id, item.quantity, item.product.price]
        );
      }
      await client.query('COMMIT');
      res.status(201).json({ ...order.rows[0], items: normalized.map(item => ({ product: item.product.name, quantity: item.quantity })) });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }));

  app.get('/api/orders', authenticate, asyncRoute(async (req, res) => {
    const isAdmin = req.user.role === 'admin';
    const result = await pool.query(
      `SELECT o.id, o.status, o.total, o.created_at, u.name AS customer,
       COALESCE(json_agg(json_build_object('product', p.name, 'quantity', oi.quantity, 'unitPrice', oi.unit_price))
       FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
       FROM orders o JOIN users u ON u.id=o.user_id
       LEFT JOIN order_items oi ON oi.order_id=o.id LEFT JOIN products p ON p.id=oi.product_id
       ${isAdmin ? '' : 'WHERE o.user_id=$1'}
       GROUP BY o.id, u.name ORDER BY o.created_at DESC`,
      isAdmin ? [] : [req.user.id]
    );
    res.json(result.rows);
  }));

  app.patch('/api/orders/:id/status', authenticate, adminOnly, asyncRoute(async (req, res) => {
    const allowed = ['RECEBIDO', 'EM_PREPARACAO', 'PRONTO', 'CANCELADO'];
    if (!allowed.includes(req.body.status)) return res.status(400).json({ error: 'Status inválido.' });
    const result = await pool.query('UPDATE orders SET status=$1 WHERE id=$2 RETURNING *', [req.body.status, req.params.id]);
    if (!result.rowCount) return res.status(404).json({ error: 'Pedido não encontrado.' });
    res.json(result.rows[0]);
  }));

  app.use((req, res) => res.status(404).json({ error: 'Rota não encontrada.' }));
  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(error.status || 500).json({ error: error.status ? error.message : 'Erro interno do servidor.' });
  });

  return app;
}
