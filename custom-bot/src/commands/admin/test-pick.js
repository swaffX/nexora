const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-pick')
        .setDescription('Test Map Pick Canvas (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Fake Map States for Picking
            // Maps: Ascent, Bind, Haven, Split, Pearl, Lotus, Sunset

            const mapStates = {
                'Ascent': { banned: true, bannedBy: 'Vote' },
                'Bind': { banned: true, bannedBy: 'Vote' },
                'Haven': { banned: true, bannedBy: 'Vote' },
                'Split': { banned: true, bannedBy: 'Vote' },
                'Pearl': { banned: false }, // SELECTED (WINNER)
                'Lotus': { banned: true, bannedBy: 'Vote' },
                'Sunset': { banned: true, bannedBy: 'Vote' }
            };

            const selectedMap = 'Pearl';

            // Generate Image
            const buffer = await canvasGenerator.createMapVetoImage(mapStates, selectedMap, 'OYLAMA SONUCU');
            const attachment = new AttachmentBuilder(buffer, { name: 'map-pick.png' });

            await interaction.editReply({
                content: '✅ **Map Pick (Oylama) Testi Başarılı!**',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hata: ' + error.message);
        }
    }
};
