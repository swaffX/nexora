const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('elo')
        .setDescription('Kendi ELO ve Level durumunu gösterir (veya başka birinin).')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Başka bir kullanıcının istatistiklerini gör')
                .setRequired(false)
        ),

    async execute(interaction) {
        // Hedef kullanıcıyı belirle (Ya kendisi ya etiketlenen)
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const guildId = interaction.guild.id;

        try {
            const userDoc = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            // Varsayılan Değerler
            const elo = userDoc && userDoc.matchStats ? (userDoc.matchStats.elo || 1000) : 1000;
            const level = userDoc && userDoc.matchStats ? (userDoc.matchStats.matchLevel || 3) : 3;
            const wins = userDoc && userDoc.matchStats ? (userDoc.matchStats.totalWins || 0) : 0;
            const losses = userDoc && userDoc.matchStats ? (userDoc.matchStats.totalLosses || 0) : 0;
            const matches = userDoc && userDoc.matchStats ? (userDoc.matchStats.totalMatches || 0) : 0;

            // Kazanma Oranı
            const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;

            // Bir Sonraki Level İçin Gereken ELO Hesabı
            const levels = [
                { lv: 1, max: 800 }, { lv: 2, max: 950 }, { lv: 3, max: 1100 },
                { lv: 4, max: 1250 }, { lv: 5, max: 1400 }, { lv: 6, max: 1550 },
                { lv: 7, max: 1700 }, { lv: 8, max: 1850 }, { lv: 9, max: 2000 },
                { lv: 10, max: 99999 }
            ];

            const currentRange = levels.find(l => l.lv === level);
            let progressBar = '';
            let nextInfo = '';

            if (level < 10) {
                const nextLevelMin = currentRange.max + 1;
                const needed = nextLevelMin - elo;

                // Progress Bar Hesabı (Basit)
                // Mevcut levelin tabanı (bir önceki max) ve tavanı (bu levelin max)
                const prevMax = level > 1 ? levels.find(l => l.lv === level - 1).max : 0;
                const rangeTotal = currentRange.max - prevMax;
                const progressInLevel = elo - prevMax;
                const percent = Math.min(100, Math.max(0, Math.round((progressInLevel / rangeTotal) * 100)));

                // Bar Çizimi [#####.....]
                const filled = Math.round(percent / 10);
                const empty = 10 - filled;
                progressBar = '`' + '▓'.repeat(filled) + '░'.repeat(empty) + '` %' + percent;

                nextInfo = `\n📈 **Sonraki Level:** ${needed} ELO kaldı (Hedef: ${nextLevelMin})`;
            } else {
                progressBar = '`▓▓▓▓▓▓▓▓▓▓` %100 (MAX)';
                nextInfo = '\n👑 **Zirvedesin!** FaceIT Level 10';
            }

            const embed = new EmbedBuilder()
                .setColor(0x3498DB)
                .setAuthor({ name: `${targetUser.username} • Rekabetçi İstatistikleri`, iconURL: targetUser.displayAvatarURL() })
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/10636/10636064.png') // Rank Icon Placeholder
                .addFields(
                    { name: '🏆 Level', value: `**Level ${level}**`, inline: true },
                    { name: '⭐ ELO', value: `**${elo}**`, inline: true },
                    { name: '📊 İstatistikler', value: `Maç: **${matches}** | W: **${wins}** | L: **${losses}** | WR: **%${winRate}**`, inline: false },
                    { name: '🚀 İlerleme', value: `${progressBar}${nextInfo}`, inline: false }
                )
                .setFooter({ text: 'Nexora Competitive Systems' });

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error('ELO Command Error:', error);
            await interaction.reply({ content: 'Bir hata oluştu.', ephemeral: true });
        }
    }
};
