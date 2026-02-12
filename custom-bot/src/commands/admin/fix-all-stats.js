const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const config = require('../../config');
const eloService = require('../../services/eloService');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('fix-all-stats')
        .setDescription('TÜM kullanıcıların istatistiklerini (Streak/Win/Loss) topluca onarır.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // YETKİ KONTROLÜ
        const REQUIRED_ROLE_ID = config.ROLES.VALORANT;
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Yetkiniz yok.', flags: 64 });
        }

        await interaction.reply({ content: '🔄 **Toplu Veri Onarımı Başlatılıyor...**\nBu işlem tüm kullanıcıların maç geçmişlerini tarayarak Streak, Win ve Loss değerlerini düzeltecektir. Lütfen bekleyin...' });

        try {
            // Sadece gerekli alanları çekelim
            const allUsers = await User.find({ odaId: interaction.guild.id });
            let count = 0;
            const startTime = Date.now();

            for (const user of allUsers) {
                try {
                    // Her kullanıcı için recalculate çalıştır
                    await eloService.recalculateStatsFromHistory(user);
                    count++;
                } catch (e) {
                    console.error(`[FixAll] Error processing user ${user.odasi}:`, e);
                }
            }

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);

            await interaction.editReply({
                content: `✅ **BAŞARILI: Toplu Onarım Tamamlandı!**\n\n👥 **İşlenen Kullanıcı:** ${count}\n⏱️ **Süre:** ${duration} saniye\n\nArtık "mphaddict" gibi eksik streak bilgisine sahip kullanıcıların verileri düzeltildi ve ateş efektleri doğru çalışacak.`
            });

        } catch (error) {
            console.error('[FixAll] Fatal Error:', error);
            await interaction.editReply({ content: '❌ Genel bir hata oluştu. Logları kontrol edin.' });
        }
    }
};
