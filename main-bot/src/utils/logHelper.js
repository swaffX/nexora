const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { EmbedBuilder } = require('discord.js');

/**
 * Log türüne göre ilgili kanala mesaj gönderir.
 * @param {Client} client Discord Client
 * @param {string} guildId Sunucu ID
 * @param {string} type Log türü: 'message', 'member', 'moderation', 'role', 'channel', 'voice', 'server'
 * @param {EmbedBuilder} embed Gönderilecek Embed
 */
async function sendLog(client, guildId, type, embed) {
    try {
        const settings = await Guild.findOne({ odaId: guildId });
        if (!settings) return;
        if (!settings.logs || !settings.logs.enabled) return;

        const channelId = settings.logs[type];
        if (!channelId) return;

        const channel = client.channels.cache.get(channelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
        }
    } catch (error) {
        console.error(`Log gönderme hatası (${type}):`, error);
    }
}

module.exports = { sendLog };
