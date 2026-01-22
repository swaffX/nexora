const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        if (!oldMessage.guild || oldMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return; // Sadece içerik değişince

        const guildSettings = await Guild.findOrCreate(oldMessage.guild.id);
        if (guildSettings.logs.message) {
            const channel = oldMessage.guild.channels.cache.get(guildSettings.logs.message);
            if (channel) {
                const embed = new EmbedBuilder()
                    .setColor(0xFEE75C) // Yellow
                    .setTitle('✏️ Mesaj Düzenlendi')
                    .addFields(
                        { name: 'Kullanıcı', value: `<@${oldMessage.author.id}>`, inline: true },
                        { name: 'Kanal', value: `<#${oldMessage.channel.id}>`, inline: true },
                        { name: 'Eski Mesaj', value: oldMessage.content ? oldMessage.content.substring(0, 1000) : 'Yok' },
                        { name: 'Yeni Mesaj', value: newMessage.content ? newMessage.content.substring(0, 1000) : 'Yok' }
                    )
                    .setTimestamp();

                channel.send({ embeds: [embed] }).catch(() => { });
            }
        }
    }
};
