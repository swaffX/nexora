const { EmbedBuilder, AuditLogEvent } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'guildBanAdd',
    async execute(ban, client) {
        if (!ban.guild) return;

        let moderator = 'Bilinmiyor';
        let reason = ban.reason || 'Sebep belirtilmedi.';

        try {
            const auditLogs = await ban.guild.fetchAuditLogs({
                limit: 1,
                type: AuditLogEvent.MemberBanAdd,
            });
            const logEntry = auditLogs.entries.first();

            // Log entry'nin hedefi banlanan kullanıcı mı kontrol et
            if (logEntry && logEntry.target.id === ban.user.id) {
                moderator = `${logEntry.executor.tag} (${logEntry.executor.id})`;
                if (logEntry.reason) reason = logEntry.reason;
            }
        } catch (error) {
            console.error('Audit log fetch error (Ban Add):', error);
        }

        const embed = new EmbedBuilder()
            .setColor(0xED4245) // Red
            .setTitle('🚫 Üye Yasaklandı (Ban)')
            .setAuthor({ name: ban.user.tag, iconURL: ban.user.displayAvatarURL() })
            .addFields(
                { name: 'Kullanıcı', value: `${ban.user.tag} (${ban.user.id})`, inline: true },
                { name: 'Yetkili', value: moderator, inline: true },
                { name: 'Sebep', value: reason, inline: false }
            )
            .setTimestamp()
            .setFooter({ text: `Kullanıcı ID: ${ban.user.id}` });

        await sendLog(client, ban.guild.id, 'moderation', embed);
    }
};
