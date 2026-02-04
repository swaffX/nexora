const { EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

const LEADERBOARD_CHANNEL_ID = '1468414391300132894';

module.exports = {
    async updateLeaderboard(client) {
        try {
            const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
            if (!channel) return console.error('Leaderboard channel not found!');

            // En yüksek ELO'ya sahip 10 kullanıcıyı çek
            // matchStats.elo -1 (Desc)
            const topUsers = await User.find({ 'matchStats.elo': { $exists: true } })
                .sort({ 'matchStats.elo': -1 })
                .limit(10);

            if (topUsers.length === 0) return; // Kimse yoksa işlem yapma

            const description = topUsers.map((user, index) => {
                let rankEmoji = `\`${index + 1}.\``;
                if (index === 0) rankEmoji = '🥇';
                if (index === 1) rankEmoji = '🥈';
                if (index === 2) rankEmoji = '🥉';

                const elo = user.matchStats.elo || 1000;
                const wins = user.matchStats.totalWins || 0;
                const losses = user.matchStats.totalLosses || 0;
                const matches = user.matchStats.totalMatches || 0;
                const winRate = matches > 0 ? Math.round((wins / matches) * 100) : 0;
                const level = user.matchStats.matchLevel || 1;

                // Format: 🥇 **UserTag** • Lv. 10 • 2400 ELO (65% WR)
                return `${rankEmoji} <@${user.odasi}> • **Lv. ${level}**\n└ \`${elo} ELO\` • %${winRate} WR • ${wins}W / ${losses}L`;
            }).join('\n\n');

            const embed = new EmbedBuilder()
                .setColor(0xF1C40F) // Gold
                .setTitle('🏆 NEXORA COMPETITIVE LEADERBOARD')
                .setDescription(`Sezonun en iyi oyuncuları ve sıralamaları aşağıdadır.\nHer maç, her raund önemlidir!\n\n${description}`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png') // Trophy Icon
                .setFooter({ text: `Son Güncelleme: ${new Date().toLocaleTimeString('tr-TR')}` })
                .setImage('https://media.discordapp.net/attachments/1213123123/faceit_banner_style.png?width=960&height=150'); // (Opsiyonel Banner)

            // Mesajı bul veya at
            const messages = await channel.messages.fetch({ limit: 1 });
            const lastMessage = messages.first();

            if (lastMessage && lastMessage.author.id === client.user.id) {
                await lastMessage.edit({ embeds: [embed] });
            } else {
                // Kanalı temizle ve yeni at (Eğer eski mesajlar varsa)
                await channel.bulkDelete(5).catch(() => { });
                await channel.send({ embeds: [embed] });
            }

            console.log('Leaderboard updated successfully.');

        } catch (error) {
            console.error('Leaderboard Update Error:', error);
        }
    }
};
