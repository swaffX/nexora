const { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } = require('discord.js');
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
        .setName('statstest')
        .setDescription('Stats kartını test eder (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addUserOption(option =>
            option.setName('user')
                .setDescription('İstatistiklerini görmek istediğiniz kullanıcı (Opsiyonel)')),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            let stats = eloService.createDefaultStats();
            if (userDoc) {
                eloService.ensureValidStats(userDoc);
                await eloService.recalculateStatsFromHistory(userDoc);
                stats = userDoc.matchStats;
            }

            // Rank Hesaplama
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
            const teammateCounts = {};

            for (const m of recentMatches) {
                const isTeamA = m.teamA.includes(targetUser.id);
                const myTeamScore = isTeamA ? m.scoreA : m.scoreB;
                const enemyScore = isTeamA ? m.scoreB : m.scoreA;

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
                    newElo: null,
                    dateObj: m.createdAt,
                    kda: '0/0/0'
                });
            }

            // Best Map
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

            // Favorite Teammate
            let favTeammateData = null;
            let bestMateId = Object.keys(teammateCounts).reduce((a, b) => teammateCounts[a] > teammateCounts[b] ? a : b, null);
            if (bestMateId) {
                try {
                    const tm = await interaction.guild.members.fetch(bestMateId);
                    favTeammateData = { username: tm.displayName, count: teammateCounts[bestMateId], avatarURL: tm.user.displayAvatarURL({ extension: 'png' }) };
                } catch (e) { }
            }

            // Nemesis
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
            await interaction.editReply({ files: [attachment] });

        } catch (error) {
            console.error('Stats Test Hatası:', error);
            await interaction.editReply({ content: '❌ Hata: ' + error.message });
        }
    }
};
