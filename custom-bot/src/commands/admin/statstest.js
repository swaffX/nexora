const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('statstest')
        .setDescription('Test Detailed Stats V2 Canvas (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            const userForCard = {
                username: interaction.user.username,
                avatar: interaction.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }),
                backgroundImage: 'Default',
                favoriteAgent: null,
                favoriteMap: null
            };

            const fakeStats = {
                elo: 1850,
                totalMatches: 47,
                totalWins: 28,
                totalLosses: 19,
                winStreak: 4,
                totalMVPs: 12,
                activeTitle: 'SATCHEL ENJOYER',
                isInactive: false,
                mapStats: {
                    'Lotus': { wins: 8, losses: 3 },
                    'Bind': { wins: 6, losses: 4 },
                    'Ascent': { wins: 5, losses: 7 },
                    'Haven': { wins: 4, losses: 2 },
                    'Split': { wins: 5, losses: 3 }
                }
            };

            const fakeRank = 3;

            // Fake match history
            const matchHistory = [
                { map: 'Lotus', result: 'WIN', score: '13-8', date: '1 saat önce', eloChange: 32, isMvp: true },
                { map: 'Bind', result: 'WIN', score: '13-11', date: '3 saat önce', eloChange: 24, isMvp: false },
                { map: 'Ascent', result: 'LOSS', score: '10-13', date: '1 gün önce', eloChange: -18, isMvp: false },
                { map: 'Haven', result: 'WIN', score: '13-5', date: '2 gün önce', eloChange: 28, isMvp: true },
                { map: 'Split', result: 'LOSS', score: '11-13', date: '3 gün önce', eloChange: -15, isMvp: false }
            ];

            // Best map
            const bestMap = { name: 'Lotus', wr: 73 };

            // Favorite teammate
            const favTeammate = {
                username: interaction.user.username,
                avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true })
            };

            // Nemesis
            const nemesisData = {
                username: 'NemesisPlayer',
                count: 5,
                avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png'
            };

            const buffer = await canvasGenerator.createDetailedStatsImageV2(
                userForCard,
                fakeStats,
                matchHistory,
                bestMap,
                favTeammate,
                fakeRank,
                nemesisData
            );

            const attachment = new AttachmentBuilder(buffer, { name: 'stats-v2.png' });

            await interaction.editReply({
                content: '✅ **Stats V2 Test** — Yeni modern detaylı istatistik kartı:',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hata: ' + error.message);
        }
    }
};
