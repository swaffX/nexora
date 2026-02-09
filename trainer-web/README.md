# 🎯 NEXORA TRAINER

Web tabanlı 3D Aim Trainer - Valorant uyumlu sensitivity ve crosshair ayarları

## 🚀 Özellikler

- **6 Farklı Antrenman Haritası**: Gridshot, Tracking, Flicking, Microshot, Sixshot, Spidershot
- **Discord OAuth2 Girişi**: Tek tıkla giriş
- **Valorant Uyumlu Ayarlar**: Sensitivity ve crosshair ayarlarınızı birebir taşıyın
- **Leaderboard Sistemi**: Her harita için Top 10 sıralaması
- **Gerçek Zamanlı İstatistikler**: Skor, doğruluk, isabet/kaçan takibi
- **Özelleştirilebilir Crosshair**: Renk, boyut, stil, outline ayarları
- **3D Grafik**: Three.js ile gerçekçi 3D ortam

## 📦 Kurulum

### Gereksinimler

- Node.js v18+
- MongoDB (Mevcut Nexora veritabanını kullanır)
- Discord Application (OAuth2 için)

### 1. Discord Application Oluştur

1. [Discord Developer Portal](https://discord.com/developers/applications)'a git
2. "New Application" → İsim ver (örn: Nexora Trainer)
3. **OAuth2** → **Redirects** ekle:
   - Development: `http://localhost:3001/auth/discord/callback`
   - Production: `https://yourdomain.com/auth/discord/callback`
4. **CLIENT_ID** ve **CLIENT_SECRET**'i kopyala

### 2. Bağımlılıkları Yükle

```bash
cd trainer-web
npm run install:all
```

### 3. Environment Dosyasını Yapılandır

```bash
cd server
cp .env.example .env
nano .env
```

`.env` içeriği:
```env
DISCORD_CLIENT_ID=your_discord_client_id
DISCORD_CLIENT_SECRET=your_discord_client_secret
DISCORD_CALLBACK_URL=http://localhost:3001/auth/discord/callback
MONGODB_URI=mongodb://localhost:27017/nexora
SESSION_SECRET=your-super-secret-key
PORT=3001
CLIENT_URL=http://localhost:5173
```

### 4. Geliştirme Modunda Başlat

```bash
# Root klasörden (trainer-web/)
npm run dev
```

Bu komut hem backend (port 3001) hem frontend (port 5173) başlatır.

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001

## 🏗️ Proje Yapısı

```
trainer-web/
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # UI bileşenleri
│   │   ├── pages/          # Sayfalar (Landing, Dashboard, Training, etc.)
│   │   ├── scenes/         # 3D sahneler (Gridshot, Tracking, etc.)
│   │   ├── store/          # Zustand state management
│   │   └── App.jsx
│   └── package.json
├── server/                 # Express Backend
│   ├── config/             # Passport config
│   ├── models/             # MongoDB modelleri
│   ├── routes/             # API endpoints
│   ├── middleware/         # Auth middleware
│   └── index.js
└── package.json
```

## 🎮 Kullanım

1. **Giriş Yap**: Discord ile giriş yap
2. **Harita Seç**: Dashboard'dan bir antrenman haritası seç
3. **Ayarları Yap**: Settings'den crosshair ve sensitivity ayarla
4. **Antrenman Yap**: 60 saniye içinde en yüksek skoru yap
5. **Leaderboard**: Sıralamada yerini gör

## 🔧 API Endpoints

### Authentication
- `GET /auth/discord` - Discord OAuth2 başlat
- `GET /auth/discord/callback` - OAuth2 callback
- `POST /auth/logout` - Çıkış yap
- `GET /auth/me` - Mevcut kullanıcı bilgisi

### Scores
- `POST /api/scores/submit` - Skor gönder (Auth required)
- `GET /api/scores/leaderboard/:mapId` - Leaderboard getir
- `GET /api/scores/user/:userId/:mapId` - Kullanıcı istatistikleri
- `GET /api/scores/user/:userId/all` - Tüm haritalar için istatistikler

### Settings
- `GET /api/settings` - Kullanıcı ayarları (Auth required)
- `PUT /api/settings` - Ayarları güncelle (Auth required)

## 🚀 Production Deployment (VPS)

### 1. Build Frontend

```bash
cd client
npm run build
```

### 2. Nginx Yapılandırması

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Frontend (Static Files)
    location / {
        root /path/to/trainer-web/client/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /auth {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. PM2 ile Backend Başlat

```bash
cd server
pm2 start index.js --name nexora-trainer-api
pm2 save
```

### 4. Environment Değişkenlerini Güncelle

Production `.env`:
```env
NODE_ENV=production
DISCORD_CALLBACK_URL=https://yourdomain.com/auth/discord/callback
CLIENT_URL=https://yourdomain.com
```

## 🛠️ Teknolojiler

**Frontend:**
- React 18
- Three.js / React Three Fiber
- Tailwind CSS
- Zustand (State Management)
- Axios
- Socket.io Client

**Backend:**
- Express.js
- Passport.js (Discord OAuth2)
- MongoDB + Mongoose
- Socket.io
- Express Session

## 📝 Notlar

- **Botlara Dokunulmadı**: Bu proje tamamen ayrı bir klasörde (`trainer-web/`), mevcut Discord botlarına hiçbir şekilde müdahale etmez.
- **Aynı Veritabanı**: Mevcut Nexora MongoDB veritabanını kullanır, yeni collection'lar ekler (`trainersettings`, `trainerscores`).
- **Port Çakışması Yok**: Backend 3001, Frontend 5173 portunda çalışır.

## 🎯 Gelecek Özellikler

- [ ] Daha fazla harita (Microshot, Sixshot, Spidershot gerçek implementasyonları)
- [ ] Replay sistemi
- [ ] Arkadaşlarla karşılaştırma
- [ ] Günlük/haftalık challenge'lar
- [ ] Valorant rank entegrasyonu
- [ ] Mobil destek

## 📄 Lisans

Private Project - Nexora Community

---

**Made with ❤️ by Swaff**
