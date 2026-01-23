const path = require('path');
const User = require(path.join(__dirname, '..', '..', '..', 'shared', 'models', 'User'));

// GÖREV TANIMLARI
const QUESTS = {
    'work_2': { description: '2 kere çalış', target: 2, reward: 500, type: 'work' },
    'gamble_5': { description: '5 kere kumar oyna (Coinflip/Slot)', target: 5, reward: 750, type: 'gamble' },
    'win_duel_1': { description: '1 Düello kazan', target: 1, reward: 1000, type: 'duel_win' },
    'buy_item_3': { description: 'Marketten 3 eşya al', target: 3, reward: 400, type: 'buy' },
    'voice_30': { description: 'Ses kanalında 30 dk dur', target: 1800, reward: 600, type: 'voice' }, // Saniye bazlı (30dk * 60)
    'daily_1': { description: 'Günlük ödülü al', target: 1, reward: 200, type: 'daily' }
};

// BAŞARIM TANIMLARI
const ACHIEVEMENTS = {
    'gambler': { name: '🎰 Kumarbaz', description: 'Toplam 100 bahis oyna.', condition: (stats) => stats.totalBets >= 100 },
    'rich': { name: '💸 Milyoner', description: 'Cüzdanında 1 Milyon coin olsun.', condition: (stats, balance) => balance >= 1000000 },
    'worker': { name: '🛠️ Emektar', description: '50 kere çalış.', condition: (stats) => stats.totalWork >= 50 },
    'duelist': { name: '⚔️ Gladyatör', description: '10 Düello kazan.', condition: (stats) => stats.totalDuelsWon >= 10 },
    'pet_lover': { name: '🐾 Hayvan Dostu', description: 'Petini 5. seviyeye yükselt.', condition: (stats) => stats.totalPetUpgrades >= 5 }
};

// Görev İlerlemesi Güncelleme Helper
async function updateQuestProgress(userParam, type, amount = 1) {
    try {
        // En güncel veriyi veritabanından çek (Sync sorununu önler)
        const user = await User.findOne({ odasi: userParam.odasi, odaId: userParam.odaId });
        if (!user) return [];

        let updated = false;

        // Quests array kontrolü
        if (!user.quests) user.quests = [];
        if (!user.stats) user.stats = {};
        if (!user.achievements) user.achievements = [];

        // Görevleri Güncelle
        user.quests.forEach(quest => {
            const qDef = QUESTS[quest.questId];
            if (qDef && qDef.type === type && !quest.isCompleted) {
                quest.progress += amount;
                if (quest.progress >= quest.target) {
                    quest.progress = quest.target;
                    quest.isCompleted = true;

                    // Ödülü otomatik ver
                    user.balance += qDef.reward;
                    updated = true;
                }
            }
        });

        // İstatistik Güncelleme
        if (type === 'work') user.stats.totalWork = (user.stats.totalWork || 0) + amount;
        if (type === 'gamble') user.stats.totalBets = (user.stats.totalBets || 0) + amount;
        if (type === 'duel_win') user.stats.totalDuelsWon = (user.stats.totalDuelsWon || 0) + amount;
        if (type === 'buy') user.stats.totalPetUpgrades = (user.stats.totalPetUpgrades || 0) + amount;
        if (type === 'voice') user.stats.totalVoiceMinutes = (user.stats.totalVoiceMinutes || 0) + amount;

        // Başarım Kontrolü
        const newAchievements = [];
        for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
            if (!user.achievements.some(a => a.id === id)) {
                // Güvenlik için fallback değerler
                const stats = user.stats || {};
                const bal = user.balance || 0;

                if (ach.condition(stats, bal)) {
                    user.achievements.push({ id, unlockedAt: new Date() });
                    newAchievements.push(ach.name);
                }
            }
        }

        // Mongoose'a değişiklikleri bildir
        user.markModified('quests');
        user.markModified('stats');
        user.markModified('achievements');

        await user.save();
        return newAchievements;
    } catch (error) {
        console.error('Quest Update Error:', error);
        return [];
    }
}

// Rastgele 3 Görev Seç
function generateDailyQuests() {
    const keys = Object.keys(QUESTS);
    const shuffled = keys.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3).map(id => ({
        questId: id,
        progress: 0,
        target: QUESTS[id].target,
        isCompleted: false,
        isClaimed: false
    }));
}

module.exports = { QUESTS, ACHIEVEMENTS, updateQuestProgress, generateDailyQuests };
