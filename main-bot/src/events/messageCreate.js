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

        // Guild ayarlarını al
        const guildSettings = await Guild.findOrCreate(message.guild.id, message.guild.name);

        // Level sistemi
        if (guildSettings.levelSystem?.enabled) {
            const levelSettings = guildSettings.levelSystem;

            // Cooldown kontrolü (default 60s)
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const cooldownRemaining = utils.checkCooldown(client.xpCooldowns, cooldownKey, 60);

            if (cooldownRemaining === 0) {
                try {
                    const userData = await User.findOrCreate(message.author.id, message.guild.id, message.author.username);

                    // XP ekle (15-25 arası random * çarpan)
                    const xpGain = utils.randomXP(15, 25) * (levelSettings.multiplier || 1);
                    const newLevel = await userData.addXP(xpGain);

                    // Mesaj sayısını artır
                    userData.totalMessages += 1;
                    userData.dailyMessages += 1;
                    userData.weeklyMessages += 1;
                    userData.monthlyMessages += 1;
                    await userData.save();

                    // Level atladı mı?
                    if (newLevel) {
                        // Log kanalına veya mevcut kanala bildir
                        const notifyChannelId = levelSettings.logChannelId;
                        let notifyChannel = notifyChannelId ? message.guild.channels.cache.get(notifyChannelId) : message.channel;

                        // Kanal yoksa mevcut kanala at
                        if (!notifyChannel) notifyChannel = message.channel;

                        notifyChannel.send({
                            embeds: [embeds.levelUp(message.author, newLevel)]
                        }).catch(() => { });

                        // Rol ödülleri
                        if (levelSettings.roleRewards && levelSettings.roleRewards.length > 0) {
                            for (const reward of levelSettings.roleRewards) {
                                if (newLevel >= reward.level) {
                                    const role = message.guild.roles.cache.get(reward.roleId);
                                    if (role && !message.member.roles.cache.has(role.id)) {
                                        await message.member.roles.add(role, `Level ${reward.level} ödülü`);
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
        if (userData && userData.afk && userData.afk.enabled) {
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
        if (message.mentions.users.size > 0) {
            for (const [, mentioned] of message.mentions.users) {
                const mentionedUser = await User.findOne({ odasi: mentioned.id, odaId: message.guild.id });
                if (mentionedUser && mentionedUser.afk && mentionedUser.afk.enabled) {
                    await message.reply({
                        content: `💤 **${mentioned.username}** AFK: ${mentionedUser.afk.reason || 'Sebep belirtilmedi'}`,
                        allowedMentions: { repliedUser: false }
                    });
                }
            }
        }
    }
};
