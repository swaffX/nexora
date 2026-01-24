const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        logger.success(`⚔️ Nexora Custom Bot Devrede: ${client.user.tag}`);

        client.user.setPresence({
            activities: [{
                name: '5v5 Scrim | Nexora',
                type: 1, // Streaming
                url: 'https://www.twitch.tv/swaffval'
            }],
            status: 'dnd'
        });
    },
};
