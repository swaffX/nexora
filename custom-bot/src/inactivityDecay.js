const { User } = require('../../shared/models');
const eloService = require('./services/eloService');
const logger = require('../../shared/logger');
const { EmbedBuilder } = require('discord.js');

/**
 * Inactivity ELO Decay System
 * Günde 1 kez çalışır ve 7+ gün oynamamış oyuncuların ELO'sunu düşürür.
 * 
 * Kademeli Sistem:
 *  - 8-14 gün: -3 ELO/gün
 *  - 15-30 gün: -5 ELO/gün
 *  - 31+ gün: -8 ELO/gün
 *  - Minimum ELO: 100 (daha fazla düşmez)
 */
module.exports = (client) => {
    const GUILD_ID = process.env.GUILD_ID;
    const DECAY_LOG_CHANNEL_ID = '1468664219997175984'; // Maç log kanalı (aynı kanalı kullanalım)
    const INTERVAL_MS = 24 * 60 * 60 * 1000; // 24 saat

    let isRunning = false;

    const runDecay = async () => {
        if (isRunning) return;
        isRunning = true;

        try {
            // 7+ gün önce son maçını oynamış ve ELO'su decay floor'un üstünde olan oyuncuları bul
            const gracePeriod = eloService.ELO_CONFIG.INACTIVITY.GRACE_PERIOD_DAYS;
            const decayFloor = eloService.ELO_CONFIG.INACTIVITY.DECAY_FLOOR;
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - gracePeriod);

            const inactivePlayers = await User.find({
                odaId: GUILD_ID,
                'matchStats.lastMatchDate': { $lt: cutoffDate, $ne: null },
                'matchStats.elo': { $gt: decayFloor },
                'matchStats.totalMatches': { $gt: 0 }
            });

            if (inactivePlayers.length === 0) {
                logger.info('[Inactivity] Tarama tamamlandı: İnaktif oyuncu yok.');
                isRunning = false;
                return;
            }

            logger.info(`[Inactivity] ${inactivePlayers.length} inaktif oyuncu bulundu. Decay uygulanıyor...`);

            const decayResults = [];

            for (const user of inactivePlayers) {
                try {
                    const result = await eloService.applyInactivityDecay(user, client);
                    if (result) {
                        decayResults.push(result);
                    }
                } catch (e) {
                    console.error(`[Inactivity] Decay error for ${user.odasi}:`, e.message);
                }
                // Rate limit koruması
                await new Promise(r => setTimeout(r, 500));
            }

            // Log kanalına rapor gönder
            if (decayResults.length > 0) {
                try {
                    const guild = client.guilds.cache.get(GUILD_ID);
                    if (guild) {
                        const logChannel = guild.channels.cache.get(DECAY_LOG_CHANNEL_ID) ||
                            await guild.channels.fetch(DECAY_LOG_CHANNEL_ID).catch(() => null);

                        if (logChannel) {
                            const lines = [];
                            for (const r of decayResults) {
                                const member = guild.members.cache.get(r.user.odasi) ||
                                    await guild.members.fetch(r.user.odasi).catch(() => null);
                                const name = member?.displayName || r.user.odasi;
                                lines.push(`⏳ **${name}** → -${r.decay} ELO (${r.daysSinceLastMatch} gün inaktif, ${r.user.matchStats.elo} ELO)`);
                            }

                            const embed = new EmbedBuilder()
                                .setColor(0xFF6B35)
                                .setTitle('⏳ İnaktiflik ELO Decay Raporu')
                                .setDescription(lines.join('\n'))
                                .setFooter({ text: `${decayResults.length} oyuncu etkilendi • Günlük Otomatik Tarama` })
                                .setTimestamp();

                            await logChannel.send({ embeds: [embed] });
                        }
                    }
                } catch (e) {
                    console.error('[Inactivity] Log gönderme hatası:', e.message);
                }
            }

            logger.success(`[Inactivity] Decay tamamlandı: ${decayResults.length} oyuncuya uygulandı.`);

        } catch (error) {
            logger.error(`[Inactivity] Kritik hata: ${error.message}`);
        } finally {
            isRunning = false;
        }
    };

    // İlk çalıştırma: Bot açıldıktan 30 saniye sonra
    setTimeout(runDecay, 30000);

    // Sonraki çalıştırmalar: Her 24 saatte bir
    setInterval(runDecay, INTERVAL_MS);

    logger.info('⏳ Inactivity Decay sistemi başlatıldı (24 saat döngüsü).');
};
