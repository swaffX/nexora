const path = require('path');
const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'messageDelete',
    async execute(message, client) {
        if (!message.guild || message.author?.bot) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245) // Red
            .setTitle('🗑️ Mesaj Silindi')
            .addFields(
                { name: 'Kullanıcı', value: `<@${message.author.id}>`, inline: true },
                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                { name: 'İçerik', value: message.content ? message.content.substring(0, 1024) : '*Görsel veya Embed*' }
            )
            .setTimestamp()
            .setFooter({ text: `Mesaj ID: ${message.id}` });

        if (message.attachments.size > 0) {
            embed.addFields({ name: 'Ekler', value: `${message.attachments.size} adet ek bulundu.` });
        }

        await sendLog(client, message.guild.id, 'message', embed);
    }
};
