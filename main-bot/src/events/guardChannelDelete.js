const { Events, AuditLogEvent } = require('discord.js');
const guardHandler = require('../handlers/guardHandler');

module.exports = {
    name: Events.ChannelDelete,
    async execute(channel) {
        if (!channel.guild) return;

        // Audit Log'dan sileni bul
        try {
            const fetchedLogs = await channel.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.ChannelDelete,
            });
            const auditEntry = fetchedLogs.entries.first();

            if (!auditEntry) return;

            // Audit log 5 saniyeden eskiyse güvenilmezdir (eski log olabilir)
            if (Date.now() - auditEntry.createdTimestamp > 5000) return;

            const executor = auditEntry.executor;
            if (executor) {
                await guardHandler.checkAction(channel.client, channel.guild, 'channel', executor.id);
            }
        } catch (error) {
            // console.error('Guard ChannelDelete Error:', error);
        }
    }
};
