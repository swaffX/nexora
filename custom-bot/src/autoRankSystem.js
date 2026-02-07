const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

// ELO Service'deki getLevelFromElo mantığını buraya taşıyoruz ki veritabanına bağımlı kalmayalım
const ELO_CONFIG = {
    LEVEL_THRESHOLDS: [
        { max: 200, level: 1 }, { max: 400, level: 2 }, { max: 600, level: 3 },
        { max: 850, level: 4 }, { max: 1100, level: 5 }, { max: 1350, level: 6 },
        { max: 1650, level: 7 }, { max: 1950, level: 8 }, { max: 2300, level: 9 },
        { max: Infinity, level: 10 }
    ]
};

function calculateLevel(elo) {
    if (typeof elo !== 'number' || isNaN(elo)) elo = 200;
    for (const t of ELO_CONFIG.LEVEL_THRESHOLDS) {
        if (elo <= t.max) return t.level;
    }
    return 10;
}

/**
 * Background Rank Synchronizer - ELO BASED CALCULATION
 */
module.exports = (client) => {
    const REQUIRED_VALORANT_ROLE = '1466189076347486268';
    const GUILD_ID = process.env.GUILD_ID;
    const LEVEL_ROLES = {
        1: '1469097452199088169', 2: '1469097453109383221', 3: '1469097454979911813',
        4: '1469097456523284500', 5: '1469097457303687180', 6: '1469097485514575895',
        7: '1469097487016132810', 8: '1469097488429355158', 9: '1469097489457090754',
        10: '1469097490824564747'
    };
    const ALL_LEVEL_ROLES = Object.values(LEVEL_ROLES);

    let isRunning = false;

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                isRunning = false;
                return;
            }

            // 1. Role sahip olanları çek (Cache'i zorla tazele)
            const membersWithRole = await guild.members.fetch({ role: REQUIRED_VALORANT_ROLE, force: true }).catch(() => null);
            if (!membersWithRole || membersWithRole.size === 0) {
                isRunning = false;
                return;
            }

            // 2. DB'den ELO bilgisini çek (Level bilgisini değil)
            const memberIds = Array.from(membersWithRole.keys());
            const usersInDb = await User.find({
                odasi: { $in: memberIds },
                odaId: GUILD_ID
            }).select('odasi matchStats.elo');

            // Kullanıcı ID -> Gerçek Level haritası oluştur
            const levelMap = new Map();
            usersInDb.forEach(u => {
                const elo = u.matchStats?.elo ?? 200;
                const realLevel = calculateLevel(elo);
                levelMap.set(u.odasi, realLevel);
            });

            // 3. Değişiklik Gerekenleri Ayıkla
            const updates = [];
            for (const member of membersWithRole.values()) {
                if (levelMap.has(member.id)) {
                    const targetLevel = levelMap.get(member.id);
                    const targetRoleId = LEVEL_ROLES[targetLevel];

                    const hasCorrectRole = member.roles.cache.has(targetRoleId);
                    const hasExtraRoles = member.roles.cache.some(r => ALL_LEVEL_ROLES.includes(r.id) && r.id !== targetRoleId);

                    if (!hasCorrectRole || hasExtraRoles) {
                        updates.push({ member, targetLevel });
                    }
                }
            }

            if (updates.length > 0) {
                logger.info(`[AutoRank] ELO'ya göre hesaplanan ${updates.length} güncelleme uygulanıyor...`);
                for (let i = 0; i < updates.length; i += 5) {
                    const batch = updates.slice(i, i + 5);
                    await Promise.all(batch.map(upd => rankHandler.syncRank(upd.member, upd.targetLevel)));
                    await new Promise(r => setTimeout(r, 1000));
                }
            } else {
                // logger.info('[AutoRank] Tüm roller ELO değerlerine göre güncel.');
            }

        } catch (error) {
            // Hata yönetimi
        } finally {
            isRunning = false;
            setTimeout(runSync, 5000); // 5 saniyede bir normal döngü
        }
    };

    setTimeout(runSync, 3000);
};
