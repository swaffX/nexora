const { Events, ActivityType } = require('discord.js');
const path = require('path');
const { User } = require('../../../shared/models');
const logger = require('../../../shared/logger');
const config = require('../config');
const { joinVoiceChannel } = require('@discordjs/voice');
const rankHandler = require('../handlers/rankHandler');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`🎮 Custom Bot Devrede: ${client.user.tag}`);

        const activities = [
            { name: 'discord.gg/nexorahub', type: 1, url: 'https://www.twitch.tv/swaffval' },
            { name: 'made by swaff', type: 1, url: 'https://www.twitch.tv/swaffval' }
        ];

        let i = 0;
        client.user.setPresence({ activities: [activities[0]], status: 'dnd' });

        setInterval(() => {
            i = (i + 1) % activities.length;
            client.user.setPresence({ activities: [activities[i]], status: 'dnd' });
        }, 30000);

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

        // MIGRATION: 100 ELO PROBLEMİNİ ÇÖZ (SADECE HİÇ MAÇ OYNAMAMIŞ ESKİ KAYITLAR)
        const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
        try {
            const res = await User.updateMany(
                {
                    'matchStats.elo': 100,
                    $or: [
                        { 'matchStats.totalMatches': 0 },
                        { 'matchStats.totalMatches': { $exists: false } },
                        { 'matchStats.totalMatches': null }
                    ]
                },
                { $set: { 'matchStats.elo': 200, 'matchStats.matchLevel': 1 } }
            );
            if (res.modifiedCount > 0) {
                logger.info(`[MIGRATION] ${res.modifiedCount} kullanıcının (0 Maç) ELO'su 100 -> 200 olarak düzeltildi.`);
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
        const REQUIRED_ROLE_ID = config.ROLES.VALORANT;
        const GUILD_ID = process.env.GUILD_ID;

        (async () => {
            try {
                const guild = client.guilds.cache.get(GUILD_ID);
                if (!guild) return;

                // Rank Rollerini Kontrol Et / Oluştur
                await rankHandler.ensureRolesExist(guild); // YENİ EKLENDİ

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

                // --- MIGRATION: lastMatchDate ---
                // Henüz lastMatchDate'i olmayan ama maç oynayan oyuncuların
                // son maç tarihini Match geçmişinden hesapla
                try {
                    const { Match } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
                    const usersWithoutDate = await User.find({
                        odaId: GUILD_ID,
                        'matchStats.totalMatches': { $gt: 0 },
                        'matchStats.lastMatchDate': null
                    });

                    let migratedCount = 0;
                    for (const u of usersWithoutDate) {
                        const lastMatch = await Match.findOne({
                            status: 'FINISHED',
                            $or: [{ teamA: u.odasi }, { teamB: u.odasi }]
                        }).sort({ createdAt: -1 }).select('createdAt');

                        if (lastMatch && lastMatch.createdAt) {
                            u.matchStats.lastMatchDate = lastMatch.createdAt;
                            await u.save();
                            migratedCount++;
                        }
                    }

                    if (migratedCount > 0) {
                        logger.success(`⏳ MIGRATION: ${migratedCount} oyuncunun lastMatchDate alanı Match geçmişinden dolduruldu.`);
                    }
                } catch (migErr) { logger.error('lastMatchDate Migration Error:', migErr); }
            } catch (e) {
                logger.error('Rol Sync Hatası:', e);
            }
        })();
    },
};
