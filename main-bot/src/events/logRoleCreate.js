const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'roleCreate',
    async execute(role, client) {
        const guildSettings = await Guild.findOrCreate(role.guild.id);
        if (guildSettings.logs.role) {
            const channel = role.guild.channels.cache.get(guildSettings.logs.role);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0x57F287) // Green
                    .setTitle('🛡️ Rol Oluşturuldu')
                    .setDescription(`**Rol:** ${role.name} (<@&${role.id}>)`)
                    .setTimestamp();
                channel.send({ embeds: [embed] }).catch(() => { });
            }
        }
    }
};
