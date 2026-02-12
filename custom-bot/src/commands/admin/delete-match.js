const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const path = require('path');
const { Match, User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const eloService = require('../../services/eloService');
const config = require('../../config');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mac-sil')
        .setDescription('Belirtilen ID\'li maçı siler, ELO ve istatistikleri geri alır.')
        .addStringOption(option =>
            option.setName('id')
                .setDescription('Silinecek Maç ID\'si')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // YETKİ KONTROLÜ
        const REQUIRED_ROLE_ID = config.ROLES.VALORANT;
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator) && !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu komutu kullanmak için yetkiniz yok.', flags: 64 });
        }

        const matchId = interaction.options.getString('id');

        await interaction.deferReply({ flags: 64 }); // Uzun sürebilir

        try {
            const match = await Match.findOne({ matchId: matchId });
            if (!match) {
                return interaction.editReply({ content: `❌ **${matchId}** ID'li maç bulunamadı.` });
            }

            const mapName = match.selectedMap || 'Unknown';
            const winnerTeam = match.winner;
            const allPlayers = [...match.teamA, ...match.teamB];

            // 1. Maçı Sil
            await Match.deleteOne({ matchId: matchId });

            // 2. Oyuncuları Güncelle
            let updatedCount = 0;

            if (allPlayers.length > 0) {
                for (const pid of allPlayers) {
                    try {
                        const user = await User.findOne({ odasi: pid, odaId: interaction.guild.id });
                        if (!user) continue;

                        // A) ELO İadesi (Varsayılan 20 Puan)
                        // Kazanan takımdaysa puanı geri al (-), kaybeden takımdaysa puanı geri ver (+)
                        const isTeamA = match.teamA.includes(pid);

                        // Beraberlik değilse işlem yap
                        if (winnerTeam === 'A' || winnerTeam === 'B') {
                            const isWinner = (winnerTeam === 'A' && isTeamA) || (winnerTeam === 'B' && !isTeamA);

                            if (isWinner) {
                                // Kazandıysa aldığı puanı geri alıyoruz
                                user.matchStats.elo = Math.max(0, user.matchStats.elo - 20);
                            } else {
                                // Kaybettiyse kaybettiği puanı geri veriyoruz
                                user.matchStats.elo += 20;
                            }
                        }

                        // B) Stats & Streak Yeniden Hesapla (Geçmiş Maçlardan)
                        // Bu fonksiyon user.save() yapar
                        await eloService.recalculateStatsFromHistory(user);

                        updatedCount++;
                    } catch (e) {
                        console.error(`[Delete Match] User update error (${pid}):`, e);
                    }
                }
            }

            await interaction.editReply({
                content: `✅ **BAŞARILI**: Maç silindi ve etkileri geri alındı.\n\n🆔 **ID:** \`${matchId}\`\n🗺️ **Map:** ${mapName}\n👥 **Güncellenen Oyuncu:** ${updatedCount}\n\nℹ️ *Oyuncuların ELO puanları ±20 olarak düzeltildi ve Win/Loss/Streak istatistikleri maç geçmişine göre yeniden hesaplandı.*`
            });

        } catch (error) {
            console.error('[Delete Match] Error:', error);
            await interaction.editReply({ content: '❌ İşlem sırasında bir hata oluştu.' });
        }
    }
};
