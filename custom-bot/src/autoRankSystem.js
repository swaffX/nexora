const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

// ELO Service ile uyumlu Level Hesaplayıcı (DB'den bağımsız, Real-Time)
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
 * Background Rank Synchronizer - EXACT ALGORITHM
 * Ses kaydında istenilen:
 * 1. Valorant rolüne sahip herkesi al (91 kişi)
 * 2. Anlık ELO'larına bak
 * 3. Level kaç olmalı hesapla
 * 4. Rolü doğru mu kontrol et
 * 5. Yanlışsa düzelt (Ver/Sil), doğruysa geç
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

    logger.info('[AutoRank] Real-Time Rank System başlatıldı. (91 Kişi Takibi)');

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                isRunning = false;
                return;
            }

            // 1. ADIM: Valorant Rolüne (91 kişi) sahip kişileri en güncel haliyle çek
            const membersWithRole = await guild.members.fetch({ role: REQUIRED_VALORANT_ROLE, force: true }).catch(() => null);

            if (!membersWithRole || membersWithRole.size === 0) {
                // logger.info('[AutoRank] Hedef kitle bulunamadı.');
                isRunning = false;
                return;
            }

            // 2. ADIM: Bu kişilerin ELO'larını DB'den çek
            const memberIds = Array.from(membersWithRole.keys());
            const usersInDb = await User.find({
                odasi: { $in: memberIds },
                odaId: GUILD_ID
            }).select('odasi matchStats.elo');

            // DB'de olmayanları Level 1 varsayacağız
            const userEloMap = new Map();
            usersInDb.forEach(u => userEloMap.set(u.odasi, u.matchStats?.elo ?? 200));

            // 3. ADIM: Tek tek kontrol et (Loop)
            const updates = [];
            for (const member of membersWithRole.values()) {
                // Elo'yu al (Yoksa varsayılan 200)
                const elo = userEloMap.get(member.id) ?? 200;

                // HESAPLA: Bu ELO hangi level olmalı?
                const targetLevel = calculateLevel(elo);
                const targetRoleId = LEVEL_ROLES[targetLevel];

                // KONTROL: Role sahip mi?
                const hasCorrectRole = member.roles.cache.has(targetRoleId);

                // KONTROL: Yanlış (fazla) rolleri var mı?
                const hasExtraRoles = member.roles.cache.some(r => ALL_LEVEL_ROLES.includes(r.id) && r.id !== targetRoleId);

                // KARAR: Değişiklik lazım mı?
                if (!hasCorrectRole || hasExtraRoles) {
                    updates.push({
                        member,
                        targetLevel,
                        elo // Log için
                    });
                }
            }

            // 4. ADIM: Varsa güncellemeleri uygula
            if (updates.length > 0) {
                logger.info(`[AutoRank] ${updates.length} kişinin rolü olması gerekenden farklı. Düzeltiliyor...`);

                // Tek tek yapıyoruz ki hatayı net görelim (Paralel değil Sequential)
                for (const update of updates) {
                    await rankHandler.syncRank(update.member, update.targetLevel);
                    // Discord'u boğmamak için çok kısa bekle (0.5sn)
                    await new Promise(r => setTimeout(r, 500));
                }
            } else {
                // Herkes doğrusu ise sessiz kal
            }

        } catch (error) {
            // logger.error(`[AutoRank Error]: ${error.message}`);
        } finally {
            isRunning = false;
            // 5 Saniye sonra tekrar kontrol et
            setTimeout(runSync, 5000);
        }
    };

    // İlk başlangıç
    setTimeout(runSync, 3000);
};
