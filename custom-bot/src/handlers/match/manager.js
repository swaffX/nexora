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

        await Match.findOneAndUpdate(
            { matchId },
            {
                $set: {
                    status: 'CANCELLED',
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
