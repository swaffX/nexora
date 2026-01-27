const { Events } = require('discord.js');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: Events.VoiceStateUpdate,
    async execute(oldState, newState, client) {
        const queue = client.queues.get(oldState.guild.id);
        if (!queue) return;

        // Bot left or was disconnected
        if (oldState.member?.id === client.user.id && !newState.channelId) {
            client.queues.delete(oldState.guild.id);
            logger.info(`[Neurovia Music] ${oldState.guild.name} - Ses kanalından ayrıldı (disconnect)`);
            return;
        }

        // Check if bot is alone in channel - auto leave
        if (oldState.channelId && !newState.channelId) {
            const voiceChannel = oldState.channel;

            // Check if bot is in this channel
            if (!voiceChannel || !voiceChannel.members.has(client.user.id)) return;

            // Count non-bot members
            const members = voiceChannel.members.filter(m => !m.user.bot);

            if (members.size === 0) {
                // Start auto-leave timer
                if (queue.leaveTimeout) clearTimeout(queue.leaveTimeout);

                queue.leaveTimeout = setTimeout(() => {
                    const currentQueue = client.queues.get(oldState.guild.id);
                    if (currentQueue && currentQueue.connection) {
                        const voiceCheck = client.channels.cache.get(voiceChannel.id);
                        if (voiceCheck) {
                            const stillAlone = voiceCheck.members.filter(m => !m.user.bot).size === 0;
                            if (stillAlone) {
                                currentQueue.connection.destroy();
                                client.queues.delete(oldState.guild.id);
                                logger.info(`[Neurovia Music] ${oldState.guild.name} - Kanal boş, otomatik ayrıldı`);
                            }
                        }
                    }
                }, (queue.autoLeaveMinutes || 5) * 60 * 1000);
            }
        }

        // Someone joined - cancel auto-leave
        if (!oldState.channelId && newState.channelId && queue.leaveTimeout) {
            clearTimeout(queue.leaveTimeout);
            queue.leaveTimeout = null;
        }
    }
};
