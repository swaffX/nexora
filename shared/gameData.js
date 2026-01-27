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
        price: 500,
        sellPrice: 100,
        type: ItemType.BOX,
        rarity: Rarity.COMMON,
        drops: {
            minCoins: 100, maxCoins: 500,
            items: [
                { id: 'plastic_bottle', weight: 40 },
                { id: 'old_boot', weight: 40 },
                { id: 'stick', weight: 15 },
                { id: 'stone', weight: 5 }
            ]
        }
    },
    'metal_box': {
        id: 'metal_box',
        name: 'Metal Kutu',
        emoji: '🧰',
        description: 'Sağlam bir kutu. Sanayi tipi eşyalar içerir.',
        price: 1500,
        sellPrice: 400,
        type: ItemType.BOX,
        rarity: Rarity.UNCOMMON,
        drops: {
            minCoins: 500, maxCoins: 1500,
            items: [
                { id: 'copper_wire', weight: 50 },
                { id: 'iron', weight: 30 },
                { id: 'chip', weight: 15 },
                { id: 'robo_dog', weight: 5 }
            ]
        }
    },
    'golden_box': {
        id: 'golden_box',
        name: 'Altın Kutu',
        emoji: '🎁',
        description: 'Parıltılı eşyalar ve değerli metaller içerir.',
        price: 5000,
        sellPrice: 1500,
        type: ItemType.BOX,
        rarity: Rarity.EPIC,
        drops: {
            minCoins: 2000, maxCoins: 5000,
            items: [
                { id: 'gold_bar', weight: 40 },
                { id: 'diamond', weight: 20 },
                { id: 'chip', weight: 20 },
                { id: 'mk1_drone', weight: 10 },
                { id: 'ring', weight: 10 }
            ]
        }
    },
    'crypto_box': {
        id: 'crypto_box',
        name: 'Kripto Sandığı',
        emoji: '💾',
        description: 'İçinde ileri teknoloji parçalar bulunan şifreli sandık.',
        price: 15000,
        sellPrice: 5000,
        type: ItemType.BOX,
        rarity: Rarity.LEGENDARY,
        drops: {
            minCoins: 5000, maxCoins: 15000,
            items: [
                { id: 'gpu', weight: 40 },
                { id: 'quantum_core', weight: 10 },
                { id: 'cyber_cat', weight: 20 },
                { id: 'battle_bot', weight: 5 },
                { id: 'diamond', weight: 25 }
            ]
        }
    },

    // --- EŞYALAR ---
    // Çöpler (Common)
    'plastic_bottle': { id: 'plastic_bottle', name: 'Plastik Şişe', emoji: '🥤', price: 0, sellPrice: 5, type: ItemType.COLLECTIBLE, rarity: Rarity.COMMON },
    'old_boot': { id: 'old_boot', name: 'Eski Bot', emoji: '🥾', price: 0, sellPrice: 5, type: ItemType.COLLECTIBLE, rarity: Rarity.COMMON },
    'stick': { id: 'stick', name: 'Çöp Dal', emoji: '🪵', price: 0, sellPrice: 10, type: ItemType.COLLECTIBLE, rarity: Rarity.COMMON },
    'stone': { id: 'stone', name: 'Çakıl Taşı', emoji: '🪨', price: 0, sellPrice: 20, type: ItemType.COLLECTIBLE, rarity: Rarity.COMMON },

    // Malzemeler (Uncommon)
    'copper_wire': { id: 'copper_wire', name: 'Bakır Kablo', emoji: '🧶', price: 0, sellPrice: 100, type: ItemType.COLLECTIBLE, rarity: Rarity.UNCOMMON },
    'iron': { id: 'iron', name: 'Demir Parçası', emoji: '🔩', price: 0, sellPrice: 150, type: ItemType.COLLECTIBLE, rarity: Rarity.UNCOMMON },

    // Teknoloji (Rare)
    'chip': { id: 'chip', name: 'Mikroçip', emoji: '💾', price: 0, sellPrice: 800, type: ItemType.COLLECTIBLE, rarity: Rarity.RARE },
    'gold_bar': { id: 'gold_bar', name: 'Külçe Altın', emoji: '🧈', price: 0, sellPrice: 1200, type: ItemType.COLLECTIBLE, rarity: Rarity.RARE },

    // Değerli (Epic)
    'gpu': { id: 'gpu', name: 'Ekran Kartı', emoji: '📼', price: 0, sellPrice: 4000, type: ItemType.COLLECTIBLE, rarity: Rarity.EPIC },
    'diamond': { id: 'diamond', name: 'Elmas', emoji: '💎', price: 0, sellPrice: 3500, type: ItemType.COLLECTIBLE, rarity: Rarity.EPIC },

    // Efsane (Legendary - Mythic)
    'ring': { id: 'ring', name: 'Nişan Yüzüğü', emoji: '💍', price: 0, sellPrice: 6000, type: ItemType.COLLECTIBLE, rarity: Rarity.LEGENDARY },
    'quantum_core': { id: 'quantum_core', name: 'Kuantum Çekirdeği', emoji: '⚛️', price: 0, sellPrice: 15000, type: ItemType.COLLECTIBLE, rarity: Rarity.MYTHIC },
    'crown': { id: 'crown', name: 'Kral Tacı', emoji: '👑', price: 0, sellPrice: 30000, type: ItemType.COLLECTIBLE, rarity: Rarity.MYTHIC },
};

module.exports = { ITEMS, ItemType, Rarity };
