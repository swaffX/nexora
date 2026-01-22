const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'roleUpdate',
    async execute(oldRole, newRole, client) {
        if (!oldRole.guild) return;

        if (oldRole.name !== newRole.name) {
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C) // Yellow
                .setTitle('🛡️ Rol Güncellendi')
                .setDescription(`<@&${newRole.id}> rolü güncellendi.`)
                .addFields(
                    { name: 'Eski İsim', value: `${oldRole.name}`, inline: true },
                    { name: 'Yeni İsim', value: `${newRole.name}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Rol ID: ${newRole.id}` });

            await sendLog(client, newRole.guild.id, 'role', embed);
        }
    }
};
