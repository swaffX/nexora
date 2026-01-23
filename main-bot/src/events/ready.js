const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { Guild, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`⚙️ Ana Yönetim Botu hazır! ${client.user.tag}`);

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

        // 10 saniye sonra çalıştır
        setTimeout(updateLeaderboard, 10000);
        // 5 dakikada bir çalıştır
        setInterval(updateLeaderboard, 60000 * 5);
    }
};
