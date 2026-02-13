const { AttachmentBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const { User } = require('../../../shared/models');
const config = require('../config');
const canvasGenerator = require('../utils/canvasGenerator');
const eloService = require('../services/eloService');

const LEADERBOARD_CHANNEL_ID = '1468414391300132894';
const REQUIRED_ROLE_ID = config.ROLES.VALORANT;

function buildButtons(activeMode = 'elo') {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId('lb_mode_elo')
            .setLabel('Top ELO')
            .setStyle(activeMode === 'elo' ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('lb_mode_streak')
            .setLabel('Win Streak')
            .setStyle(activeMode === 'streak' ? ButtonStyle.Danger : ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId('lb_mode_mvp')
            .setLabel('Top MVP')
            .setStyle(activeMode === 'mvp' ? ButtonStyle.Danger : ButtonStyle.Secondary)
    );
}

async function buildTopUsers(guild, client, mode = 'elo') {
    const finalTopUsers = [];

    let sort;
    if (mode === 'streak') {
        sort = { 'matchStats.winStreak': -1, 'matchStats.elo': -1 };
    } else if (mode === 'mvp') {
        sort = { 'matchStats.totalMVPs': -1, 'matchStats.elo': -1 };
    } else {
        sort = { 'matchStats.elo': -1 };
    }

    const rankedCandidates = await User.find({
        'matchStats.elo': { $exists: true },
        odaId: guild.id
    })
        .sort(sort)
        .limit(100);

    for (const doc of rankedCandidates) {
        if (finalTopUsers.length >= 10) break;

        try {
            const member = await guild.members.fetch(doc.odasi).catch(() => null);
            if (member && member.roles.cache.has(REQUIRED_ROLE_ID)) {
                finalTopUsers.push(doc);
            }
        } catch (e) { }
    }

    if (finalTopUsers.length === 0 && mode !== 'elo') {
        // Yedek: hiç veri yoksa ELO moduna fallback
        return buildTopUsers(guild, client, 'elo');
    }

    // Eğer 10 kişi dolmadıysa, rolü olan diğer kayıtlı kullanıcılarla tamamla (sadece elo modu için mantıklı)
    if (mode === 'elo' && finalTopUsers.length < 10) {
        const existingIds = finalTopUsers.map(u => u._id.toString());

        const unrankedCandidates = await User.find({
            'matchStats.elo': { $exists: false },
            odasi: { $exists: true, $ne: '' },
            odaId: guild.id
        }).sort({ createdAt: -1 }).limit(100);

        for (const doc of unrankedCandidates) {
            if (finalTopUsers.length >= 10) break;
            if (existingIds.includes(doc._id.toString())) continue;

            try {
                const member = await guild.members.fetch(doc.odasi).catch(() => null);
                if (member && member.roles.cache.has(REQUIRED_ROLE_ID)) {
                    if (!doc.matchStats) doc.matchStats = {};
                    doc.matchStats.elo = eloService.ELO_CONFIG.DEFAULT_ELO;
                    doc.matchStats.matchLevel = eloService.ELO_CONFIG.DEFAULT_LEVEL;
                    doc.matchStats.totalMatches = 0;
                    doc.matchStats.totalWins = 0;

                    finalTopUsers.push(doc);
                }
            } catch (e) { }
        }
    }

    return finalTopUsers;
}

async function buildLeaderboardPayload(client, guild, mode = 'elo') {
    const finalTopUsers = await buildTopUsers(guild, client, mode);

    if (finalTopUsers.length === 0) {
        return { empty: true };
    }

    const usersWithNames = [];
    for (const doc of finalTopUsers) {
        let username = `Player ${doc.odasi.substring(0, 4)} `;
        let avatarURL = null;
        try {
            const user = await client.users.fetch(doc.odasi).catch(() => null);
            if (user) {
                username = user.username;
                avatarURL = user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true });
            }
        } catch (e) { }

        usersWithNames.push({
            username: username || 'Unknown',
            avatarURL: avatarURL,
            odasi: doc.odasi,
            matchStats: doc.matchStats
        });
    }

    const leaderboardGenerator = require('../utils/leaderboardGenerator');
    const buffer = await leaderboardGenerator.createLeaderboardImage(usersWithNames, mode);
    const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });
    const components = [buildButtons(mode)];

    return { attachment, components };
}

module.exports = {
    async updateLeaderboard(client) {
        try {
            const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
            if (!channel) return console.error('Leaderboard channel not found!');

            const guild = channel.guild;
            if (!guild) return console.error('Leaderboard guild not found!');

            const { empty, attachment, components } = await buildLeaderboardPayload(client, guild, 'elo');

            if (empty) {
                const messages = await channel.messages.fetch({ limit: 1 });
                const lastMessage = messages.first();
                const text = '⚠️ **Leaderboard:** Sadece kayıtlı oyuncular burada görünür. Henüz kimse yok!';

                if (lastMessage && lastMessage.author.id === client.user.id) {
                    if (lastMessage.content !== text) await lastMessage.edit({ content: text, embeds: [], files: [], components: [] });
                } else {
                    await channel.bulkDelete(5).catch(() => { });
                    await channel.send(text);
                }
                return;
            }

            const messages = await channel.messages.fetch({ limit: 1 });
            const lastMessage = messages.first();

            if (lastMessage && lastMessage.author.id === client.user.id) {
                await lastMessage.edit({ content: null, embeds: [], files: [attachment], components });
            } else {
                await channel.bulkDelete(5).catch(() => { });
                await channel.send({ files: [attachment], components });
            }

        } catch (error) {
            console.error('Leaderboard Update Error:', error);
        }
    },

    async handleModeInteraction(interaction, client) {
        try {
            const mode = interaction.customId.replace('lb_mode_', '');
            const channel = interaction.channel;
            if (!channel || channel.id !== LEADERBOARD_CHANNEL_ID) return;

            const guild = channel.guild;
            const { empty, attachment } = await buildLeaderboardPayload(client, guild, mode);

            if (empty) {
                await interaction.reply({ content: 'Bu leaderboard için gösterilecek oyuncu yok.', ephemeral: true });
                return;
            }

            // Kullanıcıya özel, ana mesajı bozmayan ephemeral görünüm
            await interaction.reply({ files: [attachment], ephemeral: true });
        } catch (e) {
            console.error('Leaderboard mode interaction error:', e);
            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({ content: 'Leaderboard güncellenirken hata oluştu.', ephemeral: true }).catch(() => { });
            }
        }
    }
};
