const { SlashCommandBuilder, PermissionFlagsBits, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('test-roster')
        .setDescription('Test Roster 5v5 Canvas (Admin Only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        await interaction.deferReply();

        try {
            // Fake Teams
            // Team A
            const teamA = [
                { username: interaction.user.username, avatarURL: interaction.user.displayAvatarURL({ extension: 'png', forceStatic: true }), level: 10 },
                { username: 'Jett', avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png', level: 9 },
                { username: 'Sova', avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png', level: 8 },
                { username: 'Omen', avatarURL: 'https://cdn.discordapp.com/embed/avatars/2.png', level: 7 },
                { username: 'Killjoy', avatarURL: 'https://cdn.discordapp.com/embed/avatars/3.png', level: 6 }
            ];

            // Team B
            const teamB = [
                { username: 'Reyna', avatarURL: 'https://cdn.discordapp.com/embed/avatars/4.png', level: 10 },
                { username: 'Raze', avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png', level: 8 },
                { username: 'Fade', avatarURL: 'https://cdn.discordapp.com/embed/avatars/1.png', level: 5 },
                { username: 'Viper', avatarURL: 'https://cdn.discordapp.com/embed/avatars/2.png', level: 4 },
                { username: 'Chamber', avatarURL: 'https://cdn.discordapp.com/embed/avatars/3.png', level: 3 }
            ];

            // Generate Image
            const buffer = await canvasGenerator.createRosterImage(teamA, teamB);
            const attachment = new AttachmentBuilder(buffer, { name: 'roster-test.png' });

            await interaction.editReply({
                content: '✅ **Roster Testi Başarılı!** İşte 5v5 Kadro Görseli:',
                files: [attachment]
            });

        } catch (error) {
            console.error(error);
            await interaction.editReply('❌ Hata: ' + error.message);
        }
    }
};
