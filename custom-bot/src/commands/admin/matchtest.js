const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('matchtest')
        .setDescription('Test Match Result Canvas (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Fake Players
            const teamA = ['p1', 'p2', 'p3', 'p4', 'p5'];
            const teamB = ['p6', 'p7', 'p8', 'p9', 'p10'];

            // Real user as Team A captain
            teamA[0] = interaction.user.id;

            // Player Data
            const playersData = {};
            const allPlayers = [...teamA, ...teamB];

            playersData[interaction.user.id] = {
                username: interaction.user.username,
                avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }),
            };

            const fakeNames = ['JettMain', 'ReynaInsta', 'SageWall', 'OmenTP', 'SovaDart', 'BrimMolly', 'ViperPit', 'CypherCam', 'KayoFlash'];
            let nameIdx = 0;

            for (const pid of allPlayers) {
                if (pid === interaction.user.id) continue;
                playersData[pid] = {
                    username: fakeNames[nameIdx++] || `Player${nameIdx}`,
                    avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
                };
            }

            // Fake Match Data
            const matchData = {
                score: { A: 13, B: 10 },
                teams: { A: teamA, B: teamB },
                map: 'Lotus',
                matchId: 'TEST-99999',
                mvp: interaction.user.id,
                loserMvp: teamB[0]
            };

            // Fake ELO Changes (varying levels)
            const eloChanges = [];

            // Team A (Winners) - different ELO levels
            const winnerElos = [2200, 1500, 800, 350, 150];
            const winnerChanges = [41, 29, 29, 29, 29];
            teamA.forEach((pid, idx) => {
                eloChanges.push({
                    userId: pid,
                    change: winnerChanges[idx],
                    newElo: winnerElos[idx]
                });
            });

            // Team B (Losers) - different ELO levels
            const loserElos = [1800, 1100, 600, 250, 100];
            const loserChanges = [-15, -15, -15, -11, -15];
            teamB.forEach((pid, idx) => {
                eloChanges.push({
                    userId: pid,
                    change: loserChanges[idx],
                    newElo: loserElos[idx]
                });
            });

            // Generate Image
            const buffer = await canvasGenerator.createMatchResultImage(matchData, eloChanges, playersData);
            const attachment = new AttachmentBuilder(buffer, { name: 'match-result-test.png' });

            await interaction.editReply({
                content: '✅ **Match Result Testi Başarılı!** İşte yeni maç sonucu görseli:',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hata: ' + error.message);
        }
    }
};
