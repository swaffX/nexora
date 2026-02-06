const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-veto')
        .setDescription('Test Map Veto Canvas (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Fake Map States
            // Maps: Ascent, Bind, Haven, Split, Pearl, Lotus, Sunset

            const mapStates = {
                'Ascent': { banned: true, bannedBy: 'Team A' },
                'Bind': { banned: true, bannedBy: 'Team B' },
                'Haven': { banned: true, bannedBy: 'Team A' },
                'Split': { banned: true, bannedBy: 'Team B' },
                'Pearl': { banned: false }, // SELECTED
                'Lotus': { banned: true, bannedBy: 'Team A' },
                'Sunset': { banned: true, bannedBy: 'Team B' }
            };

            const selectedMap = 'Pearl';

            // Generate Image
            const buffer = await canvasGenerator.createMapVetoImage(mapStates, selectedMap, 'Harita Seçimi Tamamlandı');
            const attachment = new AttachmentBuilder(buffer, { name: 'veto-result.png' });

            await interaction.editReply({
                content: '✅ **Map Veto Testi Başarılı!**',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hata: ' + error.message);
        }
    }
};
