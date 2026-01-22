const path = require('path');
const { Guild, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        const member = newState.member || oldState.member;
        if (!member || member.user.bot) return;

        const guildId = (newState.guild || oldState.guild).id;
        const odasi = member.id;

        if (!client.voiceSessions) client.voiceSessions = new Map();

        const sessionKey = `${guildId}-${odasi}`;
        const guildSettings = await Guild.findOrCreate(guildId);

        // 1. Katıldı
        if (!oldState.channelId && newState.channelId) {
            client.voiceSessions.set(sessionKey, Date.now());
        }

        // 2. Ayrıldı
        if (oldState.channelId && !newState.channelId) {
            const joinTime = client.voiceSessions.get(sessionKey);

            if (joinTime && guildSettings.levelSystem?.enabled) {
                const duration = Math.floor((Date.now() - joinTime) / 60000); // Dakika

                if (duration > 0) {
                    try {
                        const userData = await User.findOrCreate(odasi, guildId, member.user.username);
                        const xpGain = duration * (guildSettings.levelSystem.voiceXpPerMinute || 5);

                        userData.xp += xpGain;
                        userData.totalVoiceMinutes += duration;
                        userData.dailyVoice += duration;
                        userData.weeklyVoice += duration;
                        userData.monthlyVoice += duration;

                        // Level Check
                        const nextLevelXp = 5 * Math.pow(userData.level, 2) + 50 * userData.level + 100;
                        if (userData.xp >= nextLevelXp) {
                            userData.level += 1;

                            if (guildSettings.levelSystem.logChannelId) {
                                const logChannel = oldState.guild.channels.cache.get(guildSettings.levelSystem.logChannelId);
                                if (logChannel) {
                                    const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
                                    logChannel.send({
                                        content: `Tebrikler <@${odasi}>! 🎉`,
                                        embeds: [embeds.levelUp(member.user, userData.level)]
                                    }).catch(() => { });
                                }
                            }
                        }

                        await userData.save();
                    } catch (error) {
                        logger.error('Voice XP hatası:', error.message);
                    }
                }
            }
            client.voiceSessions.delete(sessionKey);
        }

        // 3. Kanal Değiştirdi
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const joinTime = client.voiceSessions.get(sessionKey);

            if (joinTime && guildSettings.levelSystem?.enabled) {
                const duration = Math.floor((Date.now() - joinTime) / 60000);

                if (duration > 0) {
                    try {
                        const userData = await User.findOrCreate(odasi, guildId, member.user.username);
                        const xpGain = duration * (guildSettings.levelSystem.voiceXpPerMinute || 5);

                        userData.xp += xpGain;
                        userData.totalVoiceMinutes += duration;
                        userData.dailyVoice += duration;
                        userData.weeklyVoice += duration;
                        userData.monthlyVoice += duration;

                        // Level Check
                        const nextLevelXp = 5 * Math.pow(userData.level, 2) + 50 * userData.level + 100;
                        if (userData.xp >= nextLevelXp) {
                            userData.level += 1;
                            if (guildSettings.levelSystem.logChannelId) {
                                const logChannel = newState.guild.channels.cache.get(guildSettings.levelSystem.logChannelId);
                                if (logChannel) {
                                    const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
                                    logChannel.send({
                                        content: `Tebrikler <@${odasi}>! 🎉`,
                                        embeds: [embeds.levelUp(member.user, userData.level)]
                                    }).catch(() => { });
                                }
                            }
                        }
                        await userData.save();
                    } catch (error) {
                        logger.error('Voice XP (Switch) hatası:', error.message);
                    }
                }
            }
            client.voiceSessions.set(sessionKey, Date.now());
        }
    }
};
