const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

/**
 * Background Rank Synchronizer - RATE LIMIT FRIENDLY
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

    logger.info('[AutoRank] Arka plan tarayıcı başlatıldı (Rate-Limit Korumalı).');

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;
        scanCount++;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                isRunning = false;
                return;
            }

            // --- RATE LIMIT ÇÖZÜMÜ ---
            // Tüm sunucuyu çekmek yerine sadece o role sahip olanları çekiyoruz
            // Bu yöntem API'yi yormaz ve rate limit yemez.
            const membersWithRole = await guild.members.fetch({ role: REQUIRED_VALORANT_ROLE }).catch(e => {
                if (e.message.includes('rate limited')) {
                    // Sessizce bekle, bir sonraki turda deneriz
                }
                return null;
            });

            if (!membersWithRole || membersWithRole.size === 0) {
                isRunning = false;
                return;
            }

            if (scanCount % 6 === 1) {
                logger.info(`[AutoRank] Tarama: ${membersWithRole.size} Valorant oyuncusu inceleniyor.`);
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

                for (let i = 0; i < updates.length; i += 3) { // Batch boyutunu küçülttük (3)
                    const batch = updates.slice(i, i + 3);
                    await Promise.all(batch.map(upd => rankHandler.syncRank(upd.member, upd.targetLevel)));
                    // Her batch arası 1.5 saniye bekle (Tam güvenlik)
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

        } catch (error) {
            // Hata logunu sadece kritikse yaz
            if (!error.message.includes('rate limited')) {
                logger.error(`[AutoRank Error]: ${error.message}`);
            }
        } finally {
            isRunning = false;
            setTimeout(runSync, 5000);
        }
    };

    setTimeout(runSync, 2000);
};
