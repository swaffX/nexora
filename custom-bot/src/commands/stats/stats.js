const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const path = require('path');
const { User, Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');
const eloService = require('../../services/eloService');

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
                .setDescription('İstatistiklerini görmek istediğiniz kullanıcı (Opsiyonel)')),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const REQUIRED_ROLE_ID = '1466189076347486268';
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
                stats = userDoc.matchStats;
                await userDoc.save();
            }

            const MIN_MATCH_ID = '1468676273680285706';
            const baseQuery = {
                status: 'FINISHED',
                matchId: { $gte: MIN_MATCH_ID },
                $or: [{ teamA: targetUser.id }, { teamB: targetUser.id }]
            };

            const recentMatches = await Match.find(baseQuery).sort({ createdAt: -1 }).limit(5);
            const historyMatches = await Match.find(baseQuery).sort({ createdAt: -1 }).limit(50);

            // 1. Last Matches Data (With ELO Changes)
            const matchHistoryData = [];
            for (const m of recentMatches) {
                const isTeamA = m.teamA.includes(targetUser.id);
                const myTeamScore = isTeamA ? m.scoreA : m.scoreB;
                const enemyScore = isTeamA ? m.scoreB : m.scoreA;

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

                // ELO Change Lookup
                let eloChangeVal = null;
                let currentEloVal = null;
                if (m.eloChanges && Array.isArray(m.eloChanges)) {
                    const log = m.eloChanges.find(l => l.userId === targetUser.id);
                    if (log) {
                        eloChangeVal = log.change;
                        currentEloVal = log.newElo;
                    }
                }

                matchHistoryData.push({
                    map: mapName,
                    result: result,
                    score: `${myTeamScore}-${enemyScore}`,
                    date: dateStr,
                    eloChange: eloChangeVal,
                    newElo: currentEloVal, // Added for display
                    dateObj: m.createdAt // Opsiyonel
                });
            }

            // 2. Best Map & Teammate Analysis
            const teammates = {};
            const mapStats = {};

            for (const m of historyMatches) {
                const safeTargetId = String(targetUser.id);
                const isTeamA = m.teamA.some(id => String(id) === safeTargetId);
                const teamList = isTeamA ? m.teamA : m.teamB;

                for (const pid of teamList) {
                    const safePid = String(pid);
                    if (safePid === safeTargetId) continue;
                    teammates[safePid] = (teammates[safePid] || 0) + 1;
                }

                const mapName = m.selectedMap || 'Unknown';
                if (!mapStats[mapName]) mapStats[mapName] = { wins: 0, total: 0 };
                mapStats[mapName].total++;

                let actualWinner = m.winner;
                if (m.scoreA !== undefined && m.scoreB !== undefined) {
                    if (m.scoreA > m.scoreB) actualWinner = 'A';
                    else if (m.scoreB > m.scoreA) actualWinner = 'B';
                }
                const isWin = (actualWinner === 'A' && isTeamA) || (actualWinner === 'B' && !isTeamA);
                if (isWin) mapStats[mapName].wins++;
            }

            let bestMapData = null;
            let bestMapName = null;
            let bestMapWR = -1;

            for (const [map, data] of Object.entries(mapStats)) {
                if (data.total >= 3) {
                    const wr = (data.wins / data.total) * 100;
                    if (wr > bestMapWR) {
                        bestMapWR = wr;
                        bestMapName = map;
                    }
                }
            }
            if (bestMapWR === -1 && Object.keys(mapStats).length > 0) {
                bestMapName = Object.keys(mapStats).reduce((a, b) => mapStats[a].total > mapStats[b].total ? a : b);
                const data = mapStats[bestMapName];
                bestMapWR = (data.wins / data.total) * 100;
            }
            if (bestMapName) {
                bestMapData = { name: bestMapName, wr: Math.round(bestMapWR) };
            }

            let favTeammateData = null;
            let topTeammateId = null;
            let maxGames = 0;
            for (const [pid, count] of Object.entries(teammates)) {
                if (count > maxGames) {
                    maxGames = count;
                    topTeammateId = pid;
                }
            }
            if (topTeammateId) {
                try {
                    const tmMember = await interaction.guild.members.fetch(topTeammateId);
                    favTeammateData = {
                        username: tmMember.displayName,
                        count: maxGames,
                        avatarURL: tmMember.user.displayAvatarURL({ extension: 'png' })
                    };
                } catch (e) { }
            }

            const userForCard = {
                username: targetUser.username,
                avatar: targetUser.displayAvatarURL({ extension: 'png' })
            };

            const buffer = await canvasGenerator.createDetailedStatsImage(
                userForCard,
                stats,
                matchHistoryData,
                bestMapData,
                favTeammateData
            );

            const attachment = new AttachmentBuilder(buffer, { name: 'stats-card.png' });
            await interaction.editReply({ content: '', embeds: [], files: [attachment] });

        } catch (error) {
            console.error('Stats Komutu Hatası:', error);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        }
    }
};
