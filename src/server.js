import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { pool } from './db.js';
import { createApp } from './app.js';

const app = createApp(pool);
const port = Number(process.env.PORT || 3000);

async function start() {
  const adminEmail = (process.env.ADMIN_EMAIL || 'admin@estulanches.local').toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || 'Admin123!';
  const hash = await bcrypt.hash(adminPassword, 12);
  await pool.query(
    `INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, 'admin')
     ON CONFLICT (email) DO NOTHING`,
    [process.env.ADMIN_NAME || 'Administrador', adminEmail, hash]
  );
  app.listen(port, '0.0.0.0', () => console.log(`EstuLanches disponível na porta ${port}`));
}

start().catch(error => {
  console.error('Falha ao iniciar a aplicação:', error);
  process.exit(1);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});
