const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mac-sil')
        .setDescription('Belirtilen ID\'li maçı veritabanından kalıcı olarak siler.')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Silinecek Maç ID\'si (Örn: 146867...)')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // YETKİ KONTROLÜ
        const REQUIRED_ROLE_ID = '1466189076347486268';
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için yetkiniz yok.', flags: 64 }); // Ephemeral
        }

        const matchId = interaction.options.getString('id');

        try {
            // Maçı bul ve sil
            const deletedMatch = await Match.findOneAndDelete({ matchId: matchId });

            if (!deletedMatch) {
                return interaction.reply({
                    content: `❌ **${matchId}** ID'li maç sistemde bulunamadı.\nLütfen ID'yi doğru girdiğinizden emin olun.`,
                    flags: 64
                });
            }

            // Başarılı
            // Detayları gösterelim ki neyin silindiği anlaşılsın
            const mapName = deletedMatch.selectedMap || 'Unknown Map';
            const winner = deletedMatch.winner ? (deletedMatch.winner === 'A' ? 'A Takımı' : 'B Takımı') : 'Berabere/Sonuçsuz';
            const score = `${deletedMatch.scoreA ?? 0} - ${deletedMatch.scoreB ?? 0}`;

            await interaction.reply({
                content: `✅ **BAŞARILI**: Maç kaydı silindi.\n\n🆔 **ID:** \`${matchId}\`\n🗺️ **Map:** ${mapName}\n🏆 **Sonuç:** ${winner} (${score})\n\n⚠️ *Not: Bu işlem sadece maç geçmişini siler. Kullanıcılara verilmiş/alınmış ELO puanlarını geri almaz.*`,
                flags: 64
            });

        } catch (error) {
            console.error('[Match Delete] Error:', error);
            await interaction.reply({ content: '❌ Bir hata oluştu.', flags: 64 });
        }
    }
};
