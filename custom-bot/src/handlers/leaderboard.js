const { AttachmentBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const canvasGenerator = require('../utils/canvasGenerator');

const LEADERBOARD_CHANNEL_ID = '1468414391300132894';
const REQUIRED_ROLE_ID = '1466189076347486268';

module.exports = {
    async updateLeaderboard(client) {
        try {
            const channel = client.channels.cache.get(LEADERBOARD_CHANNEL_ID);
            if (!channel) return console.error('Leaderboard channel not found!');

            const guild = channel.guild;
            if (!guild) return console.error('Leaderboard guild not found!');

            const finalTopUsers = [];

            // 1. ELO verisi olanları çek (Limit 50, rol kontrolü yapılacak)
            const rankedCandidates = await User.find({ 'matchStats.elo': { $exists: true } })
                .sort({ 'matchStats.elo': -1 })
                .limit(50);

            for (const doc of rankedCandidates) {
                if (finalTopUsers.length >= 10) break;

                try {
                    // Discord Rol Kontrolü
                    const member = await guild.members.fetch(doc.odasi).catch(() => null);
                    if (member && member.roles.cache.has(REQUIRED_ROLE_ID)) {
                        finalTopUsers.push(doc);
                    }
                } catch (e) { }
            }

            // 2. Eğer 10 kişi dolmadıysa, rolü olan diğer kayıtlı kullanıcılarla tamamla
            if (finalTopUsers.length < 10) {
                const existingIds = finalTopUsers.map(u => u._id.toString());

                // DB'den henüz ELO'su olmayanları çek
                const unrankedCandidates = await User.find({
                    'matchStats.elo': { $exists: false },
                    odasi: { $exists: true, $ne: '' }
                }).sort({ createdAt: -1 }).limit(100);

                for (const doc of unrankedCandidates) {
                    if (finalTopUsers.length >= 10) break;
                    if (existingIds.includes(doc._id.toString())) continue;

                    try {
                        const member = await guild.members.fetch(doc.odasi).catch(() => null);
                        if (member && member.roles.cache.has(REQUIRED_ROLE_ID)) {
                            // Sanal Stat Ekle (Görsel için)
                            // Bu objeyi veritabanına kaydetmiyoruz, sadece görüntü için modifiye ediyoruz
                            // Mongoose dökümanı üzerinde değişiklik yapmak için .toObject() gerekebilir ama
                            // direkt field set etmek JS objesi olduğu için bellekte çalışır.
                            if (!doc.matchStats) doc.matchStats = {};
                            doc.matchStats.elo = 100; // Varsayılan Başlangıç
                            doc.matchStats.totalMatches = 0;
                            doc.matchStats.totalWins = 0;

                            finalTopUsers.push(doc);
                        }
                    } catch (e) { }
                }

                // Tekrar sırala (Puanı 100 olanlar en alta gitsin diye değil, karışık olabilir)
                finalTopUsers.sort((a, b) => (b.matchStats.elo || 100) - (a.matchStats.elo || 100));
            }

            if (finalTopUsers.length === 0) {
                // Hiç veri yoksa placeholder mesaj
                const messages = await channel.messages.fetch({ limit: 1 });
                const lastMessage = messages.first();
                const text = '⚠️ **Leaderboard:** Sadece kayıtlı oyuncular burada görünür. Henüz kimse yok!';

                if (lastMessage && lastMessage.author.id === client.user.id) {
                    if (lastMessage.content !== text) await lastMessage.edit({ content: text, embeds: [], files: [] });
                } else {
                    await channel.bulkDelete(5).catch(() => { });
                    await channel.send(text);
                }
                return;
            }

            // Kullanıcı Adlarını Çek veya DB'den al
            const usersWithNames = [];
            for (const doc of finalTopUsers) {
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
                await lastMessage.edit({ content: null, embeds: [], files: [attachment] });
            } else {
                await channel.bulkDelete(5).catch(() => { });
                await channel.send({ files: [attachment] });
            }

            console.log('Leaderboard image updated successfully (Role Filtered).');

        } catch (error) {
            console.error('Leaderboard Update Error:', error);
        }
    }
};
