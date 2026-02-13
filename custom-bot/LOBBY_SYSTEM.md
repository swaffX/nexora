# 🎮 Dinamik Lobi Sistemi

## 📋 Genel Bakış

Yeni sistem, **tek bir ana lobi** ile başlar ve gerektiğinde **ek lobiler** açılabilir. Bu sayede Discord sunucunuz daha temiz görünür ve kanal karmaşası önlenir.

## 🏗️ Yapı

### Ana Lobi (Her Zaman Aktif)
```
📁 COMPETITIVE
  ├─ 📋 maç-panel
  ├─ 🎮 Lobi Bekleme (herkes burada)
  └─ (Dinamik maç kanalları)
     ├─ 🔴 match-1 (otomatik oluşur)
     ├─ 🔵 match-2 (otomatik oluşur)
```

### Ek Lobiler (İsteğe Bağlı)
```
📁 LOBBY 2 (admin açar)
  ├─ 📋 maç-panel-2
  └─ 🎮 Lobi 2 Bekleme

📁 LOBBY 3 (admin açar)
  ├─ 📋 maç-panel-3
  └─ 🎮 Lobi 3 Bekleme
```

---

## 🚀 Kullanım

### 1. Ana Lobi Kurulumu (İlk Kurulum)

Admin olarak:
```
/setup-match
```
Bu komut sadece **ana lobi panel kanalında** çalışır ve maç oluşturma panelini kurar.

### 2. Ek Lobi Açma (Yoğunlukta)

Sunucu yoğunken ek lobiler açabilirsiniz:

```
/lobby-manager enable lobby:2
```
veya
```
/lobby-manager enable lobby:3
```

Bu komut:
- Yeni bir kategori oluşturur
- Maç panel kanalı oluşturur
- Bekleme ses kanalı oluşturur
- Otomatik panel mesajını gönderir

### 3. Ek Lobi Kapatma

Yoğunluk azaldığında:

```
/lobby-manager disable lobby:2
```

Bu komut:
- Kategoriyi ve tüm kanalları siler
- Lobi'yi devre dışı bırakır

### 4. Lobi Durumunu Kontrol Etme

```
/lobby-manager status
```

Tüm lobilerin durumunu gösterir:
- Ana Lobi (her zaman aktif)
- Lobby 2 (aktif/kapalı)
- Lobby 3 (aktif/kapalı)

---

## 🎯 Kullanıcı Deneyimi

### Oyuncu Perspektifi

1. **Lobi Bekleme** kanalına girer
2. **#maç-panel** kanalından "Maç Oluştur" butonuna basar
3. Valorant lobi kodunu girer
4. Kaptanları seçer
5. Draft başlar
6. Maç biter, otomatik olarak tekrar **Lobi Bekleme** kanalına döner

### Çoklu Maç Senaryosu

**20 Kişi Varsa:**
- 10 kişi → Maç #1 oluşturur
- Diğer 10 kişi → Maç #2 oluşturur
- Her iki maç da aynı anda oynanır
- Maç kanalları otomatik oluşur ve biter

**Çakışma Önleme:**
- Bot, aktif maçtaki oyuncuları filtreler
- Sadece müsait oyuncular yeni maç oluşturabilir

---

## ⚙️ Teknik Detaylar

### Config Yapısı

```javascript
// Ana lobi (her zaman aktif)
MAIN_LOBBY = {
    id: 'main',
    name: 'Ana Lobi',
    voiceId: '...',
    categoryId: '...',
    setupChannelId: '...'
}

// Ek lobiler (dinamik)
ADDITIONAL_LOBBIES = {
    2: { enabled: false, ... },
    3: { enabled: false, ... }
}
```

### Lobi ID Kullanımı

- **Ana Lobi:** `'main'` veya `1`
- **Ek Lobiler:** `2`, `3`

### Veritabanı

Match modeli `lobbyId` alanını kullanır:
```javascript
{
    lobbyId: 'main', // veya '2', '3'
    matchNumber: 1,
    ...
}
```

---

## 🔧 Özelleştirme

### Lobi Sayısını Artırma

`constants.js` dosyasında:

```javascript
ADDITIONAL_LOBBIES = {
    2: { ... },
    3: { ... },
    4: { ... }, // Yeni lobi ekle
    5: { ... }
}
```

`lobby-manager.js` komutunda choices güncelle:

```javascript
.addChoices(
    { name: 'Lobby 2', value: 2 },
    { name: 'Lobby 3', value: 3 },
    { name: 'Lobby 4', value: 4 },
    { name: 'Lobby 5', value: 5 }
)
```

---

## 📝 Notlar

- **Ana lobi** her zaman aktiftir, kapatılamaz
- **Ek lobiler** sadece admin tarafından açılabilir
- Kapalı bir lobide maç oluşturulamaz
- Lobi kapatıldığında tüm kanallar otomatik silinir
- Aktif maçlar varken lobi kapatılmamalıdır

---

## 🐛 Sorun Giderme

### "Lobi kapalı" hatası
- Admin `/lobby-manager enable` ile lobi'yi açmalı

### Kanal oluşturulamıyor
- Bot'un `Manage Channels` yetkisi olmalı
- Kategori 50 kanal limitine ulaşmış olabilir

### Oyuncular taşınamıyor
- Bot'un `Move Members` yetkisi olmalı

---

## 🎉 Avantajlar

✅ Temiz Discord görünümü (3 yerine 1 bekleme kanalı)
✅ Dinamik ölçeklenebilirlik (ihtiyaç olunca aç)
✅ Kaynak tasarrufu (kullanılmayan kanallar yok)
✅ Kolay yönetim (tek komutla aç/kapat)
✅ Çakışma önleme (aktif oyuncular filtrelenir)

---

**Made with ❤️ for Nexora Community**
