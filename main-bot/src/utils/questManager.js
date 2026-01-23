// GÖREV TANIMLARI
const QUESTS = {
    'work_2': { description: '2 kere çalış', target: 2, reward: 500, type: 'work' },
    'gamble_5': { description: '5 kere kumar oyna (Coinflip/Slot)', target: 5, reward: 750, type: 'gamble' },
    'win_duel_1': { description: '1 Düello kazan', target: 1, reward: 1000, type: 'duel_win' },
    'buy_item_3': { description: 'Marketten 3 eşya al', target: 3, reward: 400, type: 'buy' },
    'voice_30': { description: 'Ses kanalında 30 dk dur', target: 30, reward: 600, type: 'voice' }, // Dakika bazlı değil, count bazlı şimdilik
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
async function updateQuestProgress(user, type, amount = 1) {
    let updated = false;
    user.quests.forEach(quest => {
        const qDef = QUESTS[quest.questId];
        if (qDef && qDef.type === type && !quest.isCompleted) {
            quest.progress += amount;
            if (quest.progress >= quest.target) {
                quest.progress = quest.target;
                quest.isCompleted = true;
                // Ödül burada verilmiyor, /quests claim ile verilecek veya otomatik verilebilir.
                // Otomatik verelim:
                user.balance += qDef.reward;
                updated = true; // Bildirim verilebilir
            }
        }
    });

    // İstatistik Güncelleme (Basit map)
    if (type === 'work') user.stats.totalWork += amount;
    if (type === 'gamble') user.stats.totalBets += amount;
    if (type === 'duel_win') user.stats.totalDuelsWon += amount;
    if (type === 'buy') user.stats.totalPetUpgrades += amount; // Örnek

    // Başarım Kontrolü
    const newAchievements = [];
    for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
        if (!user.achievements.some(a => a.id === id)) {
            if (ach.condition(user.stats, user.balance)) {
                user.achievements.push({ id });
                newAchievements.push(ach.name);
            }
        }
    }

    user.markModified('quests');
    user.markModified('stats');
    user.markModified('achievements');

    await user.save();
    return newAchievements; // Yeni kazanılan başarımları döndür
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
