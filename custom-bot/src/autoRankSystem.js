const rankHandler = require('./handlers/rankHandler');
const { User } = require('../../shared/models');
const logger = require('../../shared/logger');

/**
 * Background Rank Synchronizer
 * Tüm Valorant rolü sahiplerini tarar ve levellerine göre rollerini günceller.
 */
module.exports = (client) => {
    const REQUIRED_VALORANT_ROLE = '1466189076347486268';
    const GUILD_ID = process.env.GUILD_ID;

    logger.info('[AutoRank] Arka plan rank senkronizasyonu başlatıldı (5 saniye periyot).');

    setInterval(async () => {
        try {
            const guild = client.guilds.cache.get(GUILD_ID);
            if (!guild) return;

            // 1. Sunucudaki aktif üyeleri getir (Role sahip olanlar)
            // cache.filter kullanıyoruz çünkü roller anlık değişebilir
            const membersWithRole = guild.members.cache.filter(m => m.roles.cache.has(REQUIRED_VALORANT_ROLE));

            if (membersWithRole.size === 0) return;

            // 2. DB'den bu üyelerin verilerini toplu çek
            const memberIds = membersWithRole.map(m => m.id);
            const usersInDb = await User.find({
                odasi: { $in: memberIds },
                odaId: GUILD_ID
            });

            // 3. Her üye için senkronizasyonu çalıştır
            for (const member of membersWithRole.values()) {
                const userDoc = usersInDb.find(u => u.odasi === member.id);

                // DB'de kaydı varsa leveline göre güncelle, yoksa level 1 varsay (veya işlem yapma)
                const targetLevel = userDoc?.matchStats?.matchLevel || 1;

                // rankHandler.syncRank zaten rol kontrolü ve "aynı role sahipse bir şey yapma" mantığına sahip
                // 5 saniyede bir çalıştırmak Discord'u yormaz çünkü kod içinde cache kontrolü yapıyoruz
                await rankHandler.syncRank(member, targetLevel);
            }

        } catch (error) {
            // Sessiz hata yönetimi (Arka plan servisi olduğu için akışı bozmasın)
            // console.error('[AutoRank Error]:', error.message);
        }
    }, 5000);
};
