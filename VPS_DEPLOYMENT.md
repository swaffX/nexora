# VPS Deployment Guide - Nexora Discord Bots

## 🚀 VPS'e İlk Kurulum

### 1. VPS'e Bağlan
```bash
ssh root@YOUR_VPS_IP
# veya kullanıcı adınla
ssh username@YOUR_VPS_IP
```

### 2. Sistem Güncellemesi
```bash
sudo apt update && sudo apt upgrade -y
```

### 3. Node.js Kurulumu (v18+)
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version  # v18+ olmalı
npm --version
```

### 4. MongoDB Kurulumu

**Basit Yol (Local MongoDB):**
```bash
sudo apt-get install -y mongodb
sudo systemctl start mongodb
sudo systemctl enable mongodb
sudo systemctl status mongodb
```

**Veya MongoDB Atlas (Cloud) Kullanabilirsin:**
- https://www.mongodb.com/cloud/atlas
- Free tier ile başla
- Connection string'i al

### 5. PM2 Kurulumu
```bash
sudo npm install -g pm2
```

### 6. Git Kurulumu
```bash
sudo apt-get install -y git
```

---

## 📦 Proje Kurulumu

### 1. Repository'yi Clone Et
```bash
cd ~
git clone https://github.com/swaffX/nexora.git
cd nexora
```

### 2. Bağımlılıkları Yükle
```bash
npm install
```

### 3. Environment Dosyalarını Oluştur

**Root `.env`:**
```bash
nano .env
```
İçeriği:
```env
MONGODB_URI=mongodb://localhost:27017/nexora
GUILD_ID=1463875441780621372
```

**Main Bot `.env`:**
```bash
nano main-bot/.env
```
İçeriği:
```env
TOKEN=YOUR_MAIN_BOT_TOKEN
CLIENT_ID=YOUR_MAIN_BOT_CLIENT_ID
```

**Guard Bot 1 `.env`:**
```bash
nano guard-bot-1/.env
```
İçeriği:
```env
TOKEN=YOUR_GUARD_BOT_1_TOKEN
CLIENT_ID=YOUR_GUARD_BOT_1_CLIENT_ID
```

**Guard Bot 2 `.env`:**
```bash
nano guard-bot-2/.env
```
İçeriği:
```env
TOKEN=YOUR_GUARD_BOT_2_TOKEN
CLIENT_ID=YOUR_GUARD_BOT_2_CLIENT_ID
```

**Guard Bot 3 `.env`:**
```bash
nano guard-bot-3/.env
```
İçeriği:
```env
TOKEN=YOUR_GUARD_BOT_3_TOKEN
CLIENT_ID=YOUR_GUARD_BOT_3_CLIENT_ID
```

**Backup Bot `.env`:**
```bash
nano backup-bot/.env
```
İçeriği:
```env
TOKEN=YOUR_BACKUP_BOT_TOKEN
CLIENT_ID=YOUR_BACKUP_BOT_CLIENT_ID
```

### 4. Slash Komutları Deploy Et
```bash
node force-clean-all.js
```

### 5. Botları Başlat
```bash
npm start
```

### 6. Logları Kontrol Et
```bash
npx pm2 logs
# veya
npm run logs
```

### 7. PM2'yi Sistem Başlangıcına Ekle
```bash
pm2 startup
# Çıkan komutu çalıştır (sudo ile başlayan satırı)

pm2 save
```

---

## 🔄 Güncelleme Yaparken

### GitHub'dan Son Değişiklikleri Çek
```bash
cd ~/nexora
git pull origin main
npm install  # Yeni bağımlılık eklendiyse
npm restart
```

---

## 📊 Bot Yönetim Komutları

```bash
npm start         # Tüm botları başlat
npm stop          # Tüm botları durdur
npm restart       # Tüm botları yeniden başlat
npm run logs      # Logları görüntüle
npm run dashboard # PM2 dashboard
npx pm2 list      # Çalışan botları listele
npx pm2 delete all # Tüm botları PM2'den sil
```

---

## 🛠️ Sorun Giderme

### Bot Başlamıyor?
```bash
npx pm2 logs Main_Bot --lines 50
npx pm2 logs Guard_1_AntiRaid --lines 50
```

### MongoDB Bağlantı Hatası?
```bash
sudo systemctl status mongodb
# Eğer çalışmıyorsa:
sudo systemctl start mongodb
```

### Port Kontrolü
```bash
netstat -tuln | grep 27017  # MongoDB
```

### Bellek Kullanımı
```bash
free -h
npx pm2 monit
```

### Bot Loglarını Temizle
```bash
npx pm2 flush
```

---

## 🔒 Güvenlik Önerileri

### 1. Firewall Ayarları
```bash
sudo ufw allow 22/tcp   # SSH
sudo ufw enable
sudo ufw status
```

### 2. Otomatik Güvenlik Güncellemeleri
```bash
sudo apt install unattended-upgrades
sudo dpkg-reconfigure --priority=low unattended-upgrades
```

### 3. Root Olmayan Kullanıcı Oluştur
```bash
adduser botuser
usermod -aG sudo botuser
su - botuser
```

---

## 📝 Sonraki Adımlar

1. ✅ VPS'e bağlan
2. ✅ Gerekli yazılımları yükle (Node.js, MongoDB, PM2, Git)
3. ✅ Projeyi clone et
4. ✅ `.env` dosyalarını yapılandır
5. ✅ Komutları deploy et
6. ✅ Botları başlat
7. ✅ PM2'yi startup'a ekle
8. ✅ Discord'da test et

---

## 🆘 Yardım

Herhangi bir sorunla karşılaşırsan:
- Logları kontrol et: `npx pm2 logs`
- Bot durumunu kontrol et: `npx pm2 list`
- GitHub'da issue aç: https://github.com/swaffX/nexora/issues

**Made with ❤️ by Swaff**
