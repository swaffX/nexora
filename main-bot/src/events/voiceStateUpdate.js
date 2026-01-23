const path = require('path');
const { User, Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const voiceMasterHandler = require('../handlers/voiceMasterHandler'); // Yeni Handler
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { EmbedBuilder } = require('discord.js');

const XP_PER_MINUTE = 5; // Dakika başına kazanılacak XP

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        if (!newState.guild) return;
        if (oldState.member?.user.bot || newState.member?.user.bot) return;

        const guildId = newState.guild.id;
        const userId = newState.member.id;

        // ==================== 🛠️ MASTER VOICE HUB LOGIC ====================
        try {
            // Bir kanala katıldıysa
            if (newState.channelId) {
                await voiceMasterHandler.handleJoin(newState, client);
            }
            // Bir kanaldan ayrıldıysa (veya kanal değiştirdiyse)
            if (oldState.channelId && oldState.channelId !== newState.channelId) {
                await voiceMasterHandler.handleLeave(oldState);
            }
        } catch (error) {
            console.error('[VoiceHub] Hata:', error);
        }
        // ===================================================================

        // AFK Kanal Kontrolü
        const afkChannelId = newState.guild.afkChannelId;

        try {
            // Kullanıcı verisini çek
            let user = await User.findOne({ odasi: userId, odaId: guildId });
            if (!user) {
                user = await User.create({ odasi: userId, odaId: guildId, username: newState.member.user.username });
            } else if (user.username !== newState.member.user.username) {
                user.username = newState.member.user.username;
            }

            // ==================== DURUM 1: KANALA KATILMA ====================
            if (!oldState.channelId && newState.channelId) {
                // Eğer AFK kanalına katıldıysa süre başlatma
                if (newState.channelId !== afkChannelId) {
                    user.voiceJoinedAt = new Date();
                    user.currentVoiceChannel = newState.channelId;
                    await user.save();
                }
            }

            // ==================== DURUM 2: KANALDAN AYRILMA ====================
            else if (oldState.channelId && !newState.channelId) {
                if (user.voiceJoinedAt) {
                    await processVoiceSession(user, oldState.guild, client);
                }
            }

            // ==================== DURUM 3: KANAL DEĞİŞTİRME ====================
            else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                // 1. Eski kanaldan çıkış işlemini yap
                if (user.voiceJoinedAt) {
                    await processVoiceSession(user, oldState.guild, client);
                }

                // 2. Yeni kanal için süre başlat (AFK değilse)
                if (newState.channelId !== afkChannelId) {
                    user.voiceJoinedAt = new Date();
                    user.currentVoiceChannel = newState.channelId;
                    await user.save();
                }
            }

        } catch (error) {
            console.error('[VoiceStateUpdate] Hata:', error);
        }
    }
};

/**
 * Ses oturumunu kapatır, süreyi hesaplar ve ödülü verir.
 */
async function processVoiceSession(user, guild, client) {
    const joinedAt = new Date(user.voiceJoinedAt);
    const leftAt = new Date();
    const durationMs = leftAt - joinedAt;
    const durationMinutes = Math.floor(durationMs / 1000 / 60);

    // Veriyi sıfırla
    user.voiceJoinedAt = null;
    user.currentVoiceChannel = null;

    // Eğer 1 dakikadan azsa kaydetme (db yazma tasarrufu)
    if (durationMinutes < 1) {
        await user.save();
        return;
    }

    // İstatistikleri Güncelle
    user.totalVoiceMinutes += durationMinutes;
    user.dailyVoice += durationMinutes;
    user.weeklyVoice += durationMinutes;
    user.monthlyVoice += durationMinutes;

    // XP Kazanımı
    const xpEarned = durationMinutes * XP_PER_MINUTE;
    const newLevel = await user.addXP(xpEarned);

    // Level Atladıysa Bildir
    if (newLevel) {
        const guildSettings = await Guild.findOne({ odaId: guild.id });
        if (guildSettings && guildSettings.levelSystem?.logChannelId) {
            const logChannel = client.channels.cache.get(guildSettings.levelSystem.logChannelId);
            if (logChannel) {
                const embed = new EmbedBuilder()
                    .setColor('#00FF00')
                    .setDescription(`🎉 <@${user.odasi}> tebrikler! **Level ${newLevel}** oldun! 🔊 (Ses Aktifliği)`);
                logChannel.send({ embeds: [embed] }).catch(() => { });
            }
        }
    }

    // SES LOGU GÖNDER (MODLOG)
    const voiceLogEmbed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle('🔊 Ses Oturumu Sonlandı')
        .setDescription(`<@${user.odasi}> ses kanalından ayrıldı.`)
        .addFields(
            { name: 'Kanal', value: `${guild.channels.cache.get(user.currentVoiceChannel)?.name || 'Bilinmiyor'}`, inline: true },
            { name: 'Süre', value: `⏱️ ${durationMinutes} dakika`, inline: true },
            { name: 'Kazanılan XP', value: `✨ ${durationMinutes * XP_PER_MINUTE} XP`, inline: true }
        )
        .setTimestamp();

    const { sendLog } = require('../utils/logHelper');
    await sendLog(client, guild.id, 'voice', voiceLogEmbed);

    await user.save();
}
