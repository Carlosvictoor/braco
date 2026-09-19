const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const { readJSON, writeJSON, nextId } = require('../lib/db');
const requireAuth = require('../middleware/requireAuth');

const router = express.Router();

const UPLOAD_DIR = path.join(__dirname, '..', 'uploads', 'portfolio');
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      return cb(new Error('Formato de imagem não suportado. Use JPG, PNG, WEBP ou GIF.'));
    }
    cb(null, true);
  },
});

// ---- Login com bloqueio progressivo simples ----
const loginAttempts = new Map(); // ip -> { count, blockedUntil }

function isBlocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry) return false;
  if (entry.blockedUntil && entry.blockedUntil > Date.now()) return true;
  return false;
}

function registerFailure(ip) {
  const entry = loginAttempts.get(ip) || { count: 0, blockedUntil: 0 };
  entry.count += 1;
  if (entry.count >= 5) {
    entry.blockedUntil = Date.now() + 60_000 * Math.min(entry.count - 4, 10);
  }
  loginAttempts.set(ip, entry);
}

function clearFailures(ip) {
  loginAttempts.delete(ip);
}

router.post('/login', (req, res) => {
  const ip = req.ip;
  if (isBlocked(ip)) {
    return res.status(429).json({ error: 'Muitas tentativas. Aguarde um minuto e tente novamente.' });
  }

  const { email, senha } = req.body || {};
  const admin = readJSON('admin', null);

  if (!admin || !email || !senha) {
    registerFailure(ip);
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  const emailOk = email.trim().toLowerCase() === admin.email;
  const senhaOk = emailOk && bcrypt.compareSync(senha, admin.passwordHash);

  if (!emailOk || !senhaOk) {
    registerFailure(ip);
    return res.status(401).json({ error: 'Credenciais inválidas.' });
  }

  clearFailures(ip);
  req.session.adminEmail = admin.email;
  res.json({ ok: true, email: admin.email });
});

router.post('/logout', (req, res) => {
  req.session = null;
  res.json({ ok: true });
});

router.get('/session', (req, res) => {
  if (req.session && req.session.adminEmail) {
    return res.json({ authenticated: true, email: req.session.adminEmail });
  }
  res.json({ authenticated: false });
});

router.post('/change-password', requireAuth, (req, res) => {
  const { senhaAtual, novaSenha } = req.body || {};
  const admin = readJSON('admin', null);

  if (!admin || !senhaAtual || !novaSenha) {
    return res.status(400).json({ error: 'Preencha a senha atual e a nova senha.' });
  }
  if (!bcrypt.compareSync(senhaAtual, admin.passwordHash)) {
    return res.status(401).json({ error: 'Senha atual incorreta.' });
  }
  if (novaSenha.length < 6) {
    return res.status(400).json({ error: 'A nova senha precisa ter pelo menos 6 caracteres.' });
  }

  admin.passwordHash = bcrypt.hashSync(novaSenha, 10);
  writeJSON('admin', admin);
  res.json({ ok: true });
});

// ---- Mensagens ----
router.get('/messages', requireAuth, (req, res) => {
  const messages = readJSON('messages', []).slice().sort((a, b) => b.id - a.id);
  res.json(messages);
});

router.patch('/messages/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const messages = readJSON('messages', []);
  const msg = messages.find(m => m.id === id);
  if (!msg) return res.status(404).json({ error: 'Mensagem não encontrada.' });
  if (typeof req.body?.lida === 'boolean') msg.lida = req.body.lida;
  writeJSON('messages', messages);
  res.json(msg);
});

router.delete('/messages/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const messages = readJSON('messages', []);
  const filtered = messages.filter(m => m.id !== id);
  writeJSON('messages', filtered);
  res.json({ ok: true });
});

// ---- Portfólio ----
router.get('/portfolio', requireAuth, (req, res) => {
  const items = readJSON('portfolio', [])
    .slice()
    .sort((a, b) => b.id - a.id)
    .map(item => ({ ...item, url: `/uploads/portfolio/${item.arquivo}` }));
  res.json(items);
});

