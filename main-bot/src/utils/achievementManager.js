const { EmbedBuilder } = require('discord.js');

const ACHIEVEMENTS = [
    // MESAJ BAŞARIMLARI
    { id: 'msg_100', name: '🗣️ Çaylak', desc: 'Toplam 100 mesaj gönder.', req: (u) => u.totalMessages >= 100, xp: 500, money: 250 },
    { id: 'msg_1000', name: '✍️ Yazar', desc: 'Toplam 1.000 mesaj gönder.', req: (u) => u.totalMessages >= 1000, xp: 2000, money: 1000 },
    { id: 'msg_5000', name: '📜 Efsanevi Yazar', desc: 'Toplam 5.000 mesaj gönder.', req: (u) => u.totalMessages >= 5000, xp: 10000, money: 5000 },

    // LEVEL BAŞARIMLARI
    { id: 'lvl_5', name: '👶 Yeni Başlangıç', desc: '5. Seviyeye ulaş.', req: (u) => u.level >= 5, xp: 500, money: 500 },
    { id: 'lvl_10', name: '⭐ Yükselen Yıldız', desc: '10. Seviyeye ulaş.', req: (u) => u.level >= 10, xp: 1500, money: 1000 },
    { id: 'lvl_50', name: '👑 Nexora Kralı', desc: '50. Seviyeye ulaş.', req: (u) => u.level >= 50, xp: 25000, money: 20000 },

    // SES BAŞARIMLARI
    { id: 'voice_10h', name: '🎙️ Konuşkan', desc: 'Toplam 10 saat (600 dk) sesli kanalda kal.', req: (u) => u.totalVoiceMinutes >= 600, xp: 1000, money: 1000 },
    { id: 'voice_100h', name: '🎧 Yayıncı', desc: 'Toplam 100 saat sesli kanalda kal.', req: (u) => u.totalVoiceMinutes >= 6000, xp: 15000, money: 10000 },

    // EKONOMİ BAŞARIMLARI
    { id: 'rich_100k', name: '💰 Zengin', desc: 'Cüzdanında 100.000 NexCoin biriktir.', req: (u) => u.balance >= 100000, xp: 5000, money: 0 }, // Para ödülü yok, zaten zengin
    { id: 'rich_1m', name: '🏦 Milyoner', desc: 'Cüzdanında 1.000.000 NexCoin biriktir.', req: (u) => u.balance >= 1000000, xp: 50000, money: 0 }
];

async function checkAchievements(user, interactionOrMessage) {
    if (!user) return;

    let unlocked = [];

    // User modelindeki achievements array'i kontrol et, yoksa oluştur
    if (!user.achievements) user.achievements = [];

    for (const ach of ACHIEVEMENTS) {
        // Zaten alınmış mı?
        const hasAch = user.achievements.some(a => a.id === ach.id);
        if (hasAch) continue;

        // Şartlar sağlanıyor mu?
        if (ach.req(user)) {
            user.achievements.push({ id: ach.id, unlockedAt: new Date() });

            // Ödülleri ver
            if (ach.xp) user.xp += ach.xp;
            if (ach.money) user.balance += ach.money;

            unlocked.push(ach);
        }
    }

    if (unlocked.length > 0) {
        await user.save();

        // Bildirim gönder
        const target = interactionOrMessage.member || interactionOrMessage.author || interactionOrMessage.user;
        const channel = interactionOrMessage.channel;

        if (channel && target) {
            const userName = target.user ? target.user.username : target.username;
            const embed = new EmbedBuilder()
                .setColor(0xFFD700) // Gold
                .setTitle(`🏆 BAŞARIM KİLİDİ AÇILDI!`)
                .setThumbnail('https://cdn-icons-png.flaticon.com/512/3112/3112946.png')
                .setFooter({ text: `${userName} tebrikler!`, iconURL: target.user ? target.user.displayAvatarURL() : null });

            let desc = '';
            unlocked.forEach(a => {
                desc += `**${a.name}**\nℹ️ *${a.desc}*\n🎁 **Ödül:** ${a.xp ? `\`+${a.xp} XP\`` : ''} ${a.money ? `\`+${a.money} Coin\`` : ''}\n\n`;
            });
            embed.setDescription(desc);

            channel.send({ content: `<@${target.id}>`, embeds: [embed] }).catch(() => { });
        }
    }
}

module.exports = { checkAchievements, ACHIEVEMENTS };
