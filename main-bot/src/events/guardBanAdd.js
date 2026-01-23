const { Events, AuditLogEvent } = require('discord.js');
const guardHandler = require('../handlers/guardHandler');

module.exports = {
    name: Events.GuildBanAdd,
    async execute(ban) {
        if (!ban.guild) return;

        try {
            const fetchedLogs = await ban.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanAdd,
            });
            const auditEntry = fetchedLogs.entries.first();

            if (!auditEntry) return;
            if (Date.now() - auditEntry.createdTimestamp > 5000) return;

            const executor = auditEntry.executor;
            if (executor) {
                await guardHandler.checkAction(ban.client, ban.guild, 'ban', executor.id);
            }
        } catch (error) { }
    }
};
