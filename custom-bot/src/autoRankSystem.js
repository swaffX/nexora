const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

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
 * Background Rank Synchronizer - RATE LIMIT PROOF
 * Opcode 8 hatasını engellemek için Members Fetch yerine Role Members kullanır.
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

    // logger.info('[AutoRank] Safe Mode Rank System başlatıldı.');

    const runSync = async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) {
                isRunning = false;
                return;
            }

            // 1. ÜYE LİSTESİNİ ÇEKME YÖNTEMİ (KRİTİK DEĞİŞİKLİK)
            // fetch() yerine cache'deki role bakıyoruz. Role cache'de yoksa sadece rolü çekiyoruz.
            // Bu yöntem Opcode 8 (Chunk Request) göndermez.
            let targetRole = guild.roles.cache.get(REQUIRED_VALORANT_ROLE);

            if (!targetRole) {
                // Eğer rol hafızada yoksa, SADECE bu rolü fetch et
                targetRole = await guild.roles.fetch(REQUIRED_VALORANT_ROLE).catch(() => null);
            }

            if (!targetRole) {
                logger.error(`[AutoRank] Rol bulunamadı: ${REQUIRED_VALORANT_ROLE}`);
                isRunning = false;
                return;
            }

            // Rolün üyelerini cache'den al. Eğer sayı eksikse (örn. bot yeni açıldıysa)
            // yine de işlem yapmaya çalış ama tüm sunucuyu fetch ETME.
            // Zamanla üyeler cache'e dolacaktır.
            const membersWithRole = targetRole.members;

            if (membersWithRole.size === 0) {
                // Hiç üye görünmüyorsa, bu seferlik mecburen güvenli bir fetch deneyelim
                // Ama force: true yapmıyoruz, rate limit yememek için.
                await guild.members.fetch({ limit: 10 }).catch(() => { });
                isRunning = false;
                return;
            }

            // 2. ELO BİLGİLERİ (Sadece bulduğumuz üyeler için)
            const memberIds = Array.from(membersWithRole.keys());
            const usersInDb = await User.find({
                odasi: { $in: memberIds },
                odaId: GUILD_ID
            }).select('odasi matchStats.elo');

            const eloMap = new Map();
            usersInDb.forEach(u => eloMap.set(u.odasi, u.matchStats?.elo ?? 200));

            // 3. KONTROL
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

            // 4. GÜNCELLEME
            if (updates.length > 0) {
                logger.info(`[AutoRank] (${membersWithRole.size} kişiden) ${updates.length} güncelleme başlıyor...`);

                for (const update of updates) {
                    await rankHandler.syncRank(update.member, update.targetLevel);
                    // Bekleme süresini artır (Daha güvenli)
                    await new Promise(r => setTimeout(r, 1500));
                }
            }

        } catch (error) {
            if (error.message.includes('rate limited')) {
                // logger.warn('[AutoRank] Rate Limit uyarısı - Biraz yavaşlıyoruz.');
            } else {
                logger.error(`[AutoRank Error]: ${error.message}`);
            }
        } finally {
            isRunning = false;
            // 5 yerine 10 saniye bekle (Daha güvenli)
            setTimeout(runSync, 10000);
        }
    };

    setTimeout(runSync, 5000);
};
