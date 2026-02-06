const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-versus')
        .setDescription('Test Versus (Face-Off) Canvas (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Fake Data
            const captainA = {
                user: interaction.user,
                name: interaction.user.username,
                stats: { elo: 1250, matchLevel: 8 }
            };

            // Fake Captain B (Bot or another user mock)
            const captainB = {
                user: interaction.client.user,
                name: 'NexoraBot',
                stats: { elo: 3000, matchLevel: 10 }
            };

            const mapName = 'Ascent';

            // Generate Image
            const buffer = await canvasGenerator.createVersusImage(captainA, captainB, mapName);
            const attachment = new AttachmentBuilder(buffer, { name: 'versus-test.png' });

            await interaction.editReply({
                content: '✅ **Versus (Face-Off) Testi Başarılı!**',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hata: ' + error.message);
        }
    }
};
