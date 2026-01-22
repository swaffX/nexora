const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'roleUpdate',
    async execute(oldRole, newRole, client) {
        if (!oldRole.guild) return;

        const changes = [];

        // 1. İsim Değişikliği
        if (oldRole.name !== newRole.name) {
            changes.push(`**İsim:** \`${oldRole.name}\` ➔ \`${newRole.name}\``);
        }

        // 2. Renk Değişikliği
        if (oldRole.hexColor !== newRole.hexColor) {
            changes.push(`**Renk:** \`${oldRole.hexColor}\` ➔ \`${newRole.hexColor}\``);
        }

        // 3. Görünüm (Hoist) - Ayrı gösterilme
        if (oldRole.hoist !== newRole.hoist) {
            changes.push(`**Ayrı Göster:** \`${oldRole.hoist ? 'Evet' : 'Hayır'}\` ➔ \`${newRole.hoist ? 'Evet' : 'Hayır'}\``);
        }

        // 4. Etiketlenebilirlik
        if (oldRole.mentionable !== newRole.mentionable) {
            changes.push(`**Etiketlenebilir:** \`${oldRole.mentionable ? 'Evet' : 'Hayır'}\` ➔ \`${newRole.mentionable ? 'Evet' : 'Hayır'}\``);
        }

        // 5. Yetki Değişiklikleri (En önemlisi)
        const oldPerms = oldRole.permissions;
        const newPerms = newRole.permissions;

        if (!oldPerms.equals(newPerms)) {
            const added = newPerms.missing(oldPerms); // Yeni eklenenler
            const removed = oldPerms.missing(newPerms); // Silinenler

            if (added.length > 0) {
                changes.push(`**✅ Eklenen Yetkiler:**\n\`${added.join(', ')}\``);
            }
            if (removed.length > 0) {
                changes.push(`**❌ Kaldırılan Yetkiler:**\n\`${removed.join(', ')}\``);
            }
        }

        // Eğer değişiklik varsa logla
        if (changes.length > 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C) // Yellow
                .setTitle('🛡️ Rol Güncellendi')
                .setDescription(`<@&${newRole.id}> rolünde değişiklikler yapıldı.`)
                .addFields({ name: 'Değişiklikler', value: changes.join('\n\n') })
                .setTimestamp()
                .setFooter({ text: `Rol ID: ${newRole.id}` });

            await sendLog(client, newRole.guild.id, 'role', embed);
        }
    }
};
