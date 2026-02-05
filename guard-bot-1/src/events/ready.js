const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        logger.success(`🛡️ Guard Bot 1 (Anti-Raid) hazır! ${client.user.tag}`);
        logger.info(`${client.guilds.cache.size} sunucuya bağlı`);

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
            logger.error('Ses bağlantı hatası (Modül eksik olabilir):', e.message);
        }

    }
};
