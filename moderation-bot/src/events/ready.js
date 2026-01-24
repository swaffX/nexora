const { Events, ActivityType } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        logger.success(`🛡️ Moderasyon Botu Devrede: ${client.user.tag}`);
        client.user.setPresence({
            activities: [{
                name: 'made by swaff',
                type: 1,
                url: 'https://www.twitch.tv/swaffval'
            }],
            status: 'online'
        });

        // Ses Kanalına Gir
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
                logger.info('🔊 Moderasyon Botu ses kanalına giriş yaptı.');
            }
        } catch (e) {
            logger.error('Ses bağlantı hatası:', e.message);
        }
    },
};
