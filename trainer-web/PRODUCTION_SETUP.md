# 🚀 PRODUCTION SETUP - trainer.neuroviabot.xyz

## 📋 Genel Bakış

- **Domain**: trainer.neuroviabot.xyz
- **VPS**: Mevcut Nexora VPS (botlarla aynı sunucu)
- **Backend Port**: 3001
- **Frontend**: Static files (Nginx serve)
- **SSL**: Let's Encrypt (Ücretsiz)

---

## 🌐 ADIM 1: DNS Ayarları (Namecheap)

### 1.1. Namecheap'e Git
https://namecheap.com → Domain List → neuroviabot.xyz → Manage

### 1.2. A Record Ekle
**Advanced DNS** sekmesi → **Add New Record**

```
Type: A Record
Host: trainer
Value: VPS_IP_ADRESI_BURAYA
TTL: Automatic
```

**Save All Changes** → 5-10 dakika bekle

### 1.3. Test Et
```bash
# DNS yayıldı mı kontrol et
ping trainer.neuroviabot.xyz
# veya
nslookup trainer.neuroviabot.xyz
```

---

## 🔧 ADIM 2: VPS'te Kurulum

### 2.1. VPS'e Bağlan
```bash
ssh root@VPS_IP_ADRESI
# veya
ssh username@VPS_IP_ADRESI
```

### 2.2. Projeyi Güncelle
```bash
cd /var/www/nexora  # veya projenin olduğu klasör
git pull origin main
cd trainer-web
```

### 2.3. Bağımlılıkları Yükle
```bash
npm run install:all
```

### 2.4. Production .env Oluştur

**server/.env:**
```bash
nano server/.env
```

İçerik:
```env
# Discord OAuth2
DISCORD_CLIENT_ID=YOUR_DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET=YOUR_DISCORD_CLIENT_SECRET
DISCORD_CALLBACK_URL=https://trainer.neuroviabot.xyz/auth/discord/callback

# MongoDB
MONGODB_URI=mongodb+srv://swaffnexora:Swx.lyc2805@cluster0.sllo7m5.mongodb.net/nexora?retryWrites=true&w=majority

# Session
SESSION_SECRET=nexora-trainer-super-secret-key-2024

# Server
PORT=3001
NODE_ENV=production
CLIENT_URL=https://trainer.neuroviabot.xyz
```

**client/.env:**
```bash
nano client/.env
```

İçerik:
```env
VITE_API_URL=https://trainer.neuroviabot.xyz
```

### 2.5. Frontend Build
```bash
cd client
npm run build
cd ..
```

Build dosyaları `client/dist/` klasöründe oluşacak.

---

## 🌐 ADIM 3: Nginx Yapılandırması

### 3.1. Nginx Config Oluştur
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

### 3.2. Nginx'i Aktifleştir
```bash
# Symlink oluştur
sudo ln -s /etc/nginx/sites-available/nexora-trainer /etc/nginx/sites-enabled/

# Test et
sudo nginx -t

# Restart
sudo systemctl restart nginx
```

### 3.3. Test Et (HTTP)
http://trainer.neuroviabot.xyz

---

## 🔐 ADIM 4: SSL Sertifikası (Let's Encrypt)

### 4.1. Certbot Kur (Eğer yoksa)
```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

### 4.2. SSL Sertifikası Al
```bash
sudo certbot --nginx -d trainer.neuroviabot.xyz
```

Sorular:
- Email: Senin email adresin
- Terms: Agree (A)
- Share email: No (N)

### 4.3. Otomatik Yenileme Test Et
```bash
sudo certbot renew --dry-run
```

### 4.4. Test Et (HTTPS)
https://trainer.neuroviabot.xyz

---

## 🚀 ADIM 5: Backend'i PM2 ile Başlat

### 5.1. PM2 ile Başlat
```bash
cd /var/www/nexora/trainer-web
pm2 start ecosystem.config.js
```

### 5.2. Otomatik Başlatma
```bash
pm2 save
```

### 5.3. Logları Kontrol Et
```bash
pm2 logs Nexora_Trainer_API
```

Şu mesajı görmelisin:
```
✅ MongoDB bağlantısı başarılı (Nexora Trainer)
🚀 Nexora Trainer API running on port 3001
```

---

## 🎮 ADIM 6: Discord Application Güncelle

### 6.1. Discord Developer Portal
https://discord.com/developers/applications

### 6.2. OAuth2 Redirects Ekle
**OAuth2** → **Redirects** bölümüne ekle:
```
https://trainer.neuroviabot.xyz/auth/discord/callback
```

**Save Changes** tıkla.

---

## ✅ ADIM 7: Test Et

### 7.1. Health Check
```bash
curl https://trainer.neuroviabot.xyz/api/health
```

Yanıt:
```json
{
  "status": "ok",
  "service": "Nexora Trainer API",
  "timestamp": "2024-..."
}
```

### 7.2. Frontend Test
https://trainer.neuroviabot.xyz

### 7.3. Discord Login Test
"Discord ile Giriş Yap" butonuna tıkla → Yetkilendir → Dashboard'a yönlendirilmelisin

---

## 🔄 Güncelleme Yaparken

```bash
cd /var/www/nexora/trainer-web

# Git pull
git pull origin main

# Backend güncelle
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
# Backend
pm2 logs Nexora_Trainer_API

# Nginx Access
sudo tail -f /var/log/nginx/access.log

# Nginx Error
sudo tail -f /var/log/nginx/error.log
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

### SSL Hatası
```bash
sudo certbot certificates
sudo certbot renew --force-renewal
```

### DNS Yayılmadı
```bash
# 5-10 dakika bekle, sonra:
nslookup trainer.neuroviabot.xyz
```

---

## 🎉 Tamamlandı!

Artık **https://trainer.neuroviabot.xyz** adresinden erişilebilir!

- ✅ SSL sertifikası aktif
- ✅ Backend PM2 ile çalışıyor
- ✅ Frontend Nginx ile serve ediliyor
- ✅ Discord OAuth2 çalışıyor
- ✅ MongoDB bağlantısı aktif

---

**Made with ❤️ by Swaff**
