const { AttachmentBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../utils/canvasGenerator');

const LEADERBOARD_CHANNEL_ID = '1468414391300132894';

module.exports = {
    async updateLeaderboard(client) {
        try {
            const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
            if (!channel) return console.error('Leaderboard channel not found!');

            // En yüksek ELO'ya sahip 10 kullanıcıyı çek
            // matchStats.elo alanı var olanları ve ELO'ya göre sıralayarak al
            const topUsers = await User.find({ 'matchStats.elo': { $exists: true } })
                .sort({ 'matchStats.elo': -1 })
                .limit(10);

            if (!topUsers || topUsers.length === 0) {
                // Veri yoksa bile kanala bilgi ver
                const messages = await channel.messages.fetch({ limit: 1 });
                const lastMessage = messages.first();
                const text = '⚠️ **Leaderboard:** Henüz sıralama verisi yok. İlk maçı oynadığınızda burada görüneceksiniz!';

                if (lastMessage && lastMessage.author.id === client.user.id) {
                    if (lastMessage.content !== text) await lastMessage.edit({ content: text, embeds: [], files: [] });
                } else {
                    // Temizle ve at
                    await channel.bulkDelete(5).catch(() => { });
                    await channel.send(text);
                }
                return;
            }

            // Kullanıcı Adlarını (Discord API'den çek)
            const usersWithNames = [];
            for (const doc of topUsers) {
                let username = `Player ${doc.odasi.substring(0, 4)}`;
                try {
                    const user = await client.users.fetch(doc.odasi).catch(() => null);
                    if (user) username = user.username;
                } catch (e) { }

                usersWithNames.push({
                    username: username || 'Unknown',
                    odasi: doc.odasi,
                    matchStats: doc.matchStats
                });
            }

            // Resmi Üret
            const buffer = await canvasGenerator.createLeaderboardImage(usersWithNames);
            const attachment = new AttachmentBuilder(buffer, { name: 'leaderboard.png' });

            // Mesajı güncelle veya yeniden at
            const messages = await channel.messages.fetch({ limit: 1 });
            const lastMessage = messages.first();

            if (lastMessage && lastMessage.author.id === client.user.id) {
                // Sadece resmi editlemek mümkün değil, yeni attachments ile editleriz
                await lastMessage.edit({ content: null, embeds: [], files: [attachment] });
            } else {
                await channel.bulkDelete(5).catch(() => { });
                await channel.send({ files: [attachment] });
            }

            console.log('Leaderboard image updated successfully.');

        } catch (error) {
            console.error('Leaderboard Update Error:', error);
        }
    }
};
