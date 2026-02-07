const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

/**
 * Background Rank Synchronizer - FULL VISIBILITY MODE
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
    let scanCount = 0;

    logger.info('[AutoRank] Arka plan tarayıcı başlatıldı.');

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;
        scanCount++;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                logger.error(`[AutoRank] Kritik Hata: Sunucu bulunamadı! ID: ${GUILD_ID}`);
                isRunning = false;
                return;
            }

            // 1. Üyeleri çek
            const members = await guild.members.fetch();
            const membersWithRole = members.filter(m => m.roles.cache.has(REQUIRED_VALORANT_ROLE));

            // Bilgilendirme Logu
            if (scanCount % 6 === 1) {
                logger.info(`[AutoRank] Tarama: ${membersWithRole.size} Valorant oyuncusu inceleniyor.`);
            }

            if (membersWithRole.size === 0) {
                isRunning = false;
                return;
            }

            // 2. DB'den verileri çek
            const memberIds = Array.from(membersWithRole.keys());
            const usersInDb = await User.find({
                odasi: { $in: memberIds },
                odaId: GUILD_ID
            }).select('odasi matchStats.matchLevel');

            const usersMap = new Map(usersInDb.map(u => [u.odasi, u.matchStats?.matchLevel || 1]));

            // 3. Değişiklik Gerekenleri Ayıkla
            const updates = [];
            for (const member of membersWithRole.values()) {
                const targetLevel = usersMap.get(member.id) || 1;
                const targetRoleId = LEVEL_ROLES[targetLevel];

                const hasCorrectRole = member.roles.cache.has(targetRoleId);
                const hasExtraRoles = member.roles.cache.some(r => ALL_LEVEL_ROLES.includes(r.id) && r.id !== targetRoleId);

                if (!hasCorrectRole || hasExtraRoles) {
                    updates.push({ member, targetLevel });
                }
            }

            if (updates.length > 0) {
                logger.info(`[AutoRank] ${updates.length} oyuncunun rolü güncelleniyor...`);

                for (let i = 0; i < updates.length; i += 5) {
                    const batch = updates.slice(i, i + 5);
                    await Promise.all(batch.map(upd => rankHandler.syncRank(upd.member, upd.targetLevel)));
                    if (updates.length > 5) await new Promise(r => setTimeout(r, 1000));
                }
            } else if (scanCount === 1) {
                logger.success('[AutoRank] İlk tarama tamamlandı: Tüm roller güncel!');
            }

        } catch (error) {
            logger.error(`[AutoRank Error]: ${error.message}`);
        } finally {
            isRunning = false;
            setTimeout(runSync, 5000);
        }
    };

    // Bot açıldıktan 2 saniye sonra ilk tarama
    setTimeout(runSync, 2000);
};
