const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const utils = require(path.join(__dirname, '..', '..', '..', 'shared', 'utils'));

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        // Bot mesajlarını yoksay
        if (message.author.bot) return;
        if (!message.guild) return;

        const guildId = message.guild.id;
        const userId = message.author.id;
        const cacheKey = `${guildId}-${userId}`;

        // Guild ayarlarını al
        const guildSettings = await Guild.findOrCreate(guildId, message.guild.name);

        // Anti-spam kapalıysa çık
        if (!guildSettings.antiSpam.enabled) return;

        const antiSpam = guildSettings.antiSpam;

        // Whitelist kontrolü
        if (antiSpam.whitelistedChannels.includes(message.channel.id)) return;
        if (message.member.roles.cache.some(r => antiSpam.whitelistedRoles.includes(r.id))) return;
        if (message.member.permissions.has('Administrator')) return;

        let shouldPunish = false;
        let reason = '';

        // 1. Yasak kelime kontrolü
        if (antiSpam.bannedWords.length > 0) {
            const content = message.content.toLowerCase();
            for (const word of antiSpam.bannedWords) {
                if (content.includes(word.toLowerCase())) {
                    shouldPunish = true;
                    reason = `Yasak kelime: ${word}`;
                    break;
                }
            }
        }

        // 2. Link koruma
        if (!shouldPunish && antiSpam.linkProtection) {
            const urlRegex = /(https?:\/\/[^\s]+)/g;
            if (urlRegex.test(message.content)) {
                shouldPunish = true;
                reason = 'Yasak link paylaşımı';
            }
        }

        // 3. Davet linki koruma
        if (!shouldPunish && antiSpam.inviteProtection) {
            if (utils.isDiscordInvite(message.content)) {
                shouldPunish = true;
                reason = 'Discord davet linki paylaşımı';
            }
        }

        // 4. Mention spam
        if (!shouldPunish && antiSpam.mentionLimit > 0) {
            const mentions = message.mentions.users.size + message.mentions.roles.size;
            if (message.mentions.everyone) {
                shouldPunish = true;
                reason = '@everyone/@here kullanımı';
            } else if (mentions > antiSpam.mentionLimit) {
                shouldPunish = true;
                reason = `Çok fazla mention (${mentions}/${antiSpam.mentionLimit})`;
            }
        }

        // 5. Emoji spam
        if (!shouldPunish && antiSpam.emojiLimit > 0) {
            const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic}|<a?:\w+:\d+>)/gu;
            const emojis = message.content.match(emojiRegex) || [];
            if (emojis.length > antiSpam.emojiLimit) {
                shouldPunish = true;
                reason = `Çok fazla emoji (${emojis.length}/${antiSpam.emojiLimit})`;
            }
        }

        // 6. Caps lock spam
        if (!shouldPunish && antiSpam.capsLimit > 0 && message.content.length > 10) {
            const upperCase = message.content.replace(/[^A-ZÇĞİÖŞÜ]/g, '').length;
            const total = message.content.replace(/[^a-zA-ZçğıöşüÇĞİÖŞÜ]/g, '').length;
            if (total > 0 && (upperCase / total) * 100 > antiSpam.capsLimit) {
                shouldPunish = true;
                reason = `Çok fazla büyük harf (%${Math.round((upperCase / total) * 100)})`;
            }
        }

        // 7. Mesaj spam (flood kontrolü)
        if (!shouldPunish) {
            const now = Date.now();
            let userMessages = client.messageCache.get(cacheKey) || [];

            // Eski mesajları temizle
            userMessages = userMessages.filter(m => now - m.timestamp < antiSpam.messageTime);
            userMessages.push({
                content: message.content,
                timestamp: now
            });
            client.messageCache.set(cacheKey, userMessages);

            // Mesaj limiti kontrolü
            if (userMessages.length >= antiSpam.messageLimit) {
                shouldPunish = true;
                reason = `Çok hızlı mesaj (${userMessages.length} mesaj/${antiSpam.messageTime / 1000}s)`;
            }

            // Tekrarlanan mesaj kontrolü
            if (!shouldPunish && antiSpam.duplicateLimit > 0) {
                const duplicates = userMessages.filter(m => m.content === message.content);
                if (duplicates.length >= antiSpam.duplicateLimit) {
                    shouldPunish = true;
                    reason = `Tekrarlanan mesaj (${duplicates.length} kez)`;
                }
            }
        }

        // Ceza uygula
        if (shouldPunish) {
            logger.guard('SPAM', `${message.author.tag}: ${reason}`);

            // Mesajı sil
            try {
                await message.delete();
            } catch (error) {
                logger.error('Mesaj silinemedi:', error.message);
            }

            // Eylem uygula
            switch (antiSpam.action) {
                case 'warn': {
                    // Uyarı sayısını kontrol et
                    const warnCount = (client.warnedUsers.get(cacheKey) || 0) + 1;
                    client.warnedUsers.set(cacheKey, warnCount);

                    if (warnCount >= 3) {
                        // 3 uyarı = mute
                        try {
                            await message.member.timeout(antiSpam.muteDuration, `Anti-Spam: ${reason}`);
                            client.warnedUsers.delete(cacheKey);
                        } catch (error) {
                            logger.error('Timeout uygulanamadı:', error.message);
                        }
                    } else {
                        // Uyarı mesajı
                        const warnMsg = await message.channel.send({
                            content: `⚠️ <@${userId}>, ${reason}! (Uyarı ${warnCount}/3)`
                        });
                        setTimeout(() => warnMsg.delete().catch(() => { }), 5000);
                    }
                    break;
                }

                case 'mute': {
                    try {
                        await message.member.timeout(antiSpam.muteDuration, `Anti-Spam: ${reason}`);
                        const muteMsg = await message.channel.send({
                            content: `🔇 <@${userId}> susturuldu: ${reason}`
                        });
                        setTimeout(() => muteMsg.delete().catch(() => { }), 5000);
                    } catch (error) {
                        logger.error('Timeout uygulanamadı:', error.message);
                    }
                    break;
                }

                case 'kick': {
                    try {
                        await message.member.kick(`Anti-Spam: ${reason}`);
                    } catch (error) {
                        logger.error('Kick uygulanamadı:', error.message);
                    }
                    break;
                }

                default: {
                    // Sadece sil (zaten silindi)
                    break;
                }
            }

            // Log kanalına bildir
            if (antiSpam.logChannelId) {
                const logChannel = message.guild.channels.cache.get(antiSpam.logChannelId);
                if (logChannel) {
                    logChannel.send({
                        embeds: [embeds.guard(
                            'Spam Tespit Edildi',
                            `Spam algılandı ve işlem yapıldı.`,
                            [
                                { name: 'Kullanıcı', value: `<@${userId}>`, inline: true },
                                { name: 'Kanal', value: `<#${message.channel.id}>`, inline: true },
                                { name: 'Sebep', value: reason, inline: true },
                                { name: 'Eylem', value: antiSpam.action, inline: true },
                                { name: 'Mesaj İçeriği', value: message.content.substring(0, 200) || 'Boş', inline: false }
                            ]
                        )]
                    });
                }
            }
        }
    }
};
