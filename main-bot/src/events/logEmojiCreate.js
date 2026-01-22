const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'emojiCreate',
    async execute(emoji, client) {
        if (!emoji.guild) return;

        const embed = new EmbedBuilder()
            .setColor(0x57F287) // Green
            .setTitle('😃 Emoji Oluşturuldu')
            .setDescription(`**Emoji:** <:${emoji.name}:${emoji.id}> (${emoji.name})`)
            .setThumbnail(emoji.url)
            .setTimestamp()
            .setFooter({ text: `Emoji ID: ${emoji.id}` });

        await sendLog(client, emoji.guild.id, 'server', embed);
    }
};
