const { SlashCommandBuilder, AttachmentBuilder, MessageFlags, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User, Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');
const eloService = require('../../services/eloService');
const CONFIG = require('../../config');

function getTimeAgo(date) {
    const seconds = Math.floor((new Date() - date) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " yıl önce";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " ay önce";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " gün önce";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " saat önce";
    interval = seconds / 60;
    if (interval > 1) return Math.floor(interval) + " dakika önce";
    return "az önce";
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Detaylı oyuncu istatistiklerini, maç geçmişini ve ELO durumunu gösterir.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('İstatistiklerini görmek istediğiniz kullanıcı (Opsiyonel)'))
        .addStringOption(option =>
            option.setName('view')
                .setDescription('Görüntüleme Modu')
                .addChoices(
                    { name: 'Genel Profil (Kart)', value: 'card' },
                    { name: 'Harita İstatistikleri (Detaylı)', value: 'maps' }
                )),

    async execute(interaction) {
        await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const viewMode = interaction.options.getString('view') || 'card';
            const guildId = interaction.guild.id;

            const REQUIRED_ROLE_ID = CONFIG.ROLES.VALORANT;

            let member = null;
            try {
                member = await interaction.guild.members.fetch(targetUser.id);
            } catch (e) {
                return interaction.editReply({ content: `❌ **Hata:** Kullanıcı sunucuda bulunamadı.` });
            }

            if (!member || !member.roles.cache.has(REQUIRED_ROLE_ID)) {
                return interaction.editReply({ content: `❌ **Erişim Reddedildi:** Bu kullanıcının ELO sistemine dahil olması için <@&${REQUIRED_ROLE_ID}> rolüne sahip olması gerekir.` });
            }

            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            let stats = eloService.createDefaultStats();
            if (userDoc) {
                eloService.ensureValidStats(userDoc);
                // Her stats çekildiğinde geçmişten MVPlere bakarak doğruluğu garanti edelim
                // NOT: recalculateStatsFromHistory artık mapStats verisini de dolduruyor.
                await eloService.recalculateStatsFromHistory(userDoc);
                stats = userDoc.matchStats;
            }

            // --- HARİTA İSTATİSTİKLERİ MODU ---
            if (viewMode === 'maps') {
                const mapStats = stats.mapStats || {};
                const maps = Object.entries(mapStats).sort((a, b) => b[1].wins - a[1].wins); // En çok kazanana göre sırala

                if (maps.length === 0) {
                    return interaction.editReply({ content: '📊 Henüz kayıtlı harita istatistiği yok.' });
                }

                const embed = new EmbedBuilder()
                    .setColor('#fbbf24')
                    .setAuthor({ name: `${targetUser.username} • Harita İstatistikleri`, iconURL: targetUser.displayAvatarURL() })
                    .setDescription('Oynanan haritalardaki performans analizi.');

                let description = '';

                for (const [mapName, data] of maps) {
                    const total = data.wins + data.losses;
                    if (total === 0) continue;
                    const wr = Math.round((data.wins / total) * 100);

                    // Emoji belirle (Kazanma oranına göre)
                    let statusEmoji = '➖';
                    if (wr >= 60) statusEmoji = '🔥';
                    else if (wr <= 40) statusEmoji = '❄️';

                    description += `**${mapName}** ${statusEmoji}\n` +
                        `> Kazanma: **%${wr}** (${data.wins}W - ${data.losses}L)\n` +
                        `> Toplam: ${total} Maç\n\n`;
                }

                embed.setDescription(description || 'Henüz maç verisi yok.');

                return interaction.editReply({ embeds: [embed] });
            }

            // --- GENEL KART MODU (Mevcut Kod) ---
            const userRank = await User.countDocuments({
                odaId: guildId,
                'matchStats.totalMatches': { $gt: 0 },
                'matchStats.elo': { $gt: stats.elo }
            }) + 1;

            const MIN_MATCH_ID = CONFIG.SETTINGS.MIN_MATCH_ID;
            const baseQuery = {
                status: 'FINISHED',
                matchId: { $gte: MIN_MATCH_ID },
                $or: [{ teamA: targetUser.id }, { teamB: targetUser.id }]
            };

            const recentMatches = await Match.find(baseQuery).sort({ createdAt: -1 }).limit(5);

            const matchHistoryData = [];
            const safeTargetId = String(targetUser.id);

            // Teammate hesaplaması için (Sadece son 5 maçtan - Basit Versiyon)
            const teammateCounts = {};

            for (const m of recentMatches) {
                const isTeamA = m.teamA.includes(targetUser.id);
                const myTeamScore = isTeamA ? m.scoreA : m.scoreB;
                const enemyScore = isTeamA ? m.scoreB : m.scoreA;

                // Teammate sayma
                const myTeamIds = isTeamA ? m.teamA : m.teamB;
                for (const pid of myTeamIds) {
                    if (pid !== targetUser.id) {
                        teammateCounts[pid] = (teammateCounts[pid] || 0) + 1;
                    }
                }

                let actualWinner = m.winner;
                if (m.scoreA !== undefined && m.scoreB !== undefined) {
                    if (m.scoreA > m.scoreB) actualWinner = 'A';
                    else if (m.scoreB > m.scoreA) actualWinner = 'B';
                }

                let result = 'DRAW';
                if ((isTeamA && actualWinner === 'A') || (!isTeamA && actualWinner === 'B')) result = 'WIN';
                else if ((isTeamA && actualWinner === 'B') || (!isTeamA && actualWinner === 'A')) result = 'LOSS';

                const mapName = m.selectedMap || 'Unknown';
                const dateStr = getTimeAgo(m.createdAt);

                let eloChangeVal = null;
                let currentEloVal = null; // Canvas bunu kullanmıyor şu an, gerekirse eklenebilir

                if (m.eloChanges && Array.isArray(m.eloChanges)) {
                    const change = m.eloChanges.find(x => x.userId === targetUser.id);
                    if (change) eloChangeVal = change.change;
                }

                const isMvp = (String(m.mvpPlayerId) === safeTargetId || String(m.mvpLoserId) === safeTargetId);

                matchHistoryData.push({
                    map: mapName,
                    result: result,
                    score: `${myTeamScore}-${enemyScore}`,
                    date: dateStr,
                    eloChange: eloChangeVal,
                    isMvp: isMvp,
                    newElo: currentEloVal,
                    dateObj: m.createdAt,
                    kda: '0/0/0' // Placeholder
                });
            }

            // Best Map hesaplama (Service'ten gelen mapStats ile)
            let bestMapData = null;
            if (stats.mapStats && Object.keys(stats.mapStats).length > 0) {
                let bestWR = -1;
                let bestName = null;

                for (const [name, data] of Object.entries(stats.mapStats)) {
                    const total = data.wins + data.losses;
                    if (total >= 3) {
                        const wr = (data.wins / total) * 100;
                        if (wr > bestWR) {
                            bestWR = wr;
                            bestName = name;
                        }
                    }
                }

                // Eğer min 3 maçlık harita yoksa, en çok oynananı baz al
                if (!bestName) {
                    bestName = Object.keys(stats.mapStats).reduce((a, b) => {
                        const totalA = stats.mapStats[a].wins + stats.mapStats[a].losses;
                        const totalB = stats.mapStats[b].wins + stats.mapStats[b].losses;
                        return totalA > totalB ? a : b;
                    });

                    if (bestName) {
                        const d = stats.mapStats[bestName];
                        const total = d.wins + d.losses;
                        const wr = (d.wins / total) * 100;
                        bestMapData = { name: bestName, wr: Math.round(wr) };
                    }
                } else {
                    bestMapData = { name: bestName, wr: Math.round(bestWR) };
                }
            }

            // En iyi takım arkadaşı (Son 5 maçtan)
            let favTeammateData = null;
            let bestMateId = Object.keys(teammateCounts).reduce((a, b) => teammateCounts[a] > teammateCounts[b] ? a : b, null);
            if (bestMateId) {
                try {
                    const tm = await interaction.guild.members.fetch(bestMateId);
                    favTeammateData = { username: tm.displayName, count: teammateCounts[bestMateId], avatarURL: tm.user.displayAvatarURL({ extension: 'png' }) };
                } catch (e) { }
            }


            // --- EZELİ RAKİP (NEMESIS) ---
            const nemesisInfo = await eloService.calculateNemesis(targetUser.id, guildId);
            let nemesisData = null;
            if (nemesisInfo) {
                try {
                    const nMember = await interaction.guild.members.fetch(nemesisInfo.userId);
                    nemesisData = {
                        username: nMember.displayName,
                        count: nemesisInfo.count,
                        avatarURL: nMember.user.displayAvatarURL({ extension: 'png' })
                    };
                } catch (e) { }
            }

            const userForCard = {
                username: targetUser.username,
                avatar: targetUser.displayAvatarURL({ extension: 'png' }),
                backgroundImage: userDoc?.backgroundImage,
                favoriteAgent: userDoc?.favoriteAgent,
                favoriteMap: userDoc?.favoriteMap
            };

            const buffer = await canvasGenerator.createDetailedStatsImage(
                userForCard,
                stats,
                matchHistoryData,
                bestMapData,
                favTeammateData,
                userRank,
                nemesisData
            );

            const attachment = new AttachmentBuilder(buffer, { name: 'stats-card.png' });
            await interaction.editReply({ content: '', embeds: [], files: [attachment] });

        } catch (error) {
            console.error('Stats Komutu Hatası:', error);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        }
    }
};
