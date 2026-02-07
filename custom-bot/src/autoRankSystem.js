const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

/**
 * Background Rank Synchronizer - FULL SPEED OPTIMIZED
 * Valorant rolü sahiplerini hızlıca tarar.
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

    logger.info('[AutoRank] Arka plan tarayıcı başlatıldı (Yüksek Hız Modu).');

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                isRunning = false;
                return;
            }

            // 1. Üyeleri cache'den değil, güncel olarak Discord'dan çek (Sadece Valorant rolü olanlar)
            // fetch({ withPresences: false }) API'den en güncel listeyi alır
            const members = await guild.members.fetch();
            const membersWithRole = members.filter(m => m.roles.cache.has(REQUIRED_VALORANT_ROLE));

            if (membersWithRole.size === 0) {
                isRunning = false;
                return;
            }

            // 2. DB'den toplu çek
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

            // 4. Güncellemeleri Uygula (Batch: 5'erli gruplar, daha güvenli)
            for (let i = 0; i < updates.length; i += 5) {
                const batch = updates.slice(i, i + 5);
                await Promise.all(batch.map(upd => rankHandler.syncRank(upd.member, upd.targetLevel)));
                // Rate limit koruması için her batch arası çok kısa bekle
                if (updates.length > 5) await new Promise(r => setTimeout(r, 1000));
            }

        } catch (error) {
            // console.error('[AutoRank Error]:', error);
        } finally {
            isRunning = false;
            // Bir sonraki tarama (Kullanıcı 5 sn istedi)
            setTimeout(runSync, 5000);
        }
    };

    // Bot açıldıktan sonra ilk tarama
    setTimeout(runSync, 5000);
};
