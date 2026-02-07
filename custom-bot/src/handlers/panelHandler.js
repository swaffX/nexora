const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { User, Match } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../utils/canvasGenerator');
const eloService = require('../services/eloService');

/**
 * Handle interactions coming from the static Control Panel buttons
 */
async function handleInteraction(interaction, client) {
    const customId = interaction.customId;
    const guildId = interaction.guild.id;
    const userId = interaction.user.id;

    // Ensure user exists in database
    let userDoc = await User.findOne({ odasi: userId, odaId: guildId });
    if (!userDoc) {
        // Create user if they click button but aren't in DB yet
        userDoc = await User.create({ odasi: userId, odaId: guildId, username: interaction.user.username });
    }

    // Always defer ephemeral for panel actions
    await interaction.deferReply({ flags: [MessageFlags.Ephemeral] });

    try {
        if (customId === 'panel_stats') {
            await handleStats(interaction, userDoc, guildId);
        }
        else if (customId === 'panel_elo') {
            await handleElo(interaction, userDoc, guildId);
        }
        else if (customId === 'panel_titles') {
            await handleTitles(interaction, userDoc, guildId);
        }
        else if (customId === 'panel_customize') {
            await handleCustomize(interaction, userDoc, guildId);
        }
    } catch (error) {
        console.error('Panel Handler Error:', error);
        await interaction.editReply({ content: 'İşlem sırasında bir hata oluştu.' });
    }
}

async function handleStats(interaction, userDoc, guildId) {
    const stats = userDoc.matchStats || eloService.createDefaultStats();

    const historyMatches = await Match.find({
        status: 'FINISHED',
        odaId: guildId,
        $or: [{ teamA: userDoc.odasi }, { teamB: userDoc.odasi }]
    }).sort({ createdAt: -1 });

    const matchHistoryData = historyMatches.slice(0, 5).map(m => {
        const safeTargetId = String(userDoc.odasi);
        const isTeamA = m.teamA.some(id => String(id) === safeTargetId);

        let actualWinner = m.winner;
        if (m.scoreA !== undefined && m.scoreB !== undefined) {
            if (m.scoreA > m.scoreB) actualWinner = 'A';
            else if (m.scoreB > m.scoreA) actualWinner = 'B';
        }

        const isWin = (actualWinner === 'A' && isTeamA) || (actualWinner === 'B' && !isTeamA);
        const result = isWin ? 'WIN' : 'LOSS';
        const myTeamScore = isTeamA ? m.scoreA : m.scoreB;
        const enemyScore = isTeamA ? m.scoreB : m.scoreA;

        let eloChangeVal = 0;
        if (m.eloChanges && Array.isArray(m.eloChanges)) {
            const log = m.eloChanges.find(l => String(l.userId) === safeTargetId);
            if (log) eloChangeVal = log.change;
        }

        const isMvp = (String(m.mvpPlayerId) === safeTargetId || String(m.mvpLoserId) === safeTargetId);

        const dateObj = new Date(m.createdAt);
        const diff = Date.now() - dateObj.getTime();
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const days = Math.floor(hours / 24);
        let timeStr = `${hours}s önce`;
        if (days > 0) timeStr = `${days}g önce`;
        if (hours === 0) timeStr = 'Az önce';

        return {
            map: m.selectedMap || 'Unknown',
            score: `${myTeamScore}-${enemyScore}`,
            result: result,
            eloChange: eloChangeVal,
            isMvp: isMvp,
            date: timeStr
        };
    });

    const teammates = {};
    const mapStatsDict = {};

    for (const m of historyMatches) {
        const safeTargetId = String(userDoc.odasi);
        const isTeamA = m.teamA.some(id => String(id) === safeTargetId);
        const teamList = isTeamA ? m.teamA : m.teamB;

        for (const pid of teamList) {
            if (String(pid) === safeTargetId) continue;
            teammates[pid] = (teammates[pid] || 0) + 1;
        }

        const mapName = m.selectedMap || 'Unknown';
        if (!mapStatsDict[mapName]) mapStatsDict[mapName] = { wins: 0, total: 0 };
        mapStatsDict[mapName].total++;

        let actualWinner = m.winner;
        if (m.scoreA !== undefined && m.scoreB !== undefined) {
            if (m.scoreA > m.scoreB) actualWinner = 'A';
            else if (m.scoreB > m.scoreA) actualWinner = 'B';
        }
        const isWin = (actualWinner === 'A' && isTeamA) || (actualWinner === 'B' && !isTeamA);
        if (isWin) mapStatsDict[mapName].wins++;
    }

    let bestMapData = null;
    let bMapName = null;
    let bWR = -1;

    for (const [mname, data] of Object.entries(mapStatsDict)) {
        if (data.total >= 3) {
            const wr = (data.wins / data.total) * 100;
            if (wr > bWR) { bWR = wr; bMapName = mname; }
        }
    }
    if (bWR === -1 && Object.keys(mapStatsDict).length > 0) {
        bMapName = Object.keys(mapStatsDict).reduce((a, b) => mapStatsDict[a].total > mapStatsDict[b].total ? a : b);
        const d = mapStatsDict[bMapName];
        bWR = (d.wins / d.total) * 100;
    }
    if (bMapName) bestMapData = { name: bMapName, wr: Math.round(bWR) };

    const userRank = await User.countDocuments({ odaId: guildId, 'matchStats.elo': { $gt: stats.elo } }) + 1;

    let favTeammateData = null;
    let maxDuoGames = 0;
    let topDuoId = null;
    for (const [pid, count] of Object.entries(teammates)) {
        if (count > maxDuoGames) { maxDuoGames = count; topDuoId = pid; }
    }
    if (topDuoId) {
        try {
            const tmMember = await interaction.guild.members.fetch(topDuoId);
            favTeammateData = { username: tmMember.displayName, count: maxDuoGames, avatarURL: tmMember.user.displayAvatarURL({ extension: 'png' }) };
        } catch (e) { }
    }

    const nemesisInfo = await eloService.calculateNemesis(userDoc.odasi, guildId);
    let nemesisData = null;
    if (nemesisInfo) {
        try {
            const nMember = await interaction.guild.members.fetch(nemesisInfo.userId);
            nemesisData = { username: nMember.displayName, count: nemesisInfo.count, avatarURL: nMember.user.displayAvatarURL({ extension: 'png' }) };
        } catch (e) { }
    }

    const userForCard = {
        username: interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ extension: 'png' }),
        backgroundImage: userDoc.backgroundImage
    };

    const buffer = await canvasGenerator.createDetailedStatsImage(userForCard, stats, matchHistoryData, bestMapData, favTeammateData, userRank, nemesisData);
    const attachment = new AttachmentBuilder(buffer, { name: 'stats.png' });
    await interaction.editReply({ files: [attachment], flags: [MessageFlags.Ephemeral] });
}

