# 🔄 Lobi Sistemi Geçiş Kılavuzu

## 📌 Yapılan Değişiklikler

### Önceki Sistem
- 3 ayrı lobi kategorisi (Lobby 1, 2, 3)
- Her lobinin kendi bekleme kanalı
- Tüm kanallar her zaman açık
- Görsel karmaşa

### Yeni Sistem
- 1 ana lobi (her zaman aktif)
- 2 ek lobi (butonla aç/kapat)
- Dinamik kanal oluşturma
- Canvas görselli panel
- Temiz görünüm

---

## 🚀 Geçiş Adımları

### 1. Eski Lobileri Temizle

Discord'da admin olarak:

```
/cleanup-old-lobbies
```

Bu komut eski Lobby 2 ve Lobby 3 kategorilerini ve içindeki tüm kanalları otomatik siler.

### 2. Bot'u Yeniden Başlat

```bash
pm2 restart custom-bot
```

### 3. Ana Lobi Panelini Kur

Ana lobi panel kanalında:

```
/setup-match
```

Bu komut:
- Canvas görselli panel oluşturur
- "Maç Oluştur" butonu ekler
- "Lobby 2 Aç/Kapat" butonu ekler
- "Lobby 3 Aç/Kapat" butonu ekler

### 4. Test Et

1. Lobi Bekleme kanalına gir
2. "Maç Oluştur" butonuna bas
3. Lobi kodu gir
4. Kaptanları seç
5. Maç başlasın

---

## 🎮 Yeni Özellikler

### Butonlu Lobi Yönetimi

**Lobby 2 Açmak:**
- Ana panelde "🔴 Lobby 2 Aç" butonuna bas
- Otomatik kategori, panel ve ses kanalı oluşur
- Buton "🟢 Lobby 2 Kapat" olur

**Lobby 2 Kapatmak:**
- "🟢 Lobby 2 Kapat" butonuna bas
- Tüm kanallar otomatik silinir
- Buton tekrar "🔴 Lobby 2 Aç" olur

### Canvas Görselli Panel

- Embed yerine profesyonel görsel
- Match numarası gösterimi
- Kaptan avatarları ve ELO bilgileri
- Modern tasarım

---

## 📊 Karşılaştırma

| Özellik | Eski Sistem | Yeni Sistem |
|---------|-------------|-------------|
| Bekleme Kanalları | 3 (her zaman) | 1 (+ 2 butonla) |
| Yönetim | Komut | Buton |
| Panel Görünümü | Embed | Canvas Görsel |
| Görsel Temizlik | ❌ Kalabalık | ✅ Temiz |
| Kullanım Kolaylığı | ⚠️ Komut gerekli | ✅ Tek tık |

---

## 🔧 Teknik Detaylar

### Yeni Dosyalar

```
custom-bot/
├── src/
│   ├── commands/
│   │   └── admin/
│   │       ├── cleanup-old-lobbies.js (YENİ)
│   │       └── lobby-manager.js (GÜNCELLENDİ)
│   ├── handlers/
│   │   ├── lobbyToggleHandler.js (YENİ)
│   │   └── match/
│   │       ├── constants.js (GÜNCELLENDİ)
│   │       └── lobby.js (GÜNCELLENDİ)
│   └── events/
│       └── interactionCreate.js (GÜNCELLENDİ)
└── LOBBY_SYSTEM.md (GÜNCELLENDİ)
```

### Config Yapısı

```javascript
// Ana lobi (her zaman aktif)
MAIN_LOBBY = {
    id: 'main',
    name: 'Ana Lobi',
    voiceId: '1463922466467483801',
    categoryId: '1463883244436197397',
    setupChannelId: '1464222855398166612'
}

// Ek lobiler (butonla aç/kapat)
ADDITIONAL_LOBBIES = {
    2: { enabled: false, ... },
    3: { enabled: false, ... }
}
```

---

## ⚠️ Önemli Notlar

1. **Eski Kanallar:** `/cleanup-old-lobbies` ile silin
2. **Aktif Maçlar:** Geçiş öncesi tüm maçları bitirin
3. **Yetki:** Sadece admin ve yetkili rol butonları kullanabilir
4. **Panel Güncelleme:** Butonlar otomatik güncellenir

---

## 🐛 Sorun Giderme

### Sorun: Butonlar çalışmıyor
**Çözüm:** Bot'u yeniden başlatın: `pm2 restart custom-bot`

### Sorun: Eski kanallar hala görünüyor
**Çözüm:** `/cleanup-old-lobbies` komutunu çalıştırın

### Sorun: Panel görseli yüklenmiyor
**Çözüm:** Canvas kütüphanesi kurulu mu kontrol edin

---

## ✅ Test Checklist

- [ ] Eski kanallar silindi
- [ ] Bot başarıyla başladı
- [ ] `/setup-match` komutu çalışıyor
- [ ] Canvas görseli görünüyor
- [ ] "Maç Oluştur" butonu çalışıyor
- [ ] "Lobby 2 Aç" butonu çalışıyor
- [ ] Lobby 2 otomatik oluşuyor
- [ ] Lobby 2 paneli canvas görselli
- [ ] "Lobby 2 Kapat" butonu çalışıyor
- [ ] Lobby 2 kanalları siliniyor
- [ ] Ana panel butonları güncelleniyor
- [ ] Tüm lobiler aynı şekilde çalışıyor

---

## 🎉 Sonuç

Yeni sistem:
- ✅ Daha temiz görünüm
- ✅ Daha kolay yönetim
- ✅ Profesyonel görsel
- ✅ Tek tıkla lobi aç/kapat
- ✅ Otomatik panel güncelleme

**Artık komut yerine buton kullanıyorsunuz!**

---

**Made with ❤️ for Nexora Community**
