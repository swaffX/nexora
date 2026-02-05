const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`⚔️ Nexora Custom Bot Devrede: ${client.user.tag}`);

        // DURUM
        client.user.setPresence({
            activities: [{
                name: 'made by swaff',
                type: 1, // Streaming
                url: 'https://www.twitch.tv/swaffval'
            }],
            status: 'online'
        });

        // SES
        const VOICE_CHANNEL_ID = '1463921161925558485';

        try {
            const channel = client.channels.cache.get(VOICE_CHANNEL_ID);
            if (channel) {
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: true
                });
                logger.info('🔊 Custom Bot ses kanalına giriş yaptı.');
            } else {
                logger.warn(`⚠️ Ses kanalı bulunamadı (${VOICE_CHANNEL_ID}).`);
            }
        } catch (e) {
            logger.error('Ses bağlantı hatası:', e.message);
        }

        // Otomatik maç timeout kontrolü devre dışı bırakıldı
        // Maçlar artık manuel olarak bitirilmeli

        // MIGRATION: 100 ELO PROBLEMİNİ ÇÖZ (SADECE 100 OLANLAR)
        const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models')); // Moved User require to a higher scope
        try {
            const res = await User.updateMany(
                { 'matchStats.elo': 100 },
                { $set: { 'matchStats.elo': 200, 'matchStats.matchLevel': 1 } }
            );
            if (res.modifiedCount > 0) {
                logger.info(`[MIGRATION] ${res.modifiedCount} kullanıcının ELO'su 100 -> 200 olarak düzeltildi.`);
            }
        } catch (e) { console.error('Migration hatası:', e); }

        // LEADERBOARD UPDATE LOOP (30 Saniye)---
        try {
            const leaderboard = require('../handlers/leaderboard');
            leaderboard.updateLeaderboard(client); // İlk açılışta bir kez çalıştır

            setInterval(() => {
                leaderboard.updateLeaderboard(client);
            }, 30000); // Her 30 saniyede bir güncelle (Live)
            logger.info('📊 Leaderboard servisi başlatıldı.');
        } catch (err) {
            logger.error('Leaderboard servisi hatası:', err);
        }

        // --- ROL SENKRONİZASYONU ---
        // Bot kapalıyken rol alan/verenleri senkronize et
        const REQUIRED_ROLE_ID = '1466189076347486268';
        const GUILD_ID = process.env.GUILD_ID;

        (async () => {
            try {
                const guild = client.guilds.cache.get(GUILD_ID);
                if (!guild) return;

                logger.info('🔄 ELO Rol senkronizasyonu başlatılıyor...');
                await guild.members.fetch(); // Tüm üyeleri çek

                const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
                const eloService = require('../services/eloService');

                // 1. Role sahip olup DB'de olmayanları ekle
                const roleMembers = guild.roles.cache.get(REQUIRED_ROLE_ID)?.members;
                if (roleMembers) {
                    for (const [id, member] of roleMembers) {
                        const userDoc = await User.findOne({ odasi: id, odaId: GUILD_ID });
                        if (!userDoc) {
                            await User.create({
                                odasi: id,
                                odaId: GUILD_ID,
                                matchStats: eloService.createDefaultStats()
                            });
                        } else if (!userDoc.matchStats || !userDoc.matchStats.elo) {
                            userDoc.matchStats = eloService.createDefaultStats();
                            await userDoc.save();
                        }
                    }
                }

                // 2. Role sahip olmayıp DB'de stats'i olanları temizle
                // (Bu işlem biraz ağır olabilir, dikkatli olunmalı)
                // Şimdilik sadece yeni eklemeleri yapalım, silme işlemini eventlere bırakalım.
                // Çünkü "matchStats:exists" sorgusu pahalı olabilir.

                try {
                    // MIGRATION: 100 ELO olanları 200 yap
                    const result = await User.updateMany(
                        { 'matchStats.elo': 100 },
                        { $set: { 'matchStats.elo': 200 } }
                    );
                    if (result.modifiedCount > 0) {
                        logger.success(`♻️ MIGRATION: ${result.modifiedCount} kullanıcının ELO'su 100 -> 200 olarak güncellendi.`);
                    }
                } catch (migErr) { logger.error('Migration Error:', migErr); }

                logger.success('✅ ELO Rol senkronizasyonu tamamlandı.');
            } catch (e) {
                logger.error('Rol Sync Hatası:', e);
            }
        })();
    },
};
