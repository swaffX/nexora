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
                    { name: 'aimstar swaze', agent: 'Gekko', level: 67, title: 'Süperstar' },
                    { name: 'Ben', agent: 'Tejo', level: 42, title: 'Aura' },
                    { name: 'mayonezsalcaxxx', agent: 'Yoru', level: 15, title: 'Çaylak' },
                    { name: 'CLOVE', agent: 'Clove', level: 258, title: 'Evrim Geçirmiş' },
                    { name: 'CYPHER', agent: 'Cypher', level: 12, title: 'Habibi' }
                ],
                teamB: [
                    { name: 'Gurjj', agent: 'Reyna', level: 88, title: 'Alevli Binek' },
                    { name: 'VYSE', agent: 'Vyse', level: 31, title: 'Beygir Gücü' },
                    { name: 'One to Heroo', agent: 'Breach', level: 79, title: 'Usta' },
                    { name: 'SprayAndPray', agent: 'Jett', level: 136, title: '6-7' },
                    { name: 'Bonobo33', agent: 'Sova', level: 126, title: ':3' }
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
