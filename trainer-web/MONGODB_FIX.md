# 🔧 MongoDB Atlas IP Whitelist Sorunu

## Sorun
MongoDB Atlas bağlantı hatası: "MongoServerSelectionError"

## Çözüm 1: IP Whitelist Ekle (Önerilen)

1. https://cloud.mongodb.com → Cluster'ına git
2. **Network Access** (sol menü)
3. **"Add IP Address"** butonuna tıkla
4. İki seçenek:
   - **"Allow Access from Anywhere"**: `0.0.0.0/0` (Geliştirme için)
   - **"Add Current IP Address"**: Sadece şu anki IP'n (Güvenli)
5. **"Confirm"** butonuna tıkla
6. 1-2 dakika bekle (aktif olması için)

## Çözüm 2: Local MongoDB Kullan (Alternatif)

### Windows'ta MongoDB Kurulumu:

1. https://www.mongodb.com/try/download/community
2. MongoDB Community Server indir
3. Kur (varsayılan ayarlarla)
4. MongoDB Compass indir (GUI)

### .env Güncelle:

```env
# Atlas yerine local
MONGODB_URI=mongodb://localhost:27017/nexora
```

### MongoDB Başlat:

```bash
# Windows Service olarak çalışıyor (otomatik başlar)
# Veya manuel:
mongod
```

## Test Et

```bash
cd trainer-web
npm run dev:server
```

Şu mesajı görmelisin:
```
✅ MongoDB bağlantısı başarılı (Nexora Trainer)
🚀 Nexora Trainer API running on port 3001
```

---

## VPS'te (Production)

VPS IP'sini MongoDB Atlas'a ekle:

1. VPS'e SSH ile bağlan
2. IP'ni öğren: `curl ifconfig.me`
3. MongoDB Atlas → Network Access → Add IP Address
4. VPS IP'sini ekle

Veya "Allow Access from Anywhere" (0.0.0.0/0) kullan.
