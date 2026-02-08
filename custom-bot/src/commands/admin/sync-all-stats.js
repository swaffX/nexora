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

            // 2. Global fetch verimsiz ve rate limit (Opcode 8) riski taşıyor.
            // Bunun yerine aşağıda cache kontrolü ve individual fetch yapacağız.

            const VALORANT_ROLE_ID = CONFIG.ROLES.VALORANT;

            let updatedCount = 0;
            let skippedCount = 0;
            let errorCount = 0;

            await interaction.editReply(`🔄 Senkronizasyon başladı... Toplam Kayıt: ${allUsers.length}`);

            for (const userDoc of allUsers) {
                try {
                    let member = interaction.guild.members.cache.get(userDoc.odasi);

                    if (!member) {
                        try {
                            member = await interaction.guild.members.fetch(userDoc.odasi);
                        } catch (e) {
                            // Üye sunucuda yok veya bulunamadı
                            skippedCount++;
                            continue;
                        }
                    }

                    // ROL KONTROLÜ: Sadece rolü olanları güncelle
                    if (!member || !member.roles.cache.has(VALORANT_ROLE_ID)) {
                        skippedCount++;
                        continue;
                    }

                    // 2. İstatistikleri Sıfırla/Doğrula
                    eloService.ensureValidStats(userDoc);

                    // 3. Geçmiş Maçlardan Tekrar Hesapla
                    await eloService.recalculateStatsFromHistory(userDoc);

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
