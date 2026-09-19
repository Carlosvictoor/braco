require('dotenv').config();
const bcrypt = require('bcryptjs');
const { writeJSON } = require('../lib/db');

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error('Defina ADMIN_EMAIL e ADMIN_PASSWORD no arquivo .env antes de rodar este script.');
  process.exit(1);
}

if (password.length < 6) {
  console.error('A senha precisa ter pelo menos 6 caracteres.');
  process.exit(1);
}

const passwordHash = bcrypt.hashSync(password, 10);

writeJSON('admin', { email: email.toLowerCase().trim(), passwordHash });

console.log(`Conta admin criada/atualizada para: ${email}`);
console.log('Você já pode rodar "npm start" e entrar em /admin.html com essas credenciais.');
