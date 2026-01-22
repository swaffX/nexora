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
        if (!settings) {
            console.log(`[LogHelper] Guild settings not found for ${guildId}`);
            return;
        }
        if (!settings.logs || !settings.logs.enabled) {
            console.log(`[LogHelper] Logs disabled for ${guildId}`);
            return;
        }

        const channelId = settings.logs[type];
        if (!channelId) {
            console.log(`[LogHelper] No channel ID for log type: ${type}`);
            return;
        }

        const channel = client.channels.cache.get(channelId);
        if (channel) {
            await channel.send({ embeds: [embed] });
            // console.log(`[LogHelper] Log sent to ${channel.name} (${type})`);
        } else {
            console.log(`[LogHelper] Channel not found in cache: ${channelId}`);
        }
    } catch (error) {
        console.error(`Log gönderme hatası (${type}):`, error);
    }
}

module.exports = { sendLog };
