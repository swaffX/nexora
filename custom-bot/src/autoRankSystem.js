const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

/**
 * Background Rank Synchronizer - OPTIMIZED
 */
module.exports = (client) => {
    const REQUIRED_VALORANT_ROLE = '1466189076347486268';
    const GUILD_ID = process.env.GUILD_ID;
    const LEVEL_ROLES = {
        1: '1469097452199088169',
        2: '1469097453109383221',
        3: '1469097454979911813',
        4: '1469097456523284500',
        5: '1469097457303687180',
        6: '1469097485514575895',
        7: '1469097487016132810',
        8: '1469097488429355158',
        9: '1469097489457090754',
        10: '1469097490824564747'
    };
    const ALL_LEVEL_ROLES = Object.values(LEVEL_ROLES);

    let isRunning = false;

    logger.info('[AutoRank] Arka plan rank senkronizasyonu başlatıldı (Hızlı & Optimize).');

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                isRunning = false;
                return;
            }

            // 1. Role sahip olanları cache'den filtrele
            const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(REQUIRED_VALORANT_ROLE));
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

            // 3. Değişiklik gerekenleri tespit et (HIZLI KONTROL)
            const tasks = [];
            for (const member of membersWithRole.values()) {
                const targetLevel = usersMap.get(member.id) || 1;
                const targetRoleId = LEVEL_ROLES[targetLevel];

                // Kontrol: Zaten doğru rolde mi? VE üzerinde başka level rolü var mı?
                const hasTarget = member.roles.cache.has(targetRoleId);
                const hasOthers = member.roles.cache.some(r => ALL_LEVEL_ROLES.includes(r.id) && r.id !== targetRoleId);

                if (!hasTarget || hasOthers) {
                    // Sadece değişiklik gerekiyorsa syncRank çağır
                    tasks.push(rankHandler.syncRank(member, targetLevel));
                }

                // Batching: Discord API'yi korumak için (Her batch sonrası kısa bekleme)
                if (tasks.length >= 10) {
                    await Promise.all(tasks.map(t => t.catch(() => { })));
                    tasks.length = 0;
                    await new Promise(r => setTimeout(r, 200));
                }
            }

            if (tasks.length > 0) {
                await Promise.all(tasks.map(t => t.catch(() => { })));
            }

        } catch (error) {
            // console.error('[AutoRank Error]:', error);
        } finally {
            isRunning = false;
            // Bir sonraki taramayı planla
            setTimeout(runSync, 5000);
        }
    };

    // İlk çalıştırma
    setTimeout(runSync, 2000);
};
