const rankHandler = require('./handlers/rankHandler');
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
 * Background Rank Synchronizer - ROLE MEMBER ONLY FIX
 */
module.exports = (client) => {
    const REQUIRED_VALORANT_ROLE = '1466189076347486268';
    const GUILD_ID = process.env.GUILD_ID;

    // Rollerin ID haritası
    const LEVEL_ROLES = {
        1: '1469097452199088169', 2: '1469097453109383221', 3: '1469097454979911813',
        4: '1469097456523284500', 5: '1469097457303687180', 6: '1469097485514575895',
        7: '1469097487016132810', 8: '1469097488429355158', 9: '1469097489457090754',
        10: '1469097490824564747'
    };
    const ALL_LEVEL_ROLES = Object.values(LEVEL_ROLES);

    let isRunning = false;

    logger.info('[AutoRank] Sistem başlatıldı. Döngü: 5 sn.');

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                isRunning = false;
                return;
            }

            // 1. ÖNCE ROLÜ BUL (Cache'den değil, gerekirse fetch et)
            let targetRole = guild.roles.cache.get(REQUIRED_VALORANT_ROLE);

            // Eğer rol cache'de yoksa veya üyeleri eksik görünüyorsa, rolü ve üyelerini fetch et (ZORUNLU)
            // Bu işlem tüm sunucuyu değil, sadece o rolü ve üyelerini yeniler.
            await guild.members.fetch();
            targetRole = guild.roles.cache.get(REQUIRED_VALORANT_ROLE);

            if (!targetRole) {
                logger.error(`[AutoRank] HATA: ${REQUIRED_VALORANT_ROLE} ID'li rol bulunamadı!`);
                isRunning = false;
                return;
            }

            // 2. SADECE BU ROLDEKİ ÜYELERİ LİSTELE (Kesin Çözüm)
            const membersWithRole = targetRole.members;

            // Her 5 saniyede log atıp kafa karıştırmasın, sadece sayı değişirse veya ilk açılışta yazsın
            // Ama şimdilik emin olmak için logluyorum
            // logger.info(`[AutoRank] Valorant Rolü Üye Sayısı: ${membersWithRole.size}`);

            if (membersWithRole.size === 0) {
                isRunning = false;
                return;
            }

            // 3. ELO BİLGİLERİNİ ÇEK
            const memberIds = Array.from(membersWithRole.keys());
            const usersInDb = await User.find({
                odasi: { $in: memberIds },
                odaId: GUILD_ID
            }).select('odasi matchStats.elo');

            const eloMap = new Map();
            usersInDb.forEach(u => eloMap.set(u.odasi, u.matchStats?.elo ?? 200));

            // 4. KONTROL VE LİSTELEME
            const updates = [];
            for (const member of membersWithRole.values()) {
                const elo = eloMap.get(member.id) ?? 200;

                const targetLevel = calculateLevel(elo);
                const targetRoleId = LEVEL_ROLES[targetLevel];

                const hasCorrectRole = member.roles.cache.has(targetRoleId);
                const hasExtraRoles = member.roles.cache.some(r => ALL_LEVEL_ROLES.includes(r.id) && r.id !== targetRoleId);

                if (!hasCorrectRole || hasExtraRoles) {
                    updates.push({ member, targetLevel });
                }
            }

            // 5. UYGULAMA
            if (updates.length > 0) {
                logger.info(`[AutoRank] ${membersWithRole.size} kişiden ${updates.length} tanesinin rolü güncelleniyor...`);

                for (const update of updates) {
                    await rankHandler.syncRank(update.member, update.targetLevel);
                    // Discord'u yormamak için minik bekleme
                    await new Promise(r => setTimeout(r, 250));
                }
            }

        } catch (error) {
            logger.error(`[AutoRank Error]: ${error.message}`);
        } finally {
            isRunning = false;
            setTimeout(runSync, 5000);
        }
    };

    setTimeout(runSync, 3000);
};
