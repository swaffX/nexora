const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        logger.success(`🛡️ Guard Bot 3 (Anti-Nuke) hazır! ${client.user.tag}`);
        logger.info(`${client.guilds.cache.size} sunucuya bağlı`);

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
                console.log('🔊 Bot ses kanalına giriş yaptı.');
            }
        } catch (e) {
            console.log('Ses bağlantı hatası (Modül eksik olabilir):', e.message);
        }

    }
};
