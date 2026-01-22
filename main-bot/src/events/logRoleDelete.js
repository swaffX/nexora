const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'roleDelete',
    async execute(role, client) {
        if (!role.guild) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245) // Red
            .setTitle('🛡️ Rol Silindi')
            .setDescription(`**Rol:** ${role.name}`)
            .setTimestamp()
            .setFooter({ text: `Rol ID: ${role.id}` });

        await sendLog(client, role.guild.id, 'role', embed);
    }
};
