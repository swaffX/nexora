# 🚀 NEXORA TRAINER - HIZLI KURULUM REHBERİ

## ⚡ Hızlı Başlangıç (5 Dakika)

### 1. Discord Application Oluştur

1. https://discord.com/developers/applications → "New Application"
2. OAuth2 → Redirects ekle: `http://localhost:3001/auth/discord/callback`
3. CLIENT_ID ve CLIENT_SECRET'i kopyala

### 2. Kurulum

```bash
# Trainer klasörüne git
cd trainer-web

# Tüm bağımlılıkları yükle
npm run install:all

# Server .env dosyasını oluştur
cd server
cp .env.example .env
```

### 3. .env Dosyasını Düzenle

`server/.env`:
```env
DISCORD_CLIENT_ID=BURAYA_CLIENT_ID_YAPISTIR
DISCORD_CLIENT_SECRET=BURAYA_CLIENT_SECRET_YAPISTIR
DISCORD_CALLBACK_URL=http://localhost:3001/auth/discord/callback
MONGODB_URI=mongodb://localhost:27017/nexora
SESSION_SECRET=random-secret-key-buraya-yaz
PORT=3001
CLIENT_URL=http://localhost:5173
```

### 4. Başlat

```bash
# Root klasöre dön
cd ..

# Hem backend hem frontend'i başlat
npm run dev
```

### 5. Tarayıcıda Aç

- Frontend: http://localhost:5173
- Backend API: http://localhost:3001/health

## ✅ Kontrol Listesi

- [ ] Node.js v18+ kurulu
- [ ] MongoDB çalışıyor
- [ ] Discord Application oluşturuldu
- [ ] .env dosyası yapılandırıldı
- [ ] `npm run install:all` çalıştırıldı
- [ ] `npm run dev` çalıştırıldı
- [ ] http://localhost:5173 açıldı

## 🐛 Sorun Giderme

### MongoDB Bağlantı Hatası
```bash
# MongoDB'nin çalıştığını kontrol et
sudo systemctl status mongodb

# Çalışmıyorsa başlat
sudo systemctl start mongodb
```

### Port Zaten Kullanımda
```bash
# 3001 portunu kullanan process'i bul
lsof -i :3001

# Kill et
kill -9 <PID>
```

### Discord OAuth Hatası
- Redirect URL'in doğru olduğundan emin ol
- CLIENT_ID ve CLIENT_SECRET'in doğru kopyalandığını kontrol et

## 📦 Komutlar

```bash
# Geliştirme (hem backend hem frontend)
npm run dev

# Sadece backend
npm run dev:server

# Sadece frontend
npm run dev:client

# Production build
npm run build

# Production başlat
npm start
```

## 🎮 İlk Kullanım

1. http://localhost:5173 aç
2. "Discord ile Giriş Yap" butonuna tıkla
3. Discord'da yetkilendir
4. Dashboard'a yönlendirileceksin
5. Bir harita seç ve antrenmanına başla!

## 🔗 Faydalı Linkler

- Discord Developer Portal: https://discord.com/developers/applications
- MongoDB Compass: https://www.mongodb.com/products/compass
- Three.js Docs: https://threejs.org/docs/

---

Herhangi bir sorun yaşarsan Discord'dan ulaş! 🚀
