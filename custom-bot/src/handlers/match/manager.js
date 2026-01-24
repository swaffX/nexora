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

        // Kanalları sil
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

        // Oyuncuları lobiye taşı
        if (match.lobbyVoiceId) {
            const allPlayers = [...(match.teamA || []), ...(match.teamB || [])];
            for (const pid of allPlayers) {
                try {
                    const member = await guild.members.fetch(pid).catch(() => null);
                    if (member && member.voice.channel) {
                        await member.voice.setChannel(match.lobbyVoiceId).catch(() => { });
                    }
                } catch (e) { }
            }
        }

        match.status = 'CANCELLED';
        match.finishReason = reason;
        match.createdChannelIds = []; // Temizle
        await match.save();
        return true;
    },

    /**
     * Maç bittikten sonra normal temizlik.
     */
    async cleanupMatchChannels(guild, match) {
        // 10 saniye bekle ki kullanıcılar sonuç ekranını görsün
        setTimeout(async () => {
            // Tekrar güncel halini çek (arada force end yemiş olabilir)
            const currentMatch = await Match.findOne({ matchId: match.matchId });
            if (!currentMatch || currentMatch.status === 'CANCELLED') return;

            // Kanalları Sil
            if (currentMatch.createdChannelIds) {
                for (const cid of currentMatch.createdChannelIds) {
                    try {
                        const channel = guild.channels.cache.get(cid);
                        if (channel) await channel.delete().catch(() => { });
                    } catch (e) { }
                }
            }

            // Oyuncuları Taşı
            if (currentMatch.lobbyVoiceId) {
                const allPlayers = [...(currentMatch.teamA || []), ...(currentMatch.teamB || [])];
                for (const pid of allPlayers) {
                    try {
                        const member = await guild.members.fetch(pid).catch(() => null);
                        if (member && member.voice.channel) {
                            await member.voice.setChannel(currentMatch.lobbyVoiceId).catch(() => { });
                        }
                    } catch (e) { }
                }
            }

            currentMatch.status = 'FINISHED';
            currentMatch.createdChannelIds = [];
            await currentMatch.save();
        }, 15000);
    },

    /**
     * Zaman aşımı kontrolü (Cron job gibi çalışır)
     */
    async checkTimeouts(client) {
        // 15 dakika boyunca güncelleme almayan maçı iptal et (Setup/Draft/Voting)
        const TIMEOUT_MS = 15 * 60 * 1000;
        const cutoff = new Date(Date.now() - TIMEOUT_MS);
        try {
            const matches = await Match.find({
                status: { $in: ['SETUP', 'DRAFT', 'VOTING', 'SIDE_SELECTION'] },
                updatedAt: { $lt: cutoff }
            });

            for (const match of matches) {
                const guild = client.guilds.cache.get(match.guildId);
                if (guild) {
                    console.log(`[TIMEOUT] Maç zaman aşımına uğradı: ${match.matchId}`);
                    await this.forceEndMatch(guild, match.matchId, 'Zaman aşımı (15dk işlem yok).');
                } else {
                    // Guild yoksa direkt iptal et
                    match.status = 'CANCELLED';
                    await match.save();
                }
            }
        } catch (error) {
            console.error('Timeout check error:', error);
        }
    }
};
