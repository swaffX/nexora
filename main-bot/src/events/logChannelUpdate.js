const { EmbedBuilder } = require('discord.js');
const { sendLog } = require('../utils/logHelper');

module.exports = {
    name: 'channelUpdate',
    async execute(oldChannel, newChannel, client) {
        if (!oldChannel.guild) return;

        const changes = [];

        // İsim
        if (oldChannel.name !== newChannel.name) {
            changes.push(`**İsim:** \`${oldChannel.name}\` ➔ \`${newChannel.name}\``);
        }

        // Konu (Topic)
        if (oldChannel.topic !== newChannel.topic) {
            const oldTopic = oldChannel.topic ? (oldChannel.topic.length > 50 ? oldChannel.topic.substring(0, 50) + '...' : oldChannel.topic) : '*Yok*';
            const newTopic = newChannel.topic ? (newChannel.topic.length > 50 ? newChannel.topic.substring(0, 50) + '...' : newChannel.topic) : '*Yok*';
            changes.push(`**Konu:** \`${oldTopic}\` ➔ \`${newTopic}\``);
        }

        // NSFW
        if (oldChannel.nsfw !== newChannel.nsfw) {
            changes.push(`**NSFW:** \`${oldChannel.nsfw ? 'Evet' : 'Hayır'}\` ➔ \`${newChannel.nsfw ? 'Evet' : 'Hayır'}\``);
        }

        // Hız Sınırlaması (RateLimit)
        if (oldChannel.rateLimitPerUser !== newChannel.rateLimitPerUser) {
            changes.push(`**Yavaş Mod:** \`${oldChannel.rateLimitPerUser}s\` ➔ \`${newChannel.rateLimitPerUser}s\``);
        }

        if (changes.length > 0) {
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C) // Yellow
                .setTitle('📺 Kanal Güncellendi')
                .setDescription(`<#${newChannel.id}> güncellendi.`)
                .addFields({ name: 'Değişiklikler', value: changes.join('\n\n') })
                .setTimestamp()
                .setFooter({ text: `Kanal ID: ${newChannel.id}` });

            await sendLog(client, newChannel.guild.id, 'channel', embed);
        }
    }
};
