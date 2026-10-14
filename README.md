# Elétrica Vallerini

Site institucional com painel administrativo para uma empresa de serviços elétricos da Baixada Santista.

## Funcionalidades

**Site público**
- Página da empresa com serviços, portfólio de trabalhos e depoimentos de clientes
- Formulário de contato que envia mensagens para o painel
- Informações de contato carregadas do painel (WhatsApp, telefone, cidade, região e Instagram)

**Painel admin** (`/admin.html`)
- Login com senha criptografada (bcrypt) e sessão por cookie
- Leitura e exclusão das mensagens recebidas pelo site
- Cadastro, edição e exclusão de trabalhos do portfólio, com envio de imagens
- Gestão de depoimentos e das informações de contato
- Troca de senha do administrador

## Tecnologias

- **Backend:** Node.js, Express, cookie-session, bcryptjs, Multer (upload de imagens)
- **Frontend:** HTML, CSS e JavaScript
- **Dados:** arquivos JSON (`data/`)
- **Deploy:** Nginx + systemd em VPS Linux (veja [DEPLOY.md](DEPLOY.md))

## Estrutura

```
server.js            Servidor Express e configuração da sessão
routes/public.js     API pública (portfólio, depoimentos, contato, mensagens)
routes/admin.js      API do painel (protegida por login)
middleware/          Verificação de autenticação
lib/db.js            Leitura e gravação dos dados em JSON
index.html, css/, js/  Site e painel
deploy/              Arquivos de configuração do Nginx e do serviço
```

## Como rodar localmente

```bash
npm install
cp .env.example .env     # depois edite o .env com seus valores
npm run seed-admin       # cria a conta de administrador
npm start
```

- Site: http://localhost:3000
- Painel: http://localhost:3000/admin.html

## Variáveis de ambiente

| Variável | Descrição |
|---|---|
| `PORT` | Porta do servidor (padrão 3000) |
| `SESSION_SECRET` | Chave da sessão, use um valor longo e aleatório |
| `COOKIE_SECURE` | `true` somente depois de configurar HTTPS |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | Usados para criar a conta admin |
