const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elotest')
        .setDescription('Test ELO Card V2 Canvas (Admin Only)')
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
                isInactive: false
            };

            const fakeRank = 3;

            const buffer = await canvasGenerator.createEloCardV2(userForCard, fakeStats, fakeRank);
            const attachment = new AttachmentBuilder(buffer, { name: 'elo-card-v2.png' });

            await interaction.editReply({
                content: '✅ **ELO Card V2 Test** — Yeni modern ELO kartı:',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hata: ' + error.message);
        }
    }
};
