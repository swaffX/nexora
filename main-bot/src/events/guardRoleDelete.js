const { Events, AuditLogEvent } = require('discord.js');
const guardHandler = require('../handlers/guardHandler');

module.exports = {
    name: Events.GuildRoleDelete,
    async execute(role) {
        if (!role.guild) return;

        try {
            const fetchedLogs = await role.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.RoleDelete,
            });
            const auditEntry = fetchedLogs.entries.first();

            if (!auditEntry) return;
            if (Date.now() - auditEntry.createdTimestamp > 5000) return;

            const executor = auditEntry.executor;
            if (executor) {
                await guardHandler.checkAction(role.client, role.guild, 'role', executor.id);
            }
        } catch (error) { }
    }
};
