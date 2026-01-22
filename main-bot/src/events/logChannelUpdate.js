const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel, client) {
        if (!oldChannel.guild) return;

        // İsim değişikliği
        if (oldChannel.name !== newChannel.name) {
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C) // Yellow
                .setTitle('📺 Kanal Güncellendi')
                .setDescription(`<#${newChannel.id}> kanalının adı değiştirildi.`)
                .addFields(
                    { name: 'Eski İsim', value: `${oldChannel.name}`, inline: true },
                    { name: 'Yeni İsim', value: `${newChannel.name}`, inline: true }
                )
                .setTimestamp()
                .setFooter({ text: `Kanal ID: ${newChannel.id}` });

            await sendLog(client, newChannel.guild.id, 'channel', embed);
        }
    }
};
