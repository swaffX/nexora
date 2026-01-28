const { SlashCommandBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const manager = require('../handlers/match/manager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mcancel')
        .setDescription('Bir maçı ID ile zorla iptal eder (Admin)')
        .addStringOption(option =>
            option.setName('match_id')
                .setDescription('İptal edilecek Maç ID')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('sebep')
                .setDescription('İptal sebebi')
                .setRequired(false)),

    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: '❌ Bu komutu sadece yöneticiler kullanabilir.', flags: MessageFlags.Ephemeral });
        }

        const matchId = interaction.options.getString('match_id');
        const reason = interaction.options.getString('sebep') || 'Yönetici tarafından iptal edildi.';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const success = await manager.forceEndMatch(interaction.guild, matchId, reason);

        if (success) {
            await interaction.editReply(`✅ **${matchId}** ID'li maç başarıyla iptal edildi.\n- Oyuncular ana lobiye taşındı.\n- Kanallar silindi.`);
        } else {
            await interaction.editReply(`❌ **${matchId}** ID'li bir maç bulunamadı.`);
        }
    }
};
