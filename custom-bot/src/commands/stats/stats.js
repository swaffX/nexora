const { SlashCommandBuilder, EmbedBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User, Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../../utils/canvasGenerator');
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('stats') // Adı stats oldu
        .setDescription('Detaylı oyuncu istatistiklerini, maç geçmişini ve ELO durumunu gösterir.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('İstatistiklerini görmek istediğiniz kullanıcı (Opsiyonel)')),

    async execute(interaction) {
        await interaction.deferReply(); // İşlem uzun sürebilir

        try {
            const targetUser = interaction.options.getUser('user') || interaction.user;
            const guildId = interaction.guild.id;

            // ROL KONTROLÜ
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

            // User Doc Çek
            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            // Stats Hazırla (Yoksa default oluştur)
            let stats = eloService.createDefaultStats();
            if (userDoc) {
                eloService.ensureValidStats(userDoc);
                stats = userDoc.matchStats;
                await userDoc.save();
            }

            // --- CANVAS KART OLUŞTUR (Görsel Özet) ---
            const userForCard = {
                username: targetUser.username,
                avatar: targetUser.displayAvatarURL({ extension: 'png' })
            };
            const buffer = await canvasGenerator.createEloCard(userForCard, stats);
            const attachment = new AttachmentBuilder(buffer, { name: 'elo-card.png' });

            // --- MAÇ GEÇMİŞİ ANALİZİ ---
            // Son 5 Maç (Detaylı Liste İçin)
            const recentMatches = await Match.find({
                status: 'FINISHED',
                $or: [{ teamA: targetUser.id }, { teamB: targetUser.id }]
            }).sort({ createdAt: -1 }).limit(5);

            // Son 50 Maç (Duo ve Map Analizi İçin - Daha kesin veri)
            const historyMatches = await Match.find({
                status: 'FINISHED',
                $or: [{ teamA: targetUser.id }, { teamB: targetUser.id }]
            }).sort({ createdAt: -1 }).limit(50);

            // ANALİZLER
            const teammates = {};
            const mapStats = {}; // { 'Ascent': { wins: 0, total: 0 } }

            for (const m of historyMatches) {
                const safeTargetId = String(targetUser.id);
                // String conversion for robust check
                const isTeamA = m.teamA.some(id => String(id) === safeTargetId);
                const teamList = isTeamA ? m.teamA : m.teamB;

                // Teammate Analizi
                for (const pid of teamList) {
                    const safePid = String(pid);
                    if (safePid === safeTargetId) continue;
                    teammates[safePid] = (teammates[safePid] || 0) + 1;
                }

                // Map Analizi
                const mapName = m.selectedMap || 'Unknown';
                if (!mapStats[mapName]) mapStats[mapName] = { wins: 0, total: 0 };

                mapStats[mapName].total++;

                // Kazanma Kontrolü
                // KAZANAN BELİRLEME (Score Based Fallback)
                // KAZANAN BELİRLEME (Score Based Fallback - Always Trust Score)
                let actualWinner = m.winner;
                if (m.scoreA !== undefined && m.scoreB !== undefined) {
                    if (m.scoreA > m.scoreB) actualWinner = 'A';
                    else if (m.scoreB > m.scoreA) actualWinner = 'B';
                }

                // Kazanma Kontrolü
                const isWin = (actualWinner === 'A' && isTeamA) || (actualWinner === 'B' && !isTeamA);
                if (isWin) mapStats[mapName].wins++;
            }

            // En İyi Teammate
            let topTeammateId = null;
            let maxGames = 0;
            for (const [pid, count] of Object.entries(teammates)) {
                if (count > maxGames) {
                    maxGames = count;
                    topTeammateId = pid;
                }
            }

            // En İyi Harita
            let bestMap = 'Yeterli veri yok';
            let bestMapWR = -1;

            for (const [map, data] of Object.entries(mapStats)) {
                // En az 3 maç oynanmış olmalı
                if (data.total >= 3) {
                    const wr = (data.wins / data.total) * 100;
                    if (wr > bestMapWR) {
                        bestMapWR = wr;
                        bestMap = `${map} (%${Math.round(wr)} WR - ${data.wins}W/${data.total - data.wins}L)`;
                    }
                }
            }
            // Hiçbiri 3 maçı geçemediyse en çok oynananı göster
            if (bestMapWR === -1 && Object.keys(mapStats).length > 0) {
                const mostPlayed = Object.keys(mapStats).reduce((a, b) => mapStats[a].total > mapStats[b].total ? a : b);
                const data = mapStats[mostPlayed];
                const wr = (data.wins / data.total) * 100;
                bestMap = `${mostPlayed} (%${Math.round(wr)} WR)`;
            }

            // --- EMBED OLUŞTUR ---
            // Maç Geçmişi Listesi Stringi
            let historyText = '';
            if (recentMatches.length === 0) {
                historyText = 'Henüz maç oynanmadı.';
            } else {
                for (const m of recentMatches) {
                    const isTeamA = m.teamA.includes(targetUser.id);
                    const myTeamScore = isTeamA ? m.scoreA : m.scoreB;
                    const enemyScore = isTeamA ? m.scoreB : m.scoreA;


                    // KAZANAN BELİRLEME (Score Based Fallback)
                    let actualWinner = m.winner;
                    if (m.scoreA !== undefined && m.scoreB !== undefined) {
                        if (m.scoreA > m.scoreB) actualWinner = 'A';
                        else if (m.scoreB > m.scoreA) actualWinner = 'B';
                    }

                    let resultEmoji = '❓'; // Default Bilinmeyen
                    if ((isTeamA && actualWinner === 'A') || (!isTeamA && actualWinner === 'B')) resultEmoji = '✅'; // WIN
                    else if ((isTeamA && actualWinner === 'B') || (!isTeamA && actualWinner === 'A')) resultEmoji = '❌'; // LOSS

                    const mapName = m.selectedMap || 'Unknown';
                    const dateStr = `<t:${Math.floor(m.createdAt.getTime() / 1000)}:R>`;

                    historyText += `${resultEmoji} **${mapName}** (${myTeamScore}-${enemyScore}) • ${dateStr}\n`;
                }
            }

            // Teammate Stringi
            let teammateText = 'Yeterli veri yok';
            if (topTeammateId) {
                teammateText = `<@${topTeammateId}> ile **${maxGames}** maç`;
            }

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setTitle(`📊 İstatistikler: ${targetUser.username}`)
                .setThumbnail(targetUser.displayAvatarURL({ extension: 'png' }))
                .addFields(
                    { name: '🔥 Son Maçlar', value: historyText, inline: false },
                    { name: '🗺️ En İyi Harita', value: bestMap, inline: true },
                    { name: '👥 En Sık Oynanan Teammate', value: teammateText, inline: true },
                    { name: '📈 Kazanma Oranı (WR)', value: `%${Math.round((stats.totalWins / stats.totalMatches * 100)) || 0} (${stats.totalWins}W / ${stats.totalMatches - stats.totalWins}L)`, inline: true }
                )
                .setImage('attachment://elo-card.png')
                .setFooter({ text: 'Nexora Competitive', iconURL: interaction.guild.iconURL() });

            await interaction.editReply({ embeds: [embed], files: [attachment] });

        } catch (error) {
            console.error('Stats Komutu Hatası:', error);
            await interaction.editReply({ content: 'Bir hata oluştu.' });
        }
    }
};
