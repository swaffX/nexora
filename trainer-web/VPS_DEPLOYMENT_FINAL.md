# 🚀 VPS DEPLOYMENT - NEXORA TRAINER

## ✅ HAZIRLIK (Tamamlandı)

- ✅ Cloudflare DNS ayarları tamam
- ✅ Discord Application oluşturuldu
- ✅ CLIENT_ID: 773539215098249246
- ✅ CLIENT_SECRET: 3AGPwJHUW7VD0Oop78ogNadFkdIAlQXQ
- ✅ VPS IP: 194.105.5.37
- ✅ Domain: neuroviabot.xyz

---

## 🔧 ADIM 1: VPS'e Bağlan

```bash
ssh root@194.105.5.37
```

---

## 📦 ADIM 2: Projeyi Güncelle

```bash
cd /var/www/nexora
git pull origin main
cd trainer-web
```

---

## ⚙️ ADIM 3: Production .env Dosyalarını Oluştur

### server/.env

```bash
nano server/.env
```

İçerik (Kopyala-Yapıştır):

```env
# Discord OAuth2
DISCORD_CLIENT_ID=773539215098249246
DISCORD_CLIENT_SECRET=3AGPwJHUW7VD0Oop78ogNadFkdIAlQXQ
DISCORD_CALLBACK_URL=https://neuroviabot.xyz/auth/discord/callback

# MongoDB
MONGODB_URI=mongodb+srv://swaffnexora:Swx.lyc2805@cluster0.sllo7m5.mongodb.net/nexora?retryWrites=true&w=majority

# Session
SESSION_SECRET=nexora-trainer-super-secret-key-2024-production

# Server
PORT=3001
NODE_ENV=production
CLIENT_URL=https://neuroviabot.xyz
```

**Kaydet**: `CTRL + X` → `Y` → `Enter`

---

### client/.env

```bash
nano client/.env
```

İçerik:

```env
VITE_API_URL=https://neuroviabot.xyz
```

**Kaydet**: `CTRL + X` → `Y` → `Enter`

---

## 🏗️ ADIM 4: Frontend Build

```bash
cd client
npm run build
cd ..
```

Build tamamlanınca `client/dist/` klasörü oluşacak.

---

## 🌐 ADIM 5: Nginx Yapılandırması

### 5.1. Nginx Config Oluştur

```bash
sudo nano /etc/nginx/sites-available/neuroviabot-trainer
```

İçerik (Kopyala-Yapıştır):

```nginx
server {
    listen 80;
    server_name neuroviabot.xyz www.neuroviabot.xyz;

    # Frontend (Static Files)
    root /var/www/nexora/trainer-web/client/dist;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/json application/javascript;

    # Frontend Routes
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

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
}
```

**Kaydet**: `CTRL + X` → `Y` → `Enter`

---

### 5.2. Nginx'i Aktifleştir

```bash
# Symlink oluştur
sudo ln -s /etc/nginx/sites-available/neuroviabot-trainer /etc/nginx/sites-enabled/

# Test et
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

**Beklenen çıktı:**
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

---

## 🚀 ADIM 6: Backend'i PM2 ile Başlat

```bash
cd /var/www/nexora/trainer-web
pm2 start ecosystem.config.js
```

**Beklenen çıktı:**
```
[PM2] Process successfully started
┌─────┬──────────────────────┬─────────┬─────────┐
│ id  │ name                 │ status  │ restart │
├─────┼──────────────────────┼─────────┼─────────┤
│ 7   │ Nexora_Trainer_API   │ online  │ 0       │
└─────┴──────────────────────┴─────────┴─────────┘
```

---

### 6.1. Logları Kontrol Et

```bash
pm2 logs Nexora_Trainer_API --lines 20
```

**Beklenen mesajlar:**
```
✅ MongoDB bağlantısı başarılı (Nexora Trainer)
🚀 Nexora Trainer API running on port 3001
```

---

### 6.2. PM2 Kaydet (Otomatik Başlatma)

```bash
pm2 save
```

---

## ✅ ADIM 7: Test Et

### 7.1. Health Check

```bash
curl http://localhost:3001/api/health
```

**Beklenen yanıt:**
```json
{
  "status": "ok",
  "service": "Nexora Trainer API",
  "timestamp": "2026-02-09T..."
}
```

---

### 7.2. Tarayıcıda Test

1. **Frontend**: https://neuroviabot.xyz
2. **Discord Login**: "Discord ile Giriş Yap" butonuna tıkla
3. **Dashboard**: Giriş yaptıktan sonra dashboard'a yönlendirilmelisin

---

## 🎉 TAMAMLANDI!

Artık **https://neuroviabot.xyz** canlı!

- ✅ Cloudflare SSL aktif (HTTPS otomatik)
- ✅ Backend PM2 ile çalışıyor
- ✅ Frontend Nginx ile serve ediliyor
- ✅ Discord OAuth2 çalışıyor
- ✅ MongoDB bağlantısı aktif

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

## 🔄 Güncelleme Yaparken

```bash
cd /var/www/nexora/trainer-web
git pull origin main
cd server && npm install
cd ../client && npm install && npm run build
pm2 restart Nexora_Trainer_API
sudo systemctl reload nginx
```

---

## 🐛 Sorun Giderme

### Backend Başlamıyor
```bash
pm2 logs Nexora_Trainer_API --lines 100
```

### Nginx 502 Bad Gateway
```bash
# Backend çalışıyor mu?
pm2 list

# Port dinleniyor mu?
netstat -tuln | grep 3001
```

### MongoDB Bağlantı Hatası
- MongoDB Atlas'ta IP whitelist kontrol et (0.0.0.0/0 olmalı)

---

**Made with ❤️ by Swaff**
