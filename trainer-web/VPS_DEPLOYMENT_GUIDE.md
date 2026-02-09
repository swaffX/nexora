# VPS Deployment Guide - Nexora Trainer V2

## Git Pull Sorunu Çözümü

VPS'de `git pull` yaparken local değişiklikler nedeniyle hata alıyorsanız:

### Yöntem 1: Stash (Önerilen - Değişiklikleri saklar)
```bash
cd /root/nexora/trainer-web/client

# Local değişiklikleri geçici olarak sakla
git stash

# GitHub'dan çek
git pull origin main

# Eğer saklanan değişikliklere ihtiyacın varsa geri getir
git stash pop
```

### Yöntem 2: Hard Reset (Dikkat - Tüm local değişiklikleri siler!)
```bash
cd /root/nexora/trainer-web/client

# Tüm local değişiklikleri sil ve GitHub'daki hale getir
git reset --hard HEAD
git pull origin main
```

### Yöntem 3: Sadece package-lock.json'u sıfırla
```bash
cd /root/nexora/trainer-web/client

# Sadece package-lock.json'u sıfırla
git checkout HEAD -- package-lock.json

# Şimdi pull yapabilirsin
git pull origin main
```

## Tam Deployment Adımları

### 1. GitHub'a Push (Local'den)
```bash
# Local bilgisayarında
cd C:\Users\zeyne\OneDrive\Masaüstü\nexora

# Tüm değişiklikleri ekle
git add .

# Commit
git commit -m "Nexora Trainer V2 - Complete Implementation"

# GitHub'a push
git push origin main
```

### 2. VPS'de Pull ve Deploy
```bash
# VPS'e bağlan
ssh root@194.105.5.37

# Nexora dizinine git
cd /root/nexora

# Local değişiklikleri temizle
cd trainer-web/client
git stash
cd ../..

# GitHub'dan çek
git pull origin main

# Client dependencies yükle (eğer yeni paket eklendiyse)
cd trainer-web/client
npm install

# Build
npm run build

# Server'a geri dön
cd ../server

# Server dependencies yükle (eğer yeni paket eklendiyse)
npm install

# PM2'yi restart et
pm2 restart Nexora_Trainer_API

# Nginx'i reload et
sudo systemctl reload nginx

# Logları kontrol et
pm2 logs Nexora_Trainer_API --lines 50
```

### 3. Verify Deployment
```bash
# Backend çalışıyor mu?
curl http://localhost:3001/health

# PM2 status
pm2 status

# Nginx status
sudo systemctl status nginx

# Tarayıcıda test et
# https://neuroviabot.xyz
```

## Hızlı Deploy Script

Aşağıdaki script'i VPS'de `/root/deploy-nexora.sh` olarak kaydet:

```bash
#!/bin/bash

echo "🚀 Nexora Trainer V2 Deployment Starting..."

# Navigate to project
cd /root/nexora || exit

# Stash local changes
echo "📦 Stashing local changes..."
cd trainer-web/client
git stash
cd ../..

# Pull from GitHub
echo "⬇️ Pulling from GitHub..."
git pull origin main

# Install dependencies
echo "📚 Installing dependencies..."
cd trainer-web/client
npm install

# Build frontend
echo "🏗️ Building frontend..."
npm run build

# Restart backend
echo "🔄 Restarting backend..."
pm2 restart Nexora_Trainer_API

# Reload Nginx
echo "🌐 Reloading Nginx..."
sudo systemctl reload nginx

# Show status
echo "✅ Deployment complete!"
echo ""
echo "📊 Status:"
pm2 status
echo ""
echo "📝 Recent logs:"
pm2 logs Nexora_Trainer_API --lines 10 --nostream

echo ""
echo "🎉 Nexora Trainer V2 deployed successfully!"
echo "🌐 Visit: https://neuroviabot.xyz"
```

### Script'i Kullan:
```bash
# Script'i executable yap
chmod +x /root/deploy-nexora.sh

# Çalıştır
/root/deploy-nexora.sh
```

## Troubleshooting

### Problem: Git pull hata veriyor
**Çözüm:**
```bash
git stash
git pull origin main
```

### Problem: Build başarısız
**Çözüm:**
```bash
cd /root/nexora/trainer-web/client
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Problem: PM2 restart çalışmıyor
**Çözüm:**
```bash
pm2 delete Nexora_Trainer_API
cd /root/nexora/trainer-web/server
pm2 start index.js --name Nexora_Trainer_API
pm2 save
```

### Problem: Nginx 502 Bad Gateway
**Çözüm:**
```bash
# Backend çalışıyor mu kontrol et
pm2 status
pm2 logs Nexora_Trainer_API

# Port 3001 dinliyor mu?
netstat -tuln | grep 3001

# Nginx config test
sudo nginx -t

# Nginx restart
sudo systemctl restart nginx
```

### Problem: Discord login çalışmıyor
**Çözüm:**
```bash
# Environment variables kontrol et
cd /root/nexora/trainer-web/server
cat .env | grep DISCORD

# Callback URL doğru mu?
# https://neuroviabot.xyz/auth/discord/callback

# PM2 restart
pm2 restart Nexora_Trainer_API
```

## Environment Variables Checklist

### Server (.env)
```env
NODE_ENV=production
PORT=3001
CLIENT_URL=https://neuroviabot.xyz
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
DISCORD_CALLBACK_URL=https://neuroviabot.xyz/auth/discord/callback
```

### Client (.env)
```env
VITE_API_URL=https://neuroviabot.xyz
```

## Post-Deployment Checklist

- [ ] Git pull başarılı
- [ ] npm install tamamlandı
- [ ] Build başarılı (dist/ klasörü oluştu)
- [ ] PM2 restart başarılı
- [ ] Nginx reload başarılı
- [ ] Backend çalışıyor (port 3001)
- [ ] Frontend erişilebilir (https://neuroviabot.xyz)
- [ ] Discord login çalışıyor
- [ ] 6 harita oynanabiliyor
- [ ] Skorlar kaydediliyor
- [ ] Leaderboard güncelleniyor
- [ ] Ayarlar kaydediliyor

## Monitoring

### Real-time Logs
```bash
# Backend logs
pm2 logs Nexora_Trainer_API

# Nginx access logs
tail -f /var/log/nginx/access.log

# Nginx error logs
tail -f /var/log/nginx/error.log
```

### Performance
```bash
# CPU & Memory
pm2 monit

# Disk usage
df -h

# Network
netstat -tuln | grep 3001
```

## Backup

### Before Deployment
```bash
# Backup current build
cp -r /root/nexora/trainer-web/client/dist /root/nexora/trainer-web/client/dist.backup

# Backup database (optional)
mongodump --uri="mongodb+srv://..." --out=/root/backup/$(date +%Y%m%d)
```

## Rollback

### If Deployment Fails
```bash
# Restore previous build
rm -rf /root/nexora/trainer-web/client/dist
mv /root/nexora/trainer-web/client/dist.backup /root/nexora/trainer-web/client/dist

# Restart services
pm2 restart Nexora_Trainer_API
sudo systemctl reload nginx
```

---

**Son Güncelleme**: 9 Şubat 2026
**Durum**: ✅ Production Ready
