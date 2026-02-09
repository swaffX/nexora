# 🎮 DISCORD APPLICATION KURULUMU

## Adım 1: Discord Developer Portal'a Git

https://discord.com/developers/applications

## Adım 2: Yeni Application Oluştur

1. Sağ üstteki **"New Application"** butonuna tıkla
2. İsim: **"Nexora Trainer"** (veya istediğin isim)
3. **"Create"** butonuna tıkla

## Adım 3: OAuth2 Ayarları

1. Sol menüden **"OAuth2"** → **"General"** sekmesine git

2. **CLIENT ID** ve **CLIENT SECRET**'i kopyala:
   - CLIENT ID: Hemen görünür
   - CLIENT SECRET: "Reset Secret" butonuna tıkla → Kopyala

3. **Redirects** bölümüne ekle:
   - Development: `http://localhost:3001/auth/discord/callback`
   - Production: `https://trainer.neuroviabot.xyz/auth/discord/callback` (VPS'e geçince)

4. **"Save Changes"** butonuna tıkla

## Adım 4: .env Dosyasını Güncelle

`trainer-web/server/.env` dosyasını aç ve şunları değiştir:

```env
DISCORD_CLIENT_ID=BURAYA_CLIENT_ID_YAPISTIR
DISCORD_CLIENT_SECRET=BURAYA_CLIENT_SECRET_YAPISTIR
```

## Adım 5: Test Et

```bash
cd trainer-web
npm run dev
```

http://localhost:5173 → "Discord ile Giriş Yap" butonuna tıkla

---

## 🌐 VPS/Domain İçin (Production)

### Discord'da Redirect URL Ekle:
```
https://trainer.neuroviabot.xyz/auth/discord/callback
```

### server/.env Güncelle:
```env
DISCORD_CALLBACK_URL=https://trainer.neuroviabot.xyz/auth/discord/callback
CLIENT_URL=https://trainer.neuroviabot.xyz
NODE_ENV=production
```

### client/.env Güncelle:
```env
VITE_API_URL=https://trainer.neuroviabot.xyz
```

---

## ✅ Kontrol Listesi

- [ ] Discord Application oluşturuldu
- [ ] CLIENT_ID kopyalandı
- [ ] CLIENT_SECRET kopyalandı
- [ ] Redirect URL eklendi
- [ ] .env dosyası güncellendi
- [ ] `npm run dev` çalıştırıldı
- [ ] http://localhost:5173 açıldı
- [ ] Discord login test edildi

---

**Not**: CLIENT_SECRET'i asla GitHub'a commit etme!
