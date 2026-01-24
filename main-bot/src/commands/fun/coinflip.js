const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Yazı tura atar.'),
    async execute(interaction) {
        const result = Math.random() < 0.5 ? 'Yazı' : 'Tura';
        const embed = new EmbedBuilder()
            .setColor(0xFFD700)
            .setTitle('🪙 Yazı Tura')
            .setDescription(`Para havaya atıldı...\nSonuç: **${result}**`);
        await interaction.reply({ embeds: [embed] });
    }
};
