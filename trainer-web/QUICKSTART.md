# ⚡ NEXORA TRAINER - 5 DAKİKADA BAŞLA

## 🎯 Hızlı Kurulum

### 1️⃣ Discord Application (2 dakika)

1. https://discord.com/developers/applications
2. "New Application" → İsim: "Nexora Trainer"
3. OAuth2 → Redirects: `http://localhost:3001/auth/discord/callback`
4. CLIENT_ID ve CLIENT_SECRET'i kopyala

### 2️⃣ Kurulum (2 dakika)

```bash
cd trainer-web
npm run install:all
cd server
cp .env.example .env
nano .env  # CLIENT_ID ve CLIENT_SECRET'i yapıştır
```

### 3️⃣ Başlat (1 dakika)

```bash
cd ..
npm run dev
```

### 4️⃣ Aç

http://localhost:5173

---

## 🎮 Kullanım

1. "Discord ile Giriş Yap"
2. Harita seç (Gridshot, Tracking, Flicking)
3. Settings'den crosshair ayarla
4. Oyna!

---

## 📦 Komutlar

```bash
npm run dev          # Hem backend hem frontend
npm run dev:server   # Sadece backend
npm run dev:client   # Sadece frontend
npm run build        # Production build
```

---

## 🐛 Sorun mu var?

### MongoDB çalışmıyor
```bash
sudo systemctl start mongodb
```

### Port zaten kullanımda
```bash
lsof -i :3001
kill -9 <PID>
```

### Discord OAuth hatası
- Redirect URL'i kontrol et
- CLIENT_ID/SECRET doğru mu?

---

## 📚 Detaylı Dokümantasyon

- **Kurulum**: `SETUP.md`
- **Deployment**: `DEPLOYMENT.md`
- **Genel Bilgi**: `README.md`

---

**Hadi başla! 🚀**
