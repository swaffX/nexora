const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { Guild, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const inviteCache = require('../utils/inviteCache');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`⚙️ Ana Yönetim Botu hazır! ${client.user.tag}`);
        // Webhook Testi: Eğer webhook ayarlıysa bu discord'a düşmeli
        logger.warn(`🟢 Sistem Başlatıldı: ${client.user.tag}`);

        // Cache Davetleri
        for (const [id, guild] of client.guilds.cache) {
            try {
                await inviteCache.fetchInvites(guild);
                logger.info(`Davetler önbelleğe alındı: ${guild.name}`);
            } catch (err) {
                logger.error(`Davet cache hatası (${guild.name}): ${err.message}`);
            }
        }

        client.user.setPresence({
            activities: [{
                name: 'made by swaff',
                type: 1,
                url: 'https://www.twitch.tv/swaffxedits'
            }],
            status: 'online'
        });

        // Auto Join Voice
        try {
            const { joinVoiceChannel } = require('@discordjs/voice');
            const channel = client.channels.cache.get('1463921161925558485');
            if (channel) {
                joinVoiceChannel({
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    adapterCreator: channel.guild.voiceAdapterCreator,
                    selfDeaf: true
                });
                logger.info('🔊 Bot ses kanalına giriş yaptı.');
            }
        } catch (e) {
            logger.error('Ses bağlantı hatası:', e.message);
        }


        // Voice Session Restore (Bot açıldığında seste olanları kaydet)
        if (!client.voiceSessions) client.voiceSessions = new Map();

        for (const [guildId, guild] of client.guilds.cache) {
            guild.channels.cache.filter(c => c.type === 2).forEach(channel => { // 2 = GuildVoice
                channel.members.forEach(member => {
                    if (!member.user.bot) {
                        const key = `${guildId}-${member.id}`;
                        if (!client.voiceSessions.has(key)) {
                            client.voiceSessions.set(key, Date.now());
                        }
                    }
                });
            });
        }

        // Leaderboard Update Fonksiyonu
        const updateLeaderboard = async () => {
            logger.info('Leaderboard güncelleniyor...');
            for (const [guildId, guild] of client.guilds.cache) {
                try {
                    const settings = await Guild.findOne({ odaId: guildId });

                    if (settings && settings.levelSystem && settings.levelSystem.enabled && settings.levelSystem.leaderboardChannelId) {
                        const channel = guild.channels.cache.get(settings.levelSystem.leaderboardChannelId);
                        if (!channel) continue;

                        // 1. Top XP (All Time)
                        const topXp = await User.find({ odaId: guildId }).sort({ xp: -1 }).limit(5).lean();

                        // 2. Top Chatters
                        const topMsg = await User.find({ odaId: guildId, totalMessages: { $gt: 0 } }).sort({ totalMessages: -1 }).limit(5).lean();

                        // 3. Voice Champions
                        const topVoice = await User.find({ odaId: guildId, totalVoiceMinutes: { $gt: 0 } }).sort({ totalVoiceMinutes: -1 }).limit(5).lean();

                        // 4. Global Stats (Aggregate daha performanslı ama basit loop yeterli şimdilik)
                        const allUsers = await User.find({ odaId: guildId }, 'totalMessages totalVoiceMinutes');
                        let totalMsgCount = 0;
                        let totalVoiceCount = 0;
                        allUsers.forEach(u => {
                            totalMsgCount += u.totalMessages || 0;
                            totalVoiceCount += u.totalVoiceMinutes || 0;
                        });

                        const data = {
                            xp: topXp.map(u => ({ userId: u.odasi, level: u.level, xp: u.xp })),
                            messages: topMsg.map(u => ({ userId: u.odasi, totalMessages: u.totalMessages })),
                            voice: topVoice.map(u => ({ userId: u.odasi, totalVoiceMinutes: u.totalVoiceMinutes })),
                            stats: {
                                trackedUsers: allUsers.length,
                                totalMessages: totalMsgCount,
                                totalVoice: totalVoiceCount
                            }
                        };

                        const embed = embeds.leaderboard(guild.name, guild.iconURL({ dynamic: true }), data);

                        if (settings.levelSystem.leaderboardMessageId) {
                            try {
                                const msg = await channel.messages.fetch(settings.levelSystem.leaderboardMessageId);
                                if (msg) await msg.edit({ embeds: [embed] });
                            } catch (e) {
                                // Mesaj silinmiş
                                const newMsg = await channel.send({ embeds: [embed] });
                                settings.levelSystem.leaderboardMessageId = newMsg.id;
                                await settings.save();
                            }
                        } else {
                            // İlk mesaj
                            const newMsg = await channel.send({ embeds: [embed] });
                            settings.levelSystem.leaderboardMessageId = newMsg.id;
                            await settings.save();
                        }
                    }
                } catch (error) {
                    logger.error(`Leaderboard hatası (${guild.name}):`, error);
                }
            }
        };

        // Leaderboard Update Döngüsü (Her 5 dakikada bir)
        updateLeaderboard(); // İlk açılışta çalıştır
        setInterval(updateLeaderboard, 300000); // 5 dakikada bir tekrarla

        // Jail Timer Kontrolü (Dakikada bir)
        setInterval(async () => {
            const now = new Date();
            const expiredJails = await User.find({
                'jail.isJailed': true,
                'jail.jailedUntil': { $ne: null, $lte: now }
            });

            for (const userData of expiredJails) {
                const guild = client.guilds.cache.get(userData.odaId);
                if (!guild) continue;

                const member = await guild.members.fetch(userData.odasi).catch(() => null);
                if (!member) continue;

                const guildSettings = await Guild.findOne({ odaId: guild.id });
                if (!guildSettings?.jailSystem?.roleId) continue;

                try {
                    const jailRoleId = guildSettings.jailSystem.roleId;
                    const rolesToRestore = userData.jail.roles || [];

                    await member.roles.remove(jailRoleId);
                    if (rolesToRestore.length > 0) await member.roles.add(rolesToRestore);

                    // DB Güncelle
                    userData.jail.isJailed = false;
                    userData.jail.roles = [];
                    userData.jail.jailedAt = null;
                    userData.jail.jailedUntil = null;
                    await userData.save();

                    // Bildirim
                    const cellChannel = guild.channels.cache.get(guildSettings.jailSystem.channelId);
                    if (cellChannel) {
                        cellChannel.send({
                            content: `<@${member.id}>`,
                            embeds: [{
                                color: 0x2ECC71,
                                description: `⏰ **Süre Doldu!** <@${member.id}> otomatik tahliye edildi.`
                            }]
                        });
                    }

                    logger.info(`Otomatik tahliye: ${member.user.tag} (${guild.name})`);

                } catch (err) {
                    logger.error(`Otomatik tahliye hatası (${member.user.tag}):`, err);
                }
            }
        }, 60000); // 1 dakikada bir kontrol

    }
};
