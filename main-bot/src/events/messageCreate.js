const path = require('path');
const { Guild, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const utils = require(path.join(__dirname, '..', '..', '..', 'shared', 'utils'));

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        const guildSettings = await Guild.findOrCreate(message.guild.id, message.guild.name);

        // Level sistemi
        if (guildSettings.level.enabled) {
            const levelSettings = guildSettings.level;

            // Ignored kontrolü
            if (levelSettings.ignoredChannels.includes(message.channel.id)) return;
            if (message.member.roles.cache.some(r => levelSettings.ignoredRoles.includes(r.id))) return;

            // Cooldown kontrolü
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const cooldownRemaining = utils.checkCooldown(client.xpCooldowns, cooldownKey, levelSettings.xpCooldown);

            if (cooldownRemaining === 0) {
                try {
                    const userData = await User.findOrCreate(message.author.id, message.guild.id, message.author.username);

                    // XP ekle
                    const xpGain = utils.randomXP(levelSettings.xpMin, levelSettings.xpMax) * levelSettings.multiplier;
                    const newLevel = await userData.addXP(xpGain);

                    // Mesaj sayısını artır
                    userData.totalMessages += 1;
                    userData.dailyMessages += 1;
                    userData.weeklyMessages += 1;
                    userData.monthlyMessages += 1;
                    await userData.save();

                    // Level atladı mı?
                    if (newLevel) {
                        // Level up mesajı
                        if (levelSettings.channelId) {
                            const levelChannel = message.guild.channels.cache.get(levelSettings.channelId);
                            if (levelChannel) {
                                levelChannel.send({
                                    embeds: [embeds.levelUp(message.author, newLevel)]
                                });
                            }
                        } else {
                            message.channel.send({
                                embeds: [embeds.levelUp(message.author, newLevel)]
                            });
                        }

                        // Level rolü kontrolü
                        for (const levelRole of levelSettings.levelRoles) {
                            if (newLevel >= levelRole.level) {
                                const role = message.guild.roles.cache.get(levelRole.roleId);
                                if (role && !message.member.roles.cache.has(role.id)) {
                                    await message.member.roles.add(role, `Level ${levelRole.level} rolü`);
                                }

                                // Stack değilse eski rolleri kaldır
                                if (!levelSettings.stackRoles) {
                                    for (const oldRole of levelSettings.levelRoles) {
                                        if (oldRole.level < levelRole.level) {
                                            const oldRoleObj = message.guild.roles.cache.get(oldRole.roleId);
                                            if (oldRoleObj && message.member.roles.cache.has(oldRoleObj.id)) {
                                                await message.member.roles.remove(oldRoleObj, 'Level rolü güncellendi');
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    logger.error('Level sistemi hatası:', error.message);
                }
            }
        }

        // AFK kontrolü
        const userData = await User.findOne({ odasi: message.author.id, odaId: message.guild.id });
        if (userData && userData.afk.enabled) {
            userData.afk.enabled = false;
            userData.afk.reason = null;
            userData.afk.since = null;
            await userData.save();

            const afkMsg = await message.reply({
                content: '👋 AFK durumunuz kaldırıldı!',
                allowedMentions: { repliedUser: false }
            });
            setTimeout(() => afkMsg.delete().catch(() => { }), 3000);
        }

        // Mention edilen AFK kullanıcılarını kontrol et
        for (const [, mentioned] of message.mentions.users) {
            const mentionedUser = await User.findOne({ odasi: mentioned.id, odaId: message.guild.id });
            if (mentionedUser && mentionedUser.afk.enabled) {
                await message.reply({
                    content: `💤 **${mentioned.username}** AFK: ${mentionedUser.afk.reason || 'Sebep belirtilmedi'}`,
                    allowedMentions: { repliedUser: false }
                });
            }
        }
    }
};
