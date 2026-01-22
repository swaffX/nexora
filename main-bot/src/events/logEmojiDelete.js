const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'emojiDelete',
    async execute(emoji, client) {
        if (!emoji.guild) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245) // Red
            .setTitle('😃 Emoji Silindi')
            .setDescription(`**Emoji:** ${emoji.name}`)
            .setThumbnail(emoji.url)
            .setTimestamp()
            .setFooter({ text: `Emoji ID: ${emoji.id}` });

        await sendLog(client, emoji.guild.id, 'server', embed);
    }
};
