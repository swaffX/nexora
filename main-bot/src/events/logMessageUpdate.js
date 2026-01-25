const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'messageUpdate',
    async execute(oldMessage, newMessage, client) {
        if (oldMessage.partial) {
            try {
                await oldMessage.fetch();
            } catch (e) {
                return; // Fetch edilemiyorsa atla
            }
        }
        if (!oldMessage.guild || !oldMessage.author || oldMessage.author.bot) return;
        if (oldMessage.content === newMessage.content) return; // Sadece içerik değişince

        const embed = new EmbedBuilder()
            .setColor(0xFEE75C) // Yellow
            .setTitle('✏️ Mesaj Düzenlendi')
            .addFields(
                { name: 'Kullanıcı', value: `<@${oldMessage.author.id}>`, inline: true },
                { name: 'Kanal', value: `<#${oldMessage.channel.id}>`, inline: true },
                { name: 'Eski Mesaj', value: `\`\`\`${oldMessage.content ? oldMessage.content.substring(0, 1000) : '*Yok*'}\`\`\`` },
                { name: 'Yeni Mesaj', value: `\`\`\`${newMessage.content ? newMessage.content.substring(0, 1000) : '*Yok*'}\`\`\`` }
            )
            .setTimestamp()
            .setFooter({ text: `Mesaj ID: ${oldMessage.id}` });

        const jumpLink = `https://discord.com/channels/${oldMessage.guild.id}/${oldMessage.channel.id}/${newMessage.id}`;
        embed.addFields({ name: '🔗 Bağlantı', value: `[Mesaja Git](${jumpLink})` });

        await sendLog(client, oldMessage.guild.id, 'message', embed);
    }
};
