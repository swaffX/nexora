const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'guildBanRemove',
    async execute(ban, client) {
        if (!ban.guild) return;

        let moderator = 'Bilinmiyor';

        try {
            const auditLogs = await ban.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanRemove,
            });
            const logEntry = auditLogs.entries.first();

            if (logEntry && logEntry.target.id === ban.user.id) {
                moderator = `${logEntry.executor.tag} (${logEntry.executor.id})`;
            }
        } catch (error) {
            console.error('Audit log fetch error (Ban Remove):', error);
        }

        const embed = new EmbedBuilder()
            .setColor(0x57F287) // Green
            .setTitle('🔓 Yasak Kaldırıldı (Unban)')
            .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL() })
            .addFields(
                { name: 'Kullanıcı', value: `${ban.user.tag} (${ban.user.id})`, inline: true },
                { name: 'Yetkili', value: moderator, inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Kullanıcı ID: ${ban.user.id}` });

        await sendLog(client, ban.guild.id, 'moderation', embed);
    }
};
