const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { Guild, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`📈 Nexora Status Bot Devrede: ${client.user.tag}`);

        // 1. Durum Ayarı (Streaming)
        client.user.setPresence({
            activities: [{
                name: 'made by swaff',
                type: 1, // Streaming
                url: 'https://www.twitch.tv/swaffval'
            }],
            status: 'online'
        });

        // 2. Ses Kanalına Giriş
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
                logger.info('🔊 Status Bot ses kanalına giriş yaptı.');
            } else {
                logger.warn(`⚠️ Ses kanalı bulunamadı (${VOICE_CHANNEL_ID}).`);
            }
        } catch (e) {
            logger.error('Ses bağlantı hatası:', e.message);
        }

        const updateLeaderboard = async () => {
            logger.info('[Status] Leaderboard taranıyor...');
            for (const [guildId, guild] of client.guilds.cache) {
                try {
                    const settings = await Guild.findOne({ odaId: guildId });

                    if (settings && settings.levelSystem && settings.levelSystem.enabled && settings.levelSystem.leaderboardChannelId) {
                        const channel = guild.channels.cache.get(settings.levelSystem.leaderboardChannelId);
                        if (!channel) continue;

                        // 1. Top Chatters
                        const topMsg = await User.find({ odaId: guildId, totalMessages: { $gt: 0 } }).sort({ totalMessages: -1 }).limit(10).lean();

                        // 2. Voice Champions
                        const topVoice = await User.find({ odaId: guildId, totalVoiceMinutes: { $gt: 0 } }).sort({ totalVoiceMinutes: -1 }).limit(10).lean();

                        // 3. Global Stats
                        const allUsers = await User.find({ odaId: guildId }, 'totalMessages totalVoiceMinutes');
                        let totalMsgCount = 0;
                        let totalVoiceCount = 0;
                        allUsers.forEach(u => {
                            totalMsgCount += u.totalMessages || 0;
                            totalVoiceCount += u.totalVoiceMinutes || 0;
                        });

                        const data = {
                            // xp: [], // LEVEL KALDIRILDI
                            messages: topMsg.map(u => ({ userId: u.odasi, totalMessages: u.totalMessages })),
                            voice: topVoice.map(u => ({ userId: u.odasi, totalVoiceMinutes: u.totalVoiceMinutes })),
                            stats: {
                                trackedUsers: allUsers.length,
                                totalMessages: totalMsgCount,
                                totalVoice: totalVoiceCount
                            }
                        };

                        // Canvas ile Görsel Oluştur
                        const { createLeaderboardImage } = require('../utils/canvasHelper');
                        const { AttachmentBuilder } = require('discord.js');

                        try {
                            const buffer = await createLeaderboardImage(guild.name, guild.iconURL({ extension: 'png', forceStatic: true }), data, client);
                            const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

                            const timestamp = Math.floor(Date.now() / 1000);
                            const msgContent = `**${guild.name}** Sunucu İstatistikleri 📊\nSon Güncelleme: <t:${timestamp}:R>\n*Her 5 dakikada bir otomatik güncellenir.*`;

                            if (settings.levelSystem.leaderboardMessageId) {
                                try {
                                    const msg = await channel.messages.fetch(settings.levelSystem.leaderboardMessageId);
                                    if (msg) {
                                        await msg.edit({ content: msgContent, embeds: [], files: [attachment] });
                                    }
                                } catch (e) {
                                    // Mesaj silinmiş
                                    const newMsg = await channel.send({ content: msgContent, files: [attachment] });
                                    settings.levelSystem.leaderboardMessageId = newMsg.id;
                                    await settings.save();
                                }
                            } else {
                                // İlk mesaj
                                const newMsg = await channel.send({ content: msgContent, files: [attachment] });
                                settings.levelSystem.leaderboardMessageId = newMsg.id;
                                await settings.save();
                            }
                            logger.info(`[Status] ${guild.name} leaderboard (Canvas) güncellendi.`);

                        } catch (canvasError) {
                            logger.error(`[Status] Canvas Hatası:`, canvasError);
                        }
                    }
                } catch (error) {
                    logger.error(`[Status] Leaderboard hatası (${guild.name}):`, error);
                }
            }
        };

        // İlk çalıştırma ve döngü
        setTimeout(updateLeaderboard, 5000); // 5 saniye bekle, bot iyice açılsın
        setInterval(updateLeaderboard, 300000); // 5 dk
    }
};
