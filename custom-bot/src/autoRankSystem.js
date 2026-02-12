const rankHandler = require('./handlers/rankHandler');
const config = require('./config');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

// ELO Service ile uyumlu Level Hesaplayıcı
const LEVEL_THRESHOLDS = [
    { max: 200, level: 1 }, { max: 400, level: 2 }, { max: 600, level: 3 },
    { max: 850, level: 4 }, { max: 1100, level: 5 }, { max: 1350, level: 6 },
    { max: 1650, level: 7 }, { max: 1950, level: 8 }, { max: 2300, level: 9 },
    { max: Infinity, level: 10 }
];

function calculateLevel(elo) {
    if (typeof elo !== 'number' || isNaN(elo)) elo = 200;
    for (const t of LEVEL_THRESHOLDS) {
        if (elo <= t.max) return t.level;
    }
    return 10;
}

/**
 * Background Rank Synchronizer - FULL REAL-TIME FEEDBACK
 * Ses kaydındaki isteğe göre loglar ve çalışma mantığı optimize edildi.
 */
module.exports = (client) => {
    const REQUIRED_VALORANT_ROLE = config.ROLES.VALORANT;
    const GUILD_ID = process.env.GUILD_ID;

    const LEVEL_ROLES = {
        1: '1469097452199088169', 2: '1469097453109383221', 3: '1469097454979911813',
        4: '1469097456523284500', 5: '1469097457303687180', 6: '1469097485514575895',
        7: '1469097487016132810', 8: '1469097488429355158', 9: '1469097489457090754',
        10: '1469097490824564747'
    };
    const ALL_LEVEL_ROLES = Object.values(LEVEL_ROLES);

    let isRunning = false;
    let totalScans = 0;

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;
        totalScans++;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                isRunning = false;
                return;
            }

            // 1. ÜYE LİSTESİNİ ÇEKME
            let targetRole = guild.roles.cache.get(REQUIRED_VALORANT_ROLE);

            // Periyodik olarak rolleri yenile (91 kişiyi güncel tutmak için)
            if (totalScans % 5 === 0 || !targetRole) {
                targetRole = await guild.roles.fetch(REQUIRED_VALORANT_ROLE, { force: true }).catch(() => null);
            }

            if (!targetRole) {
                logger.error(`[AutoRank] Kritik Hata: Valorant rolü (ID: ${REQUIRED_VALORANT_ROLE}) bulunamadı. Burası çok önemli.`);
                isRunning = false;
                return;
            }

            const membersWithRole = targetRole.members;

            // 2. ELO BİLGİLERİNİ ÇEK
            const memberIds = Array.from(membersWithRole.keys());
            const usersInDb = await User.find({
                odasi: { $in: memberIds },
                odaId: GUILD_ID
            }).select('odasi matchStats.elo');

            const eloMap = new Map(usersInDb.map(u => [u.odasi, u.matchStats?.elo ?? 200]));

            // 3. KONTROL
            const updates = [];
            let okCount = 0;

            for (const member of membersWithRole.values()) {
                const elo = eloMap.get(member.id) ?? 200;
                const targetLevel = calculateLevel(elo);
                const targetRoleId = LEVEL_ROLES[targetLevel];

                const hasCorrectRole = member.roles.cache.has(targetRoleId);
                const hasExtraRoles = member.roles.cache.some(r => ALL_LEVEL_ROLES.includes(r.id) && r.id !== targetRoleId);

                if (!hasCorrectRole || hasExtraRoles) {
                    updates.push({ member, targetLevel, elo });
                } else {
                    okCount++;
                }
            }

            // --- SES KAYDINDA İSTENEN DETAYLI LOGLAMA ---
            if (updates.length > 0) {
                logger.info(`[AutoRank] Tarama yapıldı: ${membersWithRole.size} oyuncu. (${okCount} Doğru Rolde | ${updates.length} Güncelleme Gerekiyor)`);

                // 4. GÜNCELLEME
                for (const update of updates) {
                    await rankHandler.syncRank(update.member, update.targetLevel);
                    // Bekleme süresi (Rate limit koruması)
                    await new Promise(r => setTimeout(r, 1200));
                }
            } else {
                // Sadece arada bir log at ki çalıştığı belli olsun ama spam yapmasın
                if (totalScans % 6 === 1) {
                    logger.success(`[AutoRank] Real-Time Kontrol: ${membersWithRole.size} oyuncunun tamamı doğru rolde. Her şey yolunda.`);
                }
            }

        } catch (error) {
            if (!error.message.includes('rate limited')) {
                logger.error(`[AutoRank Error]: ${error.message}`);
            }
        } finally {
            isRunning = false;
            // 5 saniyede bir tarama (Tam gerçek zamanlı)
            setTimeout(runSync, 5000);
        }
    };

    // İlk tarama için kısa bir bekleme
    setTimeout(runSync, 3000);
};
