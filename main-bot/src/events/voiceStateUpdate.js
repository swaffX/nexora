const path = require('path');
const { User, Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const voiceMasterHandler = require('../handlers/voiceMasterHandler'); // Yeni Handler
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

const XP_PER_MINUTE = 5; // Dakika başına kazanılacak XP

module.exports = {
    name: 'voiceStateUpdate',
    async execute(oldState, newState, client) {
        if (!newState.guild) return;
        const guildId = newState.guild.id;

        // Üyeyi güvenli şekilde al
        let member = newState.member;
        if (!member) {
            try { member = await newState.guild.members.fetch(newState.id); }
            catch (e) { return; } // Üye bulunamazsa işlem yapma
        }

        // KRİTİK: Member ve User check
        if (!member || !member.user) return;

        const userId = member.id;
        if (member.user.bot) return;

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
                user = await User.create({ odasi: userId, odaId: guildId, username: member.user.username });
            } else if (user.username !== member.user.username) {
                user.username = member.user.username;
            }

            // ==================== DURUM 1: KANALA KATILMA ====================
            if (!oldState.channelId && newState.channelId) {
                // Eğer AFK kanalına katıldıysa süre başlatma
                if (newState.channelId !== afkChannelId) {
                    user.voiceJoinedAt = new Date();
                    user.currentVoiceChannel = newState.channelId;
                    await user.save();

                    // SES GİRİŞ LOGU GÖNDER
                    const channelName = newState.channel?.name || 'Bilinmiyor';
                    const joinLogEmbed = new EmbedBuilder()
                        .setColor('#22c55e')
                        .setAuthor({ name: '🎙️ Ses Oturumu Başladı', iconURL: member.user.displayAvatarURL() })
                        .setDescription(`<@${userId}> ses kanalına katıldı.`)
                        .addFields(
                            { name: '🔊 Kanal', value: `\`${channelName}\``, inline: true },
                            { name: '⏰ Giriş', value: `<t:${Math.floor(Date.now() / 1000)}:T>`, inline: true }
                        )
                        .setFooter({ text: `ID: ${userId}` })
                        .setTimestamp();

                    const { sendLog } = require('../utils/logHelper');
                    await sendLog(client, guildId, 'voice', joinLogEmbed);
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
    const durationSeconds = Math.floor(durationMs / 1000);

    // KANAL ADINI KAYDET (DB güncellenmeden önce)
    const lastChannelId = user.currentVoiceChannel;
    let channelName = 'Bilinmiyor';
    if (lastChannelId) {
        const ch = guild.channels.cache.get(lastChannelId);
        if (ch) channelName = ch.name;
    }

    // Veriyi sıfırla
    user.voiceJoinedAt = null;
    user.currentVoiceChannel = null;

    // Eğer 10 saniyeden azsa kaydetme (db tasarrufu)
    if (durationSeconds < 10) {
        await user.save();
        return;
    }

    // İstatistikleri Güncelle (Dakika olarak)
    user.totalVoiceMinutes += durationMinutes; // Dakika bazlı kalsın (genel istatistik)
    user.dailyVoice += durationMinutes;
    user.weeklyVoice += durationMinutes;
    user.monthlyVoice += durationMinutes;

    // XP Kazanımı kaldırıldı.

    // SES ÇIKIŞ LOGU GÖNDER (Modern Tasarım)
    const voiceLogEmbed = new EmbedBuilder()
        .setColor('#ef4444')
        .setAuthor({ name: '🔇 Ses Oturumu Sonlandı', iconURL: guild.client.users.cache.get(user.odasi)?.displayAvatarURL() || null })
        .setDescription(`<@${user.odasi}> ses kanalından ayrıldı.`)
        .addFields(
            { name: '🔊 Kanal', value: `\`${channelName}\``, inline: true },
            { name: '⏱️ Süre', value: `**${durationMinutes}** dakika (**${durationSeconds}** sn)`, inline: true }
        )
        .setFooter({ text: `ID: ${user.odasi}` })
        .setTimestamp();

    const { sendLog } = require('../utils/logHelper');

    // DM Bildirimi devre dışı bırakıldı.

    await sendLog(client, guild.id, 'voice', voiceLogEmbed);

    // Quest Update (Saniye olarak gönder)
    try {
        const { updateQuestProgress } = require('../utils/questManager');
        await updateQuestProgress(user, 'voice', durationSeconds);
    } catch (e) { console.error('Voice Quest Error:', e); }

    await user.save();
}
