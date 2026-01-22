const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        if (!message.guild || message.author?.bot) return;

        const guildSettings = await Guild.findOrCreate(message.guild.id);
        if (guildSettings.logs.message) {
            const channel = message.guild.channels.cache.get(guildSettings.logs.message);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xED4245) // Red
                    .setTitle('🗑️ Mesaj Silindi')
                    .addFields(
                        { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                        { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                        { name: 'İçerik', value: message.content ? message.content.substring(0, 1000) : 'Görsel/Embed' }
                    )
                    .setTimestamp();

                channel.send({ embeds: [embed] }).catch(() => { });
            }
        }
    }
};
