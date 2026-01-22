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

            // Log
            const { EmbedBuilder } = require('discord.js');
            const { sendLog } = require('../utils/logHelper');
            const embed = new EmbedBuilder()
                .setColor(0x57F287) // Green
                .setAuthor({ name: 'Ses Kanalına Katıldı', iconURL: member.user.displayAvatarURL() })
                .setDescription(`<@${member.id}> bir ses kanalına katıldı.`)
                .addFields(
                    { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
                    { name: 'Kanal', value: `<#${newState.channelId}>`, inline: true }
                )
                .setTimestamp();
            await sendLog(client, guildId, 'voice', embed);
        }

        // 2. Ayrıldı
        if (oldState.channelId && !newState.channelId) {
            const joinTime = client.voiceSessions.get(sessionKey);

            if (joinTime && guildSettings.levelSystem?.enabled) {
                // ... XP Logic (Mevcut kod) ...
                const duration = Math.floor((Date.now() - joinTime) / 60000);
                // XP hesaplama kodu burada kalmalı, silmiyorum, sadece log ekliyorum. 
                // Ancak replace_file_content ile tüm içeriği değiştirmek zorundayım çünkü araya kod ekliyorum.
                // XP kodunu tekrar yazıyorum:
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
                            userData.level += 1; // Basit level up
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

            // Log
            const { EmbedBuilder } = require('discord.js');
            const { sendLog } = require('../utils/logHelper');
            const embed = new EmbedBuilder()
                .setColor(0xED4245) // Red
                .setAuthor({ name: 'Ses Kanalından Ayrıldı', iconURL: member.user.displayAvatarURL() })
                .setDescription(`<@${member.id}> ses kanalından ayrıldı.`)
                .addFields(
                    { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
                    { name: 'Kanal', value: `<#${oldState.channelId}>`, inline: true }
                )
                .setTimestamp();
            await sendLog(client, guildId, 'voice', embed);
        }

        // 3. Kanal Değiştirdi
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            const joinTime = client.voiceSessions.get(sessionKey);

            if (joinTime && guildSettings.levelSystem?.enabled) {
                const duration = Math.floor((Date.now() - joinTime) / 60000);
                // XP Kodunu tekrar yazıyorum...
                if (duration > 0) {
                    try {
                        const userData = await User.findOrCreate(odasi, guildId, member.user.username);
                        const xpGain = duration * (guildSettings.levelSystem.voiceXpPerMinute || 5);
                        userData.xp += xpGain;
                        userData.totalVoiceMinutes += duration;
                        userData.dailyVoice += duration;
                        userData.weeklyVoice += duration;
                        userData.monthlyVoice += duration;

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

            // Log
            const { EmbedBuilder } = require('discord.js');
            const { sendLog } = require('../utils/logHelper');
            const embed = new EmbedBuilder()
                .setColor(0xFEE75C) // Yellow
                .setAuthor({ name: 'Ses Kanalı Değiştirdi', iconURL: member.user.displayAvatarURL() })
                .setDescription(`<@${member.id}> ses kanalı değiştirdi.`)
                .addFields(
                    { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
                    { name: 'Eski Kanal', value: `<#${oldState.channelId}>`, inline: true },
                    { name: 'Yeni Kanal', value: `<#${newState.channelId}>`, inline: true }
                )
                .setTimestamp();
            await sendLog(client, guildId, 'voice', embed);
        }

        // 4. Durum Değişikliği (Mute/Deaf/Stream/Cam)
        if (oldState.channelId === newState.channelId && oldState.channelId) {
            const changes = [];

            // Server Mute
            if (oldState.serverMute !== newState.serverMute) changes.push(`**Server Mute:** ${newState.serverMute ? '🔇 Susturuldu' : '🔊 Açıldı'}`);
            // Server Deaf
            if (oldState.serverDeaf !== newState.serverDeaf) changes.push(`**Server Deaf:** ${newState.serverDeaf ? '🔇 Sağırlaştırıldı' : '🔊 Açıldı'}`);
            // Self Mute
            if (oldState.selfMute !== newState.selfMute) changes.push(`**Mikrofon:** ${newState.selfMute ? '🔴 Kapattı' : '🟢 Açtı'}`);
            // Self Deaf
            if (oldState.selfDeaf !== newState.selfDeaf) changes.push(`**Kulaklık:** ${newState.selfDeaf ? '🔴 Kapattı' : '🟢 Açtı'}`);
            // Streaming
            if (oldState.streaming !== newState.streaming) changes.push(`**Yayın:** ${newState.streaming ? '📺 Başlattı' : '⏹️ Bitirdi'}`);
            // Camera
            if (oldState.selfVideo !== newState.selfVideo) changes.push(`**Kamera:** ${newState.selfVideo ? '📷 Açtı' : '⏹️ Kapattı'}`);

            if (changes.length > 0) {
                const { EmbedBuilder } = require('discord.js');
                const { sendLog } = require('../utils/logHelper');

                const embed = new EmbedBuilder()
                    .setColor(0xFEE75C) // Yellow
                    .setAuthor({ name: 'Ses Durumu Güncellendi', iconURL: member.user.displayAvatarURL() })
                    .setDescription(`<@${member.id}> (${member.user.tag}) durumunu güncelledi.`)
                    .addFields(
                        { name: 'Kanal', value: `<#${newState.channelId}>`, inline: false },
                        { name: 'Değişiklikler', value: changes.join('\n'), inline: false }
                    )
                    .setTimestamp();

                await sendLog(client, guildId, 'voice', embed);
            }
        }
    }
};
