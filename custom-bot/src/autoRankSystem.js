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
 * Background Rank Synchronizer - FIXED LOGIC
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

            // 1. SADECE VALORANT ROLÜ OLANLARI ÇEK
            const membersWithRole = await guild.members.fetch({ role: REQUIRED_VALORANT_ROLE, force: true }).catch(() => null);

            if (!membersWithRole || membersWithRole.size === 0) {
                isRunning = false;
                return;
            }

            // 2. SADECE BU (91) KİŞİNİN ELO'SUNU DB'DEN İSTE
            const memberIds = Array.from(membersWithRole.keys());
            const usersInDb = await User.find({
                odasi: { $in: memberIds }, // Kritik nokta: Sadece bu ID'leri getir
                odaId: GUILD_ID
            }).select('odasi matchStats.elo');

            // Map: Kullanıcı ID -> ELO
            const eloMap = new Map();
            usersInDb.forEach(u => eloMap.set(u.odasi, u.matchStats?.elo ?? 200));

            // 3. KARŞILAŞTIRMA VE GÜNCELLEME LİSTESİ HAZIRLA
            const updates = [];

            for (const member of membersWithRole.values()) {
                // Elo'yu al (Yoksa varsayılan 200 - Level 1)
                const elo = eloMap.get(member.id) ?? 200;

                const targetLevel = calculateLevel(elo);
                const targetRoleId = LEVEL_ROLES[targetLevel];

                // Role sahip mi?
                const hasCorrectRole = member.roles.cache.has(targetRoleId);
                // Fazladan rolü var mı?
                const hasExtraRoles = member.roles.cache.some(r => ALL_LEVEL_ROLES.includes(r.id) && r.id !== targetRoleId);

                // Sadece yanlışsa listeye ekle
                if (!hasCorrectRole || hasExtraRoles) {
                    updates.push({ member, targetLevel, elo });
                }
            }

            // 4. GÜNCELLEMELERİ UYGULA
            if (updates.length > 0) {
                // Hatalı sayıyı değil, gerçek güncellenecek sayıyı göster
                logger.info(`[AutoRank] Toplam: ${membersWithRole.size} kişi. Güncellenecek: ${updates.length} kişi.`);

                for (const update of updates) {
                    await rankHandler.syncRank(update.member, update.targetLevel);
                    await new Promise(r => setTimeout(r, 200)); // Hızlı geçiş
                }
            } else {
                // Her şey yolundaysa sessizce bekle
                // logger.success('[AutoRank] Tüm roller senkronize.'); 
            }

        } catch (error) {
            logger.error(`[AutoRank Error]: ${error.message}`);
        } finally {
            isRunning = false;
            setTimeout(runSync, 5000); // 5 saniyede bir
        }
    };

    setTimeout(runSync, 3000);
};