router.post('/portfolio', requireAuth, (req, res) => {
  upload.single('foto')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'Envie um arquivo de imagem.' });

    const items = readJSON('portfolio', []);
    const item = {
      id: nextId(items),
      arquivo: req.file.filename,
      legenda: (req.body.legenda || '').trim().slice(0, 200),
      criadoEm: new Date().toISOString(),
    };
    items.push(item);
    writeJSON('portfolio', items);
    res.status(201).json({ ...item, url: `/uploads/portfolio/${item.arquivo}` });
  });
});

router.put('/portfolio/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const items = readJSON('portfolio', []);
  const item = items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Foto não encontrada.' });
  if (typeof req.body?.legenda === 'string') item.legenda = req.body.legenda.trim().slice(0, 200);
  writeJSON('portfolio', items);
  res.json(item);
});

router.delete('/portfolio/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const items = readJSON('portfolio', []);
  const item = items.find(i => i.id === id);
  if (item) {
    const filePath = path.join(UPLOAD_DIR, item.arquivo);
    fs.unlink(filePath, () => {});
  }
  const filtered = items.filter(i => i.id !== id);
  writeJSON('portfolio', filtered);
  res.json({ ok: true });
});

// ---- Depoimentos ----
router.get('/testimonials', requireAuth, (req, res) => {
  const items = readJSON('testimonials', []).slice().sort((a, b) => b.id - a.id);
  res.json(items);
});

router.post('/testimonials', requireAuth, (req, res) => {
  const { nome, texto, nota } = req.body || {};
  if (!nome || !nome.trim() || !texto || !texto.trim()) {
    return res.status(400).json({ error: 'Preencha nome e texto do depoimento.' });
  }
  const notaNum = Math.min(5, Math.max(1, Number(nota) || 5));

  const items = readJSON('testimonials', []);
  const item = {
    id: nextId(items),
    nome: nome.trim().slice(0, 120),
    texto: texto.trim().slice(0, 600),
    nota: notaNum,
    published: true,
    criadoEm: new Date().toISOString(),
  };
  items.push(item);
  writeJSON('testimonials', items);
  res.status(201).json(item);
});

router.put('/testimonials/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const items = readJSON('testimonials', []);
  const item = items.find(i => i.id === id);
  if (!item) return res.status(404).json({ error: 'Depoimento não encontrado.' });

  const { nome, texto, nota, published } = req.body || {};
  if (typeof nome === 'string') item.nome = nome.trim().slice(0, 120);
  if (typeof texto === 'string') item.texto = texto.trim().slice(0, 600);
  if (nota !== undefined) item.nota = Math.min(5, Math.max(1, Number(nota) || item.nota));
  if (typeof published === 'boolean') item.published = published;

  writeJSON('testimonials', items);
  res.json(item);
});

router.delete('/testimonials/:id', requireAuth, (req, res) => {
  const id = Number(req.params.id);
  const items = readJSON('testimonials', []);
  const filtered = items.filter(i => i.id !== id);
  writeJSON('testimonials', filtered);
  res.json({ ok: true });
});

// ---- Contato ----
router.get('/contact-info', requireAuth, (req, res) => {
  res.json(readJSON('contact-info', {}));
});

router.put('/contact-info', requireAuth, (req, res) => {
  const { whatsapp, telefone, cidade, regiao, instagram } = req.body || {};
  const current = readJSON('contact-info', {});
  const updated = {
    whatsapp: (whatsapp ?? current.whatsapp ?? '').toString().trim(),
    telefone: (telefone ?? current.telefone ?? '').toString().trim(),
    cidade: (cidade ?? current.cidade ?? '').toString().trim(),
    regiao: (regiao ?? current.regiao ?? '').toString().trim(),
    instagram: (instagram ?? current.instagram ?? '').toString().trim().replace(/^@/, ''),
  };
  writeJSON('contact-info', updated);
  res.json(updated);
});

module.exports = router;
