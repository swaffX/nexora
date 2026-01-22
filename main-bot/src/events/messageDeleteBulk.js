const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'messageDeleteBulk',
    async execute(messages, channel, client) {
        if (!channel.guild) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245) // Red
            .setTitle('🗑️ Toplu Mesaj Silindi')
            .setDescription(`**${messages.size}** adet mesaj <#${channel.id}> kanalından silindi.`)
            .setTimestamp()
            .setFooter({ text: `Kanal ID: ${channel.id}` });

        // Opsiyonel: Silinen mesajların içeriğini bir text dosyası olarak ekleyebiliriz ama şimdilik sadece sayı.

        await sendLog(client, channel.guild.id, 'message', embed);
    }
};