async function handleElo(interaction, userDoc, guildId) {
    const stats = userDoc.matchStats || eloService.createDefaultStats();
    const userRank = await User.countDocuments({ odaId: guildId, 'matchStats.elo': { $gt: stats.elo } }) + 1;

    const userForCard = {
        username: interaction.user.username,
        avatar: interaction.user.displayAvatarURL({ extension: 'png' }),
        backgroundImage: userDoc.backgroundImage
    };

    const buffer = await canvasGenerator.createEloCard(userForCard, stats, userRank);
    const attachment = new AttachmentBuilder(buffer, { name: 'elo.png' });
    await interaction.editReply({ files: [attachment], flags: [MessageFlags.Ephemeral] });
}

async function handleTitles(interaction, userDoc, guildId) {
    const buffer = await canvasGenerator.createTitlesGuideImage();
    const attachment = new AttachmentBuilder(buffer, { name: 'titles-guide.png' });

    const stats = userDoc.matchStats || {};
    const myTitles = stats.titles || ['Rookie'];
    const active = stats.activeTitle || 'Rookie';

    const embed = new EmbedBuilder()
        .setTitle('🏆 Ünvan Rehberi')
        .setDescription(`Şu anki aktif ünvanın: **${active}**\n\n` +
            `Sahip olduğun ünvanlar: ${myTitles.map(t => `\`${t}\``).join(', ')}`)
        .setColor('#fbbf24');

    await interaction.editReply({ embeds: [embed], files: [attachment], flags: [MessageFlags.Ephemeral] });
}

async function handleCustomize(interaction, userDoc, guildId) {
    const getUI = () => {
        const stats = userDoc.matchStats || {};
        const myTitles = stats.titles || ['Rookie'];
        const currentTitle = stats.activeTitle || 'Rookie';
        const currentBg = userDoc.backgroundImage || 'Default';

        const embed = new EmbedBuilder()
            .setTitle('🎨 Profil Kişiselleştirme')
            .setDescription('Buradan kartlarınızın görünümünü değiştirebilirsiniz.')
            .addFields(
                { name: '📍 Aktif Ünvan', value: `\`${currentTitle}\``, inline: true },
                { name: '🖼️ Arkaplan Teması', value: `\`${currentBg}\``, inline: true }
            )
            .setColor('#fbbf24');

        const titleOptions = myTitles.map(t => ({
            label: t,
            value: `title_${t}`,
            description: eloService.ELO_CONFIG.TITLES[t]?.description || 'Nexora Title',
            emoji: '🏆',
            default: t === currentTitle
        }));

        const titleRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('panel_select_title')
                .setPlaceholder('Ünvan seçin...')
                .addOptions(titleOptions)
        );

        const bgOptions = Object.keys(eloService.ELO_CONFIG.BACKGROUND_THEMES).map(bg => ({
            label: bg,
            value: `bg_${bg}`,
            description: `${bg} temalı arkaplan.`,
            emoji: '🖼️',
            default: bg === currentBg
        }));

        const bgRow = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('panel_select_bg')
                .setPlaceholder('Arkaplan teması seçin...')
                .addOptions(bgOptions)
        );

        return { embeds: [embed], components: [titleRow, bgRow] };
    };

    const response = await interaction.editReply(getUI());
    const collector = response.createMessageComponentCollector({ time: 120000 }); // Increase to 2 mins

    collector.on('collect', async i => {
        try {
            if (i.customId === 'panel_select_title') {
                const selected = i.values[0].replace('title_', '');
                userDoc.matchStats.activeTitle = selected;
                await userDoc.save();
                await i.update({ ...getUI(), flags: [MessageFlags.Ephemeral] });
            }
            else if (i.customId === 'panel_select_bg') {
                const selected = i.values[0].replace('bg_', '');
                userDoc.backgroundImage = selected;
                await userDoc.save();
                await i.update({ ...getUI(), flags: [MessageFlags.Ephemeral] });
            }
        } catch (e) {
            console.error('Customize Collector Error:', e);
        }
    });

    collector.on('end', async (_, reason) => {
        if (reason !== 'messageDelete') {
            try {
                // Remove components on timeout to avoid confusion
                await interaction.editReply({ components: [] }).catch(() => { });
            } catch (e) { }
        }
    });
}

module.exports = { handleInteraction };
