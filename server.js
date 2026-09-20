require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const { writeJSON } = require('./lib/db');

const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');

const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET;

if (!SESSION_SECRET) {
  console.error('Defina SESSION_SECRET no arquivo .env antes de iniciar o servidor.');
  process.exit(1);
}

// Auto-create admin if it doesn't exist
const adminFile = path.join(__dirname, 'data', 'admin.json');
if (!fs.existsSync(adminFile)) {
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@braco.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
  
  if (adminPassword.length < 6) {
    console.error('A senha precisa ter pelo menos 6 caracteres.');
    process.exit(1);
  }
  
  // Ensure data directory exists
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  
  const passwordHash = bcrypt.hashSync(adminPassword, 10);
  writeJSON('admin', { email: adminEmail.toLowerCase().trim(), passwordHash });
  
  console.log(`✓ Conta admin criada/atualizada para: ${adminEmail}`);
}

const app = express();
app.set('trust proxy', 'loopback'); // atrás do Nginx local, para o req.ip do bloqueio de login funcionar certo

app.use(express.json());
app.use(
  cookieSession({
    name: 'vallerini_session',
    keys: [SESSION_SECRET],
    maxAge: 12 * 60 * 60 * 1000, // 12 horas
    httpOnly: true,
    sameSite: 'lax',
    // Só ative COOKIE_SECURE=true no .env depois de configurar HTTPS (domínio + certificado).
    // Com HTTPS ainda não configurado, um cookie "secure" nunca seria enviado pelo navegador e o login quebraria.
    secure: process.env.COOKIE_SECURE === 'true',
  })
);

app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.static(__dirname, { index: 'index.html', etag: false, lastModified: false, cacheControl: false, setHeaders: res => res.set('Cache-Control', 'no-store') }));

app.use('/api', publicRoutes);
app.use('/admin-api', adminRoutes);

app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Erro interno no servidor.' });
});

app.listen(PORT, () => {
  console.log(`Elétrica Vallerini rodando em http://localhost:${PORT}`);
  console.log(`Painel admin em http://localhost:${PORT}/admin.html`);
});

