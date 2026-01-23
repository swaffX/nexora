// Eşya Nadirlikleri ve Renkleri
const Rarity = {
    COMMON: { name: 'Yaygın', color: '#95a5a6', emoji: '⚪' },
    UNCOMMON: { name: 'Nadir', color: '#2ecc71', emoji: 'Dg' },
    RARE: { name: 'Eşsiz', color: '#3498db', emoji: '🔵' },
    EPIC: { name: 'Destansı', color: '#9b59b6', emoji: '🟣' },
    LEGENDARY: { name: 'Efsanevi', color: '#f1c40f', emoji: '🟡' },
    MYTHIC: { name: 'Mistik', color: '#e74c3c', emoji: '🔴' }
};

// Eşya Tipleri
const ItemType = {
    COLLECTIBLE: 'collectible', // Satılabilir eşya
    BOX: 'box',                 // Açılabilir kutu
    USEABLE: 'useable',         // Kullanılabilir
    PET: 'pet'                  // Yoldaş
};

const ITEMS = {
    // --- PETLER ---
    'robo_dog': { id: 'robo_dog', name: 'Robo-Köpek', emoji: '🐕‍🦺', price: 5000, sellPrice: 2000, type: ItemType.PET, rarity: Rarity.UNCOMMON, bonus: { type: 'xp', amount: 5 } }, // %5 XP Boost
    'mk1_drone': { id: 'mk1_drone', name: 'MK-1 Drone', emoji: '🛸', price: 10000, sellPrice: 4000, type: ItemType.PET, rarity: Rarity.RARE, bonus: { type: 'money', amount: 5 } }, // %5 Work Money
    'cyber_cat': { id: 'cyber_cat', name: 'Siber Kedi', emoji: '🐈', price: 15000, sellPrice: 6000, type: ItemType.PET, rarity: Rarity.EPIC, bonus: { type: 'luck', amount: 5 } }, // %5 Drop Luck
    'battle_bot': { id: 'battle_bot', name: 'Savaş Botu', emoji: '🤖', price: 50000, sellPrice: 20000, type: ItemType.PET, rarity: Rarity.LEGENDARY, bonus: { type: 'attack', amount: 10 } }, // Arena Bonus

    // --- KUTULAR ---
    'wooden_box': {
        id: 'wooden_box',
        name: 'Ahşap Kutu',
        emoji: '📦',
        description: 'İçinden başlangıç seviyesi eşyalar çıkar.',
        price: 500, // Market değeri (alış)
        sellPrice: 100,
        type: ItemType.BOX,
        rarity: Rarity.COMMON,
        // Kutu İçeriği: { itemId: şans_yüzdesi } (Toplam 100 olmak zorunda değil, ağırlık sistemi)
        drops: {
            minCoins: 100,
            maxCoins: 500,
            items: [
                { id: 'stick', weight: 50 },
                { id: 'stone', weight: 40 },
                { id: 'iron', weight: 5 },
                { id: 'robo_dog', weight: 5 } // Pet çıkma şansı!
            ]
        }
    },
    'golden_box': {
        id: 'golden_box',
        name: 'Altın Kutu',
        emoji: '🎁',
        description: 'Parıltılı eşyalar içerir.',
        price: 2500,
        sellPrice: 500,
        type: ItemType.BOX,
        rarity: Rarity.EPIC,
        drops: {
            minCoins: 1000,
            maxCoins: 3000,
            items: [
                { id: 'gold_bar', weight: 40 },
                { id: 'diamond', weight: 20 },
                { id: 'ring', weight: 10 },
                { id: 'crown', weight: 5 },
                { id: 'mk1_drone', weight: 5 } // Drone şansı
            ]
        }
    },

    // --- EŞYALAR ---
    'stick': { id: 'stick', name: 'Çöp Dal', emoji: '🪵', price: 0, sellPrice: 10, type: ItemType.COLLECTIBLE, rarity: Rarity.COMMON },
    'stone': { id: 'stone', name: 'Çakıl Taşı', emoji: '🪨', price: 0, sellPrice: 25, type: ItemType.COLLECTIBLE, rarity: Rarity.COMMON },
    'iron': { id: 'iron', name: 'Demir Parçası', emoji: '🔩', price: 0, sellPrice: 150, type: ItemType.COLLECTIBLE, rarity: Rarity.UNCOMMON },

    'gold_bar': { id: 'gold_bar', name: 'Külçe Altın', emoji: '🧈', price: 0, sellPrice: 1000, type: ItemType.COLLECTIBLE, rarity: Rarity.RARE },
    'diamond': { id: 'diamond', name: 'Elmas', emoji: '💎', price: 0, sellPrice: 3000, type: ItemType.COLLECTIBLE, rarity: Rarity.EPIC },
    'ring': { id: 'ring', name: 'Nişan Yüzüğü', emoji: '💍', price: 0, sellPrice: 5000, type: ItemType.COLLECTIBLE, rarity: Rarity.LEGENDARY },

    'crown': { id: 'crown', name: 'Kral Tacı', emoji: '👑', price: 0, sellPrice: 25000, type: ItemType.COLLECTIBLE, rarity: Rarity.MYTHIC },
};

module.exports = { ITEMS, ItemType, Rarity };
