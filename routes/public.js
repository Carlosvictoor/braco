const express = require('express');
const { readJSON, writeJSON, nextId } = require('../lib/db');

const router = express.Router();

router.get('/contact-info', (req, res) => {
  const info = readJSON('contact-info', {});
  res.json(info);
});

router.get('/portfolio', (req, res) => {
  const items = readJSON('portfolio', []);
  const withUrl = items
    .slice()
    .sort((a, b) => b.id - a.id)
    .map(item => ({ ...item, url: `/uploads/portfolio/${item.arquivo}` }));
  res.json(withUrl);
});

router.get('/testimonials', (req, res) => {
  const items = readJSON('testimonials', []);
  const published = items
    .filter(item => item.published)
    .sort((a, b) => b.id - a.id);
  res.json(published);
});

router.post('/messages', (req, res) => {
  const { nome, telefone, mensagem } = req.body || {};

  if (!nome || !nome.trim() || !telefone || !telefone.trim() || !mensagem || !mensagem.trim()) {
    return res.status(400).json({ error: 'Preencha nome, telefone e mensagem.' });
  }

  const messages = readJSON('messages', []);
  const novaMensagem = {
    id: nextId(messages),
    nome: nome.trim().slice(0, 200),
    telefone: telefone.trim().slice(0, 60),
    mensagem: mensagem.trim().slice(0, 2000),
    lida: false,
    criadoEm: new Date().toISOString(),
  };
  messages.push(novaMensagem);
  writeJSON('messages', messages);

  res.status(201).json({ ok: true });
});

module.exports = router;
