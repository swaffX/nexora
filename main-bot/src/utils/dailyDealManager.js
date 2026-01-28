const path = require('path');
const { ITEMS } = require(path.join(__dirname, '..', '..', '..', 'shared', 'gameData'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

let currentDeal = null;

function generateDailyDeal() {
    // Sadece satılabilir ürünleri al
    const saleItems = Object.values(ITEMS).filter(i => i.price > 0 && i.price < 100000);

    if (saleItems.length === 0) return null;

    const randomItem = saleItems[Math.floor(Math.random() * saleItems.length)];

    // Rastgele indirim oranı (%30 - %60)
    const discountRate = (Math.floor(Math.random() * 30) + 30) / 100;
    const salePrice = Math.floor(randomItem.price * (1 - discountRate));

    currentDeal = {
        itemId: randomItem.id,
        name: randomItem.name,
        emoji: randomItem.emoji,
        originalPrice: randomItem.price,
        salePrice: salePrice,
        discountPercent: Math.floor(discountRate * 100),
        stock: Math.floor(Math.random() * 5) + 3, // 3-7 Stok
        expiresAt: new Date(Date.now() + 86400000) // 24 Saat geçerli
    };

    logger.info(`[DailyDeal] Yeni Fırsat: ${currentDeal.name} - ${currentDeal.salePrice} (Eskisi: ${currentDeal.originalPrice})`);
    return currentDeal;
}

function getDailyDeal() {
    if (!currentDeal || new Date() > currentDeal.expiresAt) {
        return generateDailyDeal();
    }
    return currentDeal;
}

function decreaseStock(amount = 1) {
    if (currentDeal) {
        currentDeal.stock -= amount;
        // Stok bitince null yapmıyoruz ki "Tükendi" yazabilelim, expire olana kadar kalsın veya yenisini oluşturmayalım
        if (currentDeal.stock < 0) currentDeal.stock = 0;
    }
}

// Botu yeniden başlatınca çalışması için
generateDailyDeal();

module.exports = { getDailyDeal, decreaseStock };
