const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

/**
 * Background Rank Synchronizer - ROLE VERIFICATION MODE
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

            // --- ROL DOĞRULAMA (Senin için ekledim) ---
            const targetRole = guild.roles.cache.get(REQUIRED_VALORANT_ROLE);
            if (targetRole) {
                // Sadece ilk seferde veya her 5 taramada bir log atalım
                logger.info(`[DEBUG] Botun baktığı Rol: "${targetRole.name}" | Toplam Üye: ${targetRole.members.size}`);
            } else {
                logger.error(`[DEBUG] KRİTİK: ID'si verilen rol sunucuda BULUNAMADI! ID: ${REQUIRED_VALORANT_ROLE}`);
            }

            // 1. Üyeleri çek (Sadece o role sahip olanları getir)
            const membersWithRole = await guild.members.fetch({ role: REQUIRED_VALORANT_ROLE }).catch(() => null);

            if (!membersWithRole || membersWithRole.size === 0) {
                isRunning = false;
                return;
            }

            // 2. DB'deki kullanıcıları al
            const memberIds = Array.from(membersWithRole.keys());
            const usersInDb = await User.find({
                odasi: { $in: memberIds },
                odaId: GUILD_ID
            }).select('odasi matchStats.matchLevel');

            const usersMap = new Map(usersInDb.map(u => [u.odasi, u.matchStats?.matchLevel || 1]));

            // 3. SADECE DB'DE OLANLARI GÜNCELLE
            const updates = [];
            for (const member of membersWithRole.values()) {
                // Sadece veritabanında kaydı olanları (maç oynamışları) incele
                if (usersMap.has(member.id)) {
                    const targetLevel = usersMap.get(member.id);
                    const targetRoleId = LEVEL_ROLES[targetLevel];

                    const hasCorrectRole = member.roles.cache.has(targetRoleId);
                    const hasExtraRoles = member.roles.cache.some(r => ALL_LEVEL_ROLES.includes(r.id) && r.id !== targetRoleId);

                    if (!hasCorrectRole || hasExtraRoles) {
                        updates.push({ member, targetLevel });
                    }
                }
            }

            if (updates.length > 0) {
                logger.info(`[AutoRank] ${updates.length} kayıtlı ve Valorant rolü olan kişi güncelleniyor.`);
                for (let i = 0; i < updates.length; i += 3) {
                    const batch = updates.slice(i, i + 3);
                    await Promise.all(batch.map(upd => rankHandler.syncRank(upd.member, upd.targetLevel)));
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

        } catch (error) {
            // logger.error(`[AutoRank Error]: ${error.message}`);
        } finally {
            isRunning = false;
            setTimeout(runSync, 10000); // Taramayı biraz yavaşlattım (10sn)
        }
    };

    setTimeout(runSync, 3000);
};
