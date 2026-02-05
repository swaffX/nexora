const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fix-stats')
        .setDescription('Kullanıcının istatistiklerini maç geçmişine (146867... sonrası) göre onarır.')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Hedef Kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // YETKİ KONTROLÜ
        const REQUIRED_ROLE_ID = '1466189076347486268';
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Yetkiniz yok.', flags: 64 });
        }

        const targetUser = interaction.options.getUser('user');
        await interaction.deferReply({ flags: 64 });

        try {
            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: interaction.guild.id });
            if (!userDoc) {
                return interaction.editReply({ content: '❌ Kullanıcı veritabanında bulunamadı.' });
            }

            // RECALCULATE
            // Bu fonksiyon zaten MIN_MATCH_ID filtresini uyguluyor
            await eloService.recalculateStatsFromHistory(userDoc);

            await interaction.editReply({
                content: `✅ **BAŞARILI**: <@${targetUser.id}> kullanıcısının istatistikleri onarıldı.\n\n📊 **Güncel Veriler:**\nWins: **${userDoc.matchStats.totalWins}**\nLosses: **${userDoc.matchStats.totalLosses}**\nStreak: **${userDoc.matchStats.winStreak}**\n\n⚠️ *Not: ELO puanı değişmedi, sadece sayaçlar düzeltildi.*`
            });

        } catch (error) {
            console.error('[FixStats] Error:', error);
            await interaction.editReply({ content: '❌ İşlem sırasında bir hata oluştu.' });
        }
    }
};
