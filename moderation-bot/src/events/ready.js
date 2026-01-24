const { Events, ActivityType } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client) {
        logger.success(`🛡️ Moderasyon Botu Devrede: ${client.user.tag}`);
        client.user.setPresence({
            activities: [{ name: 'Sunucu Düzenini', type: ActivityType.Watching }],
            status: 'dnd',
        });
    },
};
