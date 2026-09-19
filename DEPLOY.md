# Como colocar o site no ar de graça (Oracle Cloud - VPS gratuito para sempre)

Este guia usa a Oracle Cloud "Always Free" - é o único provedor que oferece um servidor
Linux (VPS) de verdade, com HD persistente, **gratuito para sempre** (não é teste de 30 dias).
Precisa de cartão de crédito só pra confirmar identidade - não é cobrado nada enquanto você
ficar dentro do limite gratuito.

## 1. Criar a conta e o servidor (VM)

1. Crie uma conta em https://www.oracle.com/cloud/free/ (peça cartão só pra verificação).
2. No painel, vá em **Compute → Instances → Create Instance**.
3. Nome: `eletrica-vallerini`.
4. Em "Image and shape", escolha:
   - Imagem: **Ubuntu 22.04** (ou mais recente disponível)
   - Shape: escolha uma das opções marcadas **"Always Free eligible"** (ex: `VM.Standard.A1.Flex` com 1 OCPU / 6GB RAM, ou `VM.Standard.E2.1.Micro`)
5. Em "Add SSH keys", deixe a Oracle gerar um par de chaves e **baixe a chave privada** (`.key` ou `.pem`) - vai precisar dela pra entrar no servidor depois.
6. Clique em **Create**. Espere o status ficar "Running" (1-2 minutos) e anote o **IP público** da instância.

## 2. Abrir as portas (80 e 443)

Por padrão só a porta 22 (SSH) fica aberta. Sem isso, o site não é acessível pela internet.

1. Na página da instância, clique no link da **Subnet** (nome tipo "subnet-...").
2. Clique na **Security List** padrão associada.
3. Em "Ingress Rules", clique **Add Ingress Rules** e adicione duas regras (uma para cada porta):
   - Source CIDR: `0.0.0.0/0`, Porta de destino: `80` (HTTP)
   - Source CIDR: `0.0.0.0/0`, Porta de destino: `443` (HTTPS)

## 3. Entrar no servidor via SSH

No Windows, com a chave baixada (exemplo: `C:\Users\jhow\Downloads\ssh-key.key`):

```powershell
ssh -i "C:\Users\jhow\Downloads\ssh-key.key" ubuntu@SEU_IP_PUBLICO
```

Se der erro de permissão da chave, rode antes:
```powershell
icacls "C:\Users\jhow\Downloads\ssh-key.key" /inheritance:r /grant:r "%USERNAME%:R"
```

## 4. Preparar o servidor (rodar tudo isso dentro do SSH)

```bash
# Atualizar o sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs nginx

# Abrir as portas também no firewall interno do Ubuntu (a Oracle bloqueia por dois lugares!)
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || sudo apt install -y iptables-persistent -y
```

## 5. Enviar os arquivos do site pro servidor

Na sua máquina Windows (fora do SSH, num PowerShell novo), dentro da pasta do projeto:

```powershell
scp -i "C:\Users\jhow\Downloads\ssh-key.key" -r "C:\Users\jhow\Desktop\Projetos\braco" ubuntu@SEU_IP_PUBLICO:/home/ubuntu/braco
```

Isso copia tudo, incluindo `node_modules` (não tem problema, mas se quiser mais rápido pode
apagar a pasta `node_modules` local antes de copiar e rodar `npm install` lá no servidor).

## 6. Instalar dependências e configurar o `.env` no servidor

De volta no SSH:

```bash
cd /home/ubuntu/braco
npm install --omit=dev

# Editar o .env com suas credenciais reais de produção
nano .env
```

Confira que o `.env` tem:
```
PORT=3000
SESSION_SECRET=(gere um valor novo e aleatório, diferente do usado localmente)
COOKIE_SECURE=false
ADMIN_EMAIL=seu-email-de-admin
ADMIN_PASSWORD=uma-senha-forte
```

Gere um `SESSION_SECRET` novo com:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Depois rode o seed:
```bash
npm run seed-admin
```

## 7. Colocar o site pra rodar sempre (systemd)

O projeto já vem com o arquivo pronto em `deploy/eletrica-vallerini.service`.

```bash
sudo cp /home/ubuntu/braco/deploy/eletrica-vallerini.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable eletrica-vallerini
sudo systemctl start eletrica-vallerini
sudo systemctl status eletrica-vallerini   # deve mostrar "active (running)"
```

Isso faz o site reiniciar sozinho se cair ou se o servidor reiniciar.

## 8. Configurar o Nginx (pra usar a porta 80 normal, sem `:3000` na URL)

```bash
sudo cp /home/ubuntu/braco/deploy/nginx-eletrica-vallerini.conf /etc/nginx/sites-available/eletrica-vallerini
sudo nano /etc/nginx/sites-available/eletrica-vallerini
# troque "SEU_DOMINIO_AQUI" pelo seu domínio (ex: eletricavallerini.com.br)
# se ainda não tiver domínio, pode deixar "server_name _;" pra aceitar qualquer host

sudo ln -s /etc/nginx/sites-available/eletrica-vallerini /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t   # testa a configuração
sudo systemctl restart nginx
```

Agora o site já deve abrir em `http://SEU_IP_PUBLICO` (sem precisar da porta 3000).

## 9. Domínio (se você tiver um)

No painel do seu provedor de domínio (Registro.br, GoDaddy, etc.), crie um registro:
- Tipo: `A`
- Nome: `@` (e outro `www`, se quiser)
- Valor: o IP público da sua instância

Espere propagar (de minutos a algumas horas) e teste `http://seudominio.com.br`.

## 10. HTTPS grátis (Certbot) - só depois de ter domínio funcionando

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d seudominio.com.br -d www.seudominio.com.br
```

Depois que isso funcionar, edite o `.env` no servidor e mude:
```
COOKIE_SECURE=true
```
E reinicie: `sudo systemctl restart eletrica-vallerini`

## Como atualizar o site depois de mudanças

Sempre que eu (ou você) mudar algo no código local, é só reenviar e reiniciar:

```powershell
scp -i "C:\Users\jhow\Downloads\ssh-key.key" -r "C:\Users\jhow\Desktop\Projetos\braco\." ubuntu@SEU_IP_PUBLICO:/home/ubuntu/braco
```
```bash
# de volta no SSH
sudo systemctl restart eletrica-vallerini
```

⚠️ **Cuidado:** não sobrescreva as pastas `data/` e `uploads/` do servidor com as da sua
máquina local - são elas que guardam as mensagens, fotos e depoimentos reais. Copie só os
arquivos de código (`.js`, `.html`, `.css`) se já tiver dado deploy uma vez.
