const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { joinVoiceChannel } = require('@discordjs/voice');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
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
    },
};
