const { ChannelType } = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    /**
     * Maçı zorla bitirir ve kanalları temizler.
     */
    async forceEndMatch(guild, matchId, reason = 'Maç iptal edildi.') {
        const match = await Match.findOne({ matchId });
        if (!match) return false;

        // 1. ÖNCE: Ses Kanallarındaki HERKESİ taşı
        if (match.lobbyVoiceId && match.createdChannelIds && match.createdChannelIds.length > 0) {
            const movePromises = [];

            for (const cid of match.createdChannelIds) {
                try {
                    const channel = guild.channels.cache.get(cid);
                    // Sadece Ses Kanallarını kontrol et
                    if (channel && channel.type === ChannelType.GuildVoice) {
                        // Kanaldaki HERKESİ (members) al
                        for (const [memberId, member] of channel.members) {
                            if (member.voice.channelId !== match.lobbyVoiceId) {
                                movePromises.push(
                                    member.voice.setChannel(match.lobbyVoiceId).catch(e => console.log(`Move Error (${member.user.tag}):`, e.message))
                                );
                            }
                        }
                    }
                } catch (e) {
                    console.error('Channel fetch error in cleanup:', e);
                }
            }

            // Hepsini taşı ve bekle
            if (movePromises.length > 0) {
                await Promise.allSettled(movePromises);
                // Ekstra güvenlik beklemesi (Discord bazen gecikir)
                await new Promise(resolve => setTimeout(resolve, 1500));
            }
        }

        // 2. SONRA: Kanalları sil
        if (match.createdChannelIds && match.createdChannelIds.length > 0) {
            for (const cid of match.createdChannelIds) {
                try {
                    const channel = guild.channels.cache.get(cid);
                    if (channel) await channel.delete().catch(() => { });
                } catch (e) {
                    console.error(`Kanal silinemedi (${cid}):`, e.message);
                }
            }
        }

        // 3. LOGLAMA (Kanal Silinmeden Önce Logu Hazırla, Silindikten Sonra Gönder)
        try {
            const { EmbedBuilder } = require('discord.js');
            const { LOBBY_CONFIG } = require('./constants');
            const logsChannelId = '1468002079632134369';
            const logsChannel = guild.channels.cache.get(logsChannelId);

            if (logsChannel) {
                // Lobi Bilgisi
                let lobbyName = 'Bilinmeyen Lobi';
                const lobby = Object.values(LOBBY_CONFIG).find(l => l.voiceId === match.lobbyVoiceId);
                if (lobby) lobbyName = lobby.name;

                // Süre Hesabı
                const startTime = match.createdAt;
                const endTime = new Date();
                const durationMs = endTime - startTime;
                const durationMinutes = Math.floor(durationMs / 60000);
                const durationHours = Math.floor(durationMinutes / 60);
                const durationStr = `${durationHours > 0 ? `${durationHours} sa ` : ''}${durationMinutes % 60} dk`;

                // Katılımcılar
                const formatTeam = (ids) => ids.map(id => `<@${id}>`).join(', ') || 'Yok';

                const embed = new EmbedBuilder()
                    .setColor(0x3498DB)
                    .setTitle(`📝 Maç Sonuçlandı (#${match.matchNumber || '?'})`)
                    .addFields(
                        { name: '📍 Lobi', value: lobbyName, inline: true },
                        { name: '👑 Oluşturan Yetkili', value: `<@${match.hostId}>`, inline: true },
                        { name: '⏱️ Süre', value: `\`${durationStr}\`\n(<t:${Math.floor(startTime.getTime() / 1000)}:t> - <t:${Math.floor(endTime.getTime() / 1000)}:t>)`, inline: true },
                        { name: '🔵 Team A', value: formatTeam(match.teamA), inline: false },
                        { name: '🔴 Team B', value: formatTeam(match.teamB), inline: false }
                    )
                    .setFooter({ text: `Nexora Logs • Match ID: ${matchId}` })
                    .setTimestamp();

                await logsChannel.send({ embeds: [embed] });
            }
        } catch (logErr) {
            console.error('Loglama Hatası:', logErr);
        }

        await Match.findOneAndUpdate(
            { matchId },
            {
                $set: {
                    status: 'CANCELLED', // veya FINISHED, ama forceEnd genelde Cancelled oluyor. Logda "Sonuçlandı" dedik.
                    finishReason: reason,
                    createdChannelIds: []
                }
            }
        );
        return true;
    },

    /**
     * Maç bittikten sonra normal temizlik.
     */
    async cleanupMatchChannels(guild, match) {
        // Artık kanalları silmiyoruz, sadece DB statüsünü güncelle
        // Ve listeyi temizle ki bir sonraki maçta yeni kanallar eklensin
        const currentMatch = await Match.findOne({ matchId: match.matchId });
        if (!currentMatch) return;

        currentMatch.status = 'FINISHED';
        // Voice kanallarını createdChannelIds içinden sakla, çünkü yeniden kullanılacak
        // Ama yeni maç için ID listesi temizlenmeli.
        // O yüzden createdChannelIds'i temizliyoruz. Kanallar sunucuda kalıyor.
        currentMatch.createdChannelIds = [];
        await currentMatch.save();
    },

    async cleanupVoiceChannels(guild, match) {
        // Ses kanallarını siler (Takımları Değiştir veya Lobi Bitir durumunda)
        if (match.createdChannelIds) {
            for (const cid of match.createdChannelIds) {
                try {
                    const channel = guild.channels.cache.get(cid);
                    if (channel && channel.type === ChannelType.GuildVoice) {
                        await channel.delete().catch(() => { });
                    }
                } catch (e) { }
            }
        }
    },

    /**
     * Zaman aşımı kontrolü (Cron job gibi çalışır)
     * KULLANNICI İSTEĞİ ÜZERİNE DEVRE DIŞI BIRAKILDI.
     * Artık maçlar otomatik silinmez, manuel bitirilmesi gerekir.
     */
    async checkTimeouts(client) {
        // Otomatik silme iptal edildi.
        return;
    }
};
