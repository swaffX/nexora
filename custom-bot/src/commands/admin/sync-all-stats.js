const { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } = require('discord.js');
const path = require('path');
const { User, Match } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');
const CONFIG = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('sync-all-stats')
        .setDescription('Tüm kullanıcıların istatistiklerini hesaplar ve senkronize eder.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        await interaction.deferReply();

        try {
            const guildId = interaction.guild.id;

            // 1. Tüm Kullanıcıları Al
            const allUsers = await User.find({ odaId: guildId });

            // 2. Sunucudaki üyeleri çek (Rol kontrolü için)
            await interaction.editReply(`🔄 Üye listesi güncelleniyor...`);
            await interaction.guild.members.fetch();

            const VALORANT_ROLE_ID = CONFIG.ROLES.VALORANT;

            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            await interaction.editReply(`🔄 Senkronizasyon başladı... Toplam Kayıt: ${allUsers.length}`);

            for (const userDoc of allUsers) {
                try {
                    const member = interaction.guild.members.cache.get(userDoc.odasi);

                    // ROL KONTROLÜ: Sadece rolü olanları güncelle
                    if (!member || !member.roles.cache.has(VALORANT_ROLE_ID)) {
                        skippedCount++;
                        continue;
                    }

                    // 2. İstatistikleri Sıfırla/Doğrula
                    eloService.ensureValidStats(userDoc);

                    // 3. Geçmiş Maçlardan Tekrar Hesapla
                    // (recalculateStatsFromHistory zaten eloService içinde var ve geçmiş maçları tarıyor)
                    await eloService.recalculateStatsFromHistory(userDoc);

                    // 4. ELO'yu kontrol et (Gelecekte opsiyonel olarak ELO'yu da sıfırdan hesaplatabiliriz ama şimdilik sadece Win/Loss/MVP sayısını düzeltiyoruz)
                    // ELO'yu sıfırdan hesaplamak riskli olabilir (maç sırası önemli), o yüzden şimdilik sadece istatistikleri senkronize edelim.

                    updatedCount++;

                    // Her 10 kullanıcıda bir bilgi ver
                    if (updatedCount % 10 === 0) {
                        await interaction.editReply(`🔄 İşleniyor... (${updatedCount} kişi güncellendi)`);
                    }

                } catch (e) {
                    console.error(`User sync error (${userDoc.odasi}):`, e);
                    errorCount++;
                }
            }

            await interaction.editReply(`✅ **Tamamlandı!**\n\n` +
                `• Toplam Kayıt: ${allUsers.length}\n` +
                `• Güncellenen (Aktif): ${updatedCount}\n` +
                `• Atlanan (Rolü Yok/Ayrılmış): ${skippedCount}\n` +
                `• Hatalı: ${errorCount}`);

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Bir hata oluştu: ${error.message}`);
        }
    }
};
