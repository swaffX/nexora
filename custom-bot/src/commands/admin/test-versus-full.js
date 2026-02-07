const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-versus-full')
        .setDescription('Test New 5v5 Versus Screen Canvas (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Mock Data based on the screenshot provided
            const mockData = {
                map: 'Ascent',
                teamA: [
                    { name: 'aimstar swaze', elo: 850, title: 'Süperstar' },
                    { name: 'Ben', elo: 420, title: 'Aura' },
                    { name: 'mayonezsalcaxxx', elo: 150, title: 'Çaylak' },
                    { name: 'CLOVE', elo: 2580, title: 'Evrim Geçirmiş' },
                    { name: 'CYPHER', elo: 120, title: 'Habibi' }
                ],
                teamB: [
                    { name: 'Gurjj', elo: 1100, title: 'Alevli Binek' },
                    { name: 'VYSE', elo: 310, title: 'Beygir Gücü' },
                    { name: 'One to Heroo', elo: 790, title: 'Usta' },
                    { name: 'SprayAndPray', elo: 1360, title: '6-7' },
                    { name: 'Bonobo33', elo: 1260, title: ':3' }
                ]
            };

            // Generate Image
            const buffer = await canvasGenerator.createVersusFullImage(mockData);
            const attachment = new AttachmentBuilder(buffer, { name: 'versus-full-test.png' });

            await interaction.editReply({
                content: '✅ **Yeni 5v5 Versus Ekranı Testi Başarılı!**',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hata: ' + error.message);
        }
    }
};
