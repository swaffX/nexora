const { Events, ActivityType } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client) {
        logger.success(`🎵 Neurovia Music hazır! ${client.user.tag}`);
        logger.info(`🌐 ${client.guilds.cache.size} sunucuda aktif`);

        // Set streaming presence like other bots
        client.user.setPresence({
            activities: [{
                name: 'made by swaff',
                type: ActivityType.Streaming,
                url: 'https://www.twitch.tv/swaffval'
            }],
            status: 'online'
        });

        // Cleanup empty queues periodically
        setInterval(() => {
            for (const [guildId, queue] of client.queues) {
                if (!queue.tracks.length && !queue.current) {
                    client.queues.delete(guildId);
                }
            }
        }, 300000); // Every 5 minutes
    }
};
