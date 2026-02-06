const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-history')
        .setDescription('Test Match History Canvas (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // 1. Fake Oyuncular
            const teamA = ['123', '456', '789', '101', '102']; // Fake IDs
            const teamB = ['201', '202', '203', '204', '205'];

            // Komutu kullanan kişiyi Team A kaptanı yapalım
            teamA[0] = interaction.user.id;

            // 2. Fake Oyuncu Verileri (playersData)
            const playersData = {};
            const allPlayers = [...teamA, ...teamB];

            // Kullanıcının gerçek verileri
            playersData[interaction.user.id] = {
                username: interaction.user.username,
                avatarURL: interaction.user.displayAvatarURL({ extension: 'png', size: 128, forceStatic: true }),
                // level: 10 (Bu ELO'dan hesaplanacak görselde)
            };

            // Diğerleri için fake veri
            const fakeNames = ['JettMain', 'ReynaInsta', 'SageWall', 'OmenTP', 'SovaDart', 'BrimMolly', 'ViperPit', 'CypherCam', 'KayoFlash'];
            let nameIdx = 0;

            for (const pid of allPlayers) {
                if (pid === interaction.user.id) continue;
                playersData[pid] = {
                    username: fakeNames[nameIdx++] || `Player${nameIdx}`,
                    avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png'
                };
            }

            // 3. Fake Match Data
            const matchData = {
                score: { A: 13, B: 11 },
                teams: { A: teamA, B: teamB },
                map: 'Pearl',
                matchId: 'TEST-12345',
                mvp: interaction.user.id, // Kazanan MVP
                loserMvp: teamB[0] // Kaybeden MVP (ilk fake user)
            };

            // 4. Fake Elo Changes
            const eloChanges = [];

            // Team A (Winners)
            teamA.forEach(pid => {
                eloChanges.push({
                    userId: pid,
                    change: Math.floor(Math.random() * 10) + 15, // +15 to +25
                    newElo: 1250 // Level 10 civarı
                });
            });

            // Team B (Losers)
            teamB.forEach(pid => {
                eloChanges.push({
                    userId: pid,
                    change: -(Math.floor(Math.random() * 10) + 15), // -15 to -25
                    newElo: 850 // Level 5 civarı
                });
            });

            // 5. Canvas Oluştur
            const buffer = await canvasGenerator.createMatchResultImage(matchData, eloChanges, playersData);
            const attachment = new AttachmentBuilder(buffer, { name: 'match-result-test.png' });

            await interaction.editReply({
                content: '✅ **Test Başarılı!** İşte oluşturulan maç sonucu görseli:',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Bir hata oluştu: ' + error.message);
        }
    }
};
