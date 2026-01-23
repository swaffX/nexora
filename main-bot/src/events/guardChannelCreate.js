const { Events, AuditLogEvent } = require('discord.js');
const guardHandler = require('../handlers/guardHandler');

module.exports = {
    name: Events.ChannelCreate,
    async execute(channel) {
        if (!channel.guild) return;

        try {
            const fetchedLogs = await channel.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.ChannelCreate,
            });
            const auditEntry = fetchedLogs.entries.first();

            if (!auditEntry) return;
            if (Date.now() - auditEntry.createdTimestamp > 5000) return;

            const executor = auditEntry.executor;
            if (executor) {
                await guardHandler.checkAction(channel.client, channel.guild, 'channel', executor.id);
            }
        } catch (error) { }
    }
};
