const { EmbedBuilder } = require('discord.js');

const colors = {
    primary: 0x5865F2,
    success: 0x57F287,
    warning: 0xFEE75C,
    danger: 0xED4245,
    info: 0x5865F2,
    purple: 0x9B59B6
};

const embeds = {
    success: (title, description) => {
        return new EmbedBuilder()
            .setColor(colors.success)
            .setTitle(`✅ ${title}`)
            .setDescription(description)
            .setTimestamp();
    },

    error: (title, description) => {
        return new EmbedBuilder()
            .setColor(colors.danger)
            .setTitle(`❌ ${title}`)
            .setDescription(description)
            .setTimestamp();
    },

    warning: (title, description) => {
        return new EmbedBuilder()
            .setColor(colors.warning)
            .setTitle(`⚠️ ${title}`)
            .setDescription(description)
            .setTimestamp();
    },

    info: (title, description) => {
        return new EmbedBuilder()
            .setColor(colors.info)
            .setTitle(`ℹ️ ${title}`)
            .setDescription(description)
            .setTimestamp();
    },

    welcome: (member, message, memberCount) => {
        const createdAt = member.user.createdAt;
        const diffMs = Date.now() - createdAt.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        let createdString = `${diffDays} gün önce`;
        if (diffDays > 365) createdString = `${Math.floor(diffDays / 365)} yıl önce`;
        if (diffDays === 0) createdString = 'Bugün';

        return new EmbedBuilder()
            .setColor(0x43B581) // Yeşil
            .setAuthor({ name: `${member.guild.name} Sunucusuna Hoş Geldin!`, iconURL: member.guild.iconURL({ dynamic: true }) })
            .setTitle(`👋 Hey ${member.user.username}!`)
            .setDescription(`Topluluğumuza katıldığın için teşekkürler.\nKuralları okumayı ve keyfine bakmayı unutma!\n\n> <@${member.id}>`)
            .addFields(
                { name: '👤 Üye', value: `\`${member.user.username}\``, inline: true },
                { name: '🎂 Hesap Tarihi', value: `\`${createdString}\``, inline: true },
                { name: '📊 Üye Sayısı', value: `\`#${memberCount}\``, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            // Placeholder Resim KALDIRILDI
            .setTimestamp()
            .setFooter({ text: `Üye #${memberCount} • Sunucuya katıldı`, iconURL: member.user.displayAvatarURL() });
    },

    leaderboard: (guildName, guildIcon, data) => {
        const formatList = (list, type) => {
            if (!list || list.length === 0) return 'Henüz veri yok.';
            return list.map((u, i) => {
                let icon = '🟦';
                if (i === 0) icon = '🥇';
                if (i === 1) icon = '🥈';
                if (i === 2) icon = '🥉';

                if (type === 'xp') return `${icon} <@${u.userId}> — Level **${u.level}** • **${u.xp.toLocaleString()}** XP`;
                if (type === 'msg') return `${icon} <@${u.userId}> — **${u.totalMessages.toLocaleString()}** mesaj`;
                if (type === 'voice') {
                    const h = Math.floor(u.totalVoiceMinutes / 60);
                    const m = u.totalVoiceMinutes % 60;
                    return `${icon} <@${u.userId}> — **${h}s ${m}dk**`;
                }
                return '';
            }).join('\n');
        };

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31)
            .setAuthor({ name: `${guildName} — Sunucu İstatistikleri`, iconURL: guildIcon })
            .setTitle(guildName)
            .setDescription(`
🏆 **Top XP (Tüm Zamanlar)**
${formatList(data.xp, 'xp')}

💬 **En Çok Mesaj**
${formatList(data.messages, 'msg')}

🎙️ **Ses Şampiyonları**
${formatList(data.voice, 'voice')}

⛔ **___________________________________**
📈 **Tüm Zamanlar İstatistiği**
👥 **Takip Edilen Üye:** ${data.stats.trackedUsers}
💬 **Toplam Mesaj:** ${data.stats.totalMessages.toLocaleString()}
🎙️ **Toplam Ses:** ${Math.floor(data.stats.totalVoice / 60)}s ${data.stats.totalVoice % 60}dk
            `)
            .setFooter({ text: `Son Güncelleme • Bugün saat ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Istanbul' })}`, iconURL: guildIcon });

        if (guildIcon) embed.setThumbnail(guildIcon);

        return embed;
    },

    verify: () => {
        return new EmbedBuilder()
            .setColor(0x2B2D31) // Koyu Gri / Siyah Tema
            .setTitle('🚀 NEXORA\'ya Katıl')
            .setDescription(`
Merhabalar, **Nexora** sunucusuna hoş geldiniz!
Sunucumuza erişim sağlamak ve topluluğumuzun bir parçası olmak için kayıt olmanız gerekmektedir.

**<a:welcome3:1246429706346303489> Neden Kayıt Olmalıyım?**
• 🛡️ Sunucu güvenliğini sağlamak için.
• 💬 Sohbet odalarına ve sesli kanallara erişim için.
• 🎉 Etkinliklere ve çekilişlere katılabilmek için.
• 🤖 Gelişmiş bot özelliklerini kullanabilmek için.

**📜 Nasıl Kayıt Olurum?**
Aşağıdaki **"Kayıt Ol"** butonuna tıklayarak saniyeler içinde kaydınızı tamamlayabilirsiniz.
Butona tıkladığınızda sunucu kurallarını okumuş ve kabul etmiş sayılırsınız.

_Keyifli vakit geçirmeniz dileğiyle!_
            `)
            .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=69795812&is=69780692&hm=38d32a4728d978f24f28e48049aa6d6a8b9be3d9daf7e8caae19b02b40ed691c&')
            .setFooter({ text: 'Nexora Security Systems • Güvenli Kayıt', iconURL: 'https://cdn.discordapp.com/emojis/1131182289455648839.gif' });
    },

    goodbye: (member, message) => {
        return new EmbedBuilder()
            .setColor(0xF04747)
            .setAuthor({ name: 'Üye Ayrıldı', iconURL: member.guild.iconURL({ dynamic: true }) })
            .setTitle(`👋 Görüşürüz, ${member.user.username}!`)
            .setDescription('Gittiğine üzüldük.\nUmarım seni tekrar görürüz!')
            .addFields(
                { name: '👤 Üye', value: `\`${member.user.username}\``, inline: true },
                { name: '📊 Kalan Üye', value: `\`${member.guild.memberCount}\``, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            // Placeholder Resim KALDIRILDI
            .setTimestamp()
            .setFooter({ text: `Şu an ${member.guild.memberCount} kişiyiz`, iconURL: member.guild.iconURL() });
    },

    levelUp: (user, level) => {
        return new EmbedBuilder()
            .setColor(colors.purple)
            .setTitle('🎉 Seviye Atladın!')
            .setDescription(`Tebrikler <@${user.id}>! **Seviye ${level}** oldun! 🚀`)
            .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setTimestamp();
    },

    moderation: (action, user, moderator, reason, duration = null) => {
        const embed = new EmbedBuilder()
            .setColor(colors.danger)
            .setTitle(`🔨 ${action}`)
            .addFields(
                { name: 'Kullanıcı', value: `${user.tag} (${user.id})`, inline: true },
                { name: 'Moderatör', value: `${moderator.tag}`, inline: true },
                { name: 'Sebep', value: reason || 'Belirtilmedi', inline: false }
            )
            .setTimestamp();
        if (duration) embed.addFields({ name: 'Süre', value: duration, inline: true });
        return embed;
    },

    guard: (type, message, details = null) => {
        const embed = new EmbedBuilder()
            .setColor(colors.danger)
            .setTitle(`🛡️ ${type} Algılandı!`)
            .setDescription(message)
            .setTimestamp();
        if (details) embed.addFields(details);
        return embed;
    }
};

module.exports = { embeds, colors };
