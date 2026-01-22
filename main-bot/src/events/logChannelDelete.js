const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'channelDelete',
    async execute(channel, client) {
        if (!channel.guild) return;

        const embed = new EmbedBuilder()
            .setColor(0xED4245) // Red
            .setTitle('📺 Kanal Silindi')
            .addFields(
                { name: 'Kanal Adı', value: `${channel.name}`, inline: true },
                { name: 'Tür', value: `${channel.type}`, inline: true } // Type number is enough for logs usually, or can reuse helper logic
            )
            .setTimestamp()
            .setFooter({ text: `Kanal ID: ${channel.id}` });

        await sendLog(client, channel.guild.id, 'channel', embed);
    }
};
