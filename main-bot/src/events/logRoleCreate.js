const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'roleCreate',
    async execute(role, client) {
        if (!role.guild) return;

        const embed = new EmbedBuilder()
            .setColor(0x57F287) // Green
            .setTitle('🛡️ Rol Oluşturuldu')
            .setDescription(`**Rol:** ${role.name} (<@&${role.id}>)`)
            .addFields(
                { name: 'Renk', value: `${role.hexColor}`, inline: true },
                { name: 'Hoist', value: role.hoist ? 'Evet' : 'Hayır', inline: true }
            )
            .setTimestamp()
            .setFooter({ text: `Rol ID: ${role.id}` });

        await sendLog(client, role.guild.id, 'role', embed);
    }
};
