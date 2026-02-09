# 🚀 VPS DEPLOYMENT GUIDE - NEXORA TRAINER

## 📋 Ön Hazırlık

### VPS Gereksinimleri
- Ubuntu 20.04+ / Debian 11+
- 2GB+ RAM
- Node.js v18+
- MongoDB (Mevcut Nexora DB)
- Nginx
- PM2

---

## 🔧 ADIM 1: VPS'e Bağlan

```bash
ssh root@YOUR_VPS_IP
# veya
ssh username@YOUR_VPS_IP
```

---

## 📦 ADIM 2: Projeyi Klonla

```bash
cd /var/www  # veya istediğin klasör
git clone https://github.com/swaffX/nexora.git
cd nexora/trainer-web
```

---

## ⚙️ ADIM 3: Environment Dosyasını Yapılandır

### Server .env

```bash
cd server
nano .env
```

İçerik:
```env
# Discord OAuth2
DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
DISCORD_CALLBACK_URL=https://trainer.yourdomain.com/auth/discord/callback

# MongoDB (Mevcut Nexora DB)
MONGODB_URI=mongodb://localhost:27017/nexora

# Session
SESSION_SECRET=SUPER_SECRET_KEY_BURAYA_RANDOM_STRING

# Server
PORT=3001
NODE_ENV=production
CLIENT_URL=https://trainer.yourdomain.com
```

### Client .env

```bash
cd ../client
nano .env
```

İçerik:
```env
VITE_API_URL=https://trainer.yourdomain.com
```

---

## 📦 ADIM 4: Bağımlılıkları Yükle ve Build

```bash
cd /var/www/nexora/trainer-web

# Tüm bağımlılıkları yükle
npm run install:all

# Frontend'i build et
cd client
npm run build
```

---

## 🌐 ADIM 5: Nginx Yapılandırması

### Nginx Config Oluştur

```bash
sudo nano /etc/nginx/sites-available/nexora-trainer
```

İçerik:
```nginx
server {
    listen 80;
    server_name trainer.neuroviabot.xyz;

    # Frontend (Static Files)
    root /var/www/nexora/trainer-web/client/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Auth Endpoints
    location /auth {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json;
}
```

### Nginx'i Aktifleştir

```bash
# Symlink oluştur
sudo ln -s /etc/nginx/sites-available/nexora-trainer /etc/nginx/sites-enabled/

# Test et
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

---

## 🔐 ADIM 6: SSL Sertifikası (Let's Encrypt)

```bash
# Certbot kur
sudo apt install certbot python3-certbot-nginx -y

# SSL sertifikası al
sudo certbot --nginx -d trainer.neuroviabot.xyz

# Otomatik yenileme test et
sudo certbot renew --dry-run
```

---

## 🚀 ADIM 7: PM2 ile Backend Başlat

```bash
cd /var/www/nexora/trainer-web

# PM2 ile başlat
pm2 start ecosystem.config.js

# Otomatik başlatma
pm2 startup
pm2 save

# Logları kontrol et
pm2 logs Nexora_Trainer_API
```

---

## ✅ ADIM 8: Test Et

1. **Health Check**: https://trainer.yourdomain.com/api/health
2. **Frontend**: https://trainer.yourdomain.com
3. **Discord Login**: Giriş yap butonuna tıkla

---

## 🔄 Güncelleme Yaparken

```bash
cd /var/www/nexora/trainer-web

# Git pull
git pull origin main

# Backend bağımlılıkları güncelle
cd server
npm install

# Frontend build
cd ../client
npm install
npm run build

# Backend restart
pm2 restart Nexora_Trainer_API

# Nginx reload (gerekirse)
sudo systemctl reload nginx
```

---

## 📊 Monitoring

### PM2 Dashboard
```bash
pm2 monit
```

### Loglar
```bash
# Backend logs
pm2 logs Nexora_Trainer_API

# Nginx access logs
sudo tail -f /var/log/nginx/access.log

# Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

---

## 🐛 Sorun Giderme

### Backend Başlamıyor
```bash
# Logları kontrol et
pm2 logs Nexora_Trainer_API --lines 100

# Manuel başlat (debug için)
cd /var/www/nexora/trainer-web/server
node index.js
```

### MongoDB Bağlantı Hatası
```bash
# MongoDB durumunu kontrol et
sudo systemctl status mongodb

# Başlat
sudo systemctl start mongodb
```

### Nginx 502 Bad Gateway
```bash
# Backend çalışıyor mu?
pm2 list

# Port dinleniyor mu?
netstat -tuln | grep 3001

# Nginx loglarını kontrol et
sudo tail -f /var/log/nginx/error.log
```

### Discord OAuth Hatası
- Discord Developer Portal'da Redirect URL'i kontrol et
- HTTPS kullanıyorsan callback URL'de https olmalı
- CLIENT_ID ve CLIENT_SECRET doğru mu?

---

## 🔒 Güvenlik Önerileri

1. **Firewall Ayarları**
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

2. **MongoDB Güvenliği**
```bash
# MongoDB'yi sadece localhost'tan erişilebilir yap
sudo nano /etc/mongodb.conf
# bind_ip = 127.0.0.1
```

3. **Session Secret**
- Güçlü, rastgele bir string kullan
- Asla GitHub'a commit etme

4. **Rate Limiting**
- Backend'de zaten express-rate-limit var
- Gerekirse Nginx'te de ekle

---

## 📝 Notlar

- **Botlara Dokunulmadı**: Trainer tamamen ayrı port (3001) kullanır
- **Aynı MongoDB**: Mevcut Nexora DB'yi kullanır, yeni collection'lar ekler
- **PM2 Ecosystem**: Root ecosystem.config.js'e ekleme yapma, trainer'ın kendi ecosystem'i var

---

## 🆘 Yardım

Sorun yaşarsan:
1. Logları kontrol et (`pm2 logs`)
2. Health endpoint'i test et
3. Discord'dan ulaş

**Made with ❤️ by Swaff**
