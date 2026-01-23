const { Events } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member) {
        const guild = member.guild;
        const channelId = '1464206305853177917'; // Kayıt/Hoşgeldin Kanalı

        // 1. Veritabanından çıkan kişinin bilgisini çek
        const memberData = await User.findOne({ odasi: member.id, odaId: guild.id });

        if (channelId) {
            const channel = guild.channels.cache.get(channelId);
            if (channel) {
                // İstenen Emoji: <:cikis:1246429697231814717>
                let msgContent = `<:cikis:1246429697231814717> <@${member.id}> sunucudan ayrıldı.`;

                if (memberData && memberData.invitedBy) {
                    const inviterId = memberData.invitedBy;

                    // Davet edeni bul ve güncelle
                    const inviterData = await User.findOne({ odasi: inviterId, odaId: guild.id });

                    if (inviterData) {
                        if (!inviterData.invites) inviterData.invites = { regular: 0, bonus: 0, fake: 0, left: 0 };

                        inviterData.invites.left += 1;
                        await inviterData.save();

                        // Yeni Toplam Hesapla (Regular + Bonus - Fake - Left)
                        const totalInvites = (inviterData.invites.regular || 0) + (inviterData.invites.bonus || 0) - (inviterData.invites.fake || 0) - (inviterData.invites.left || 0);

                        msgContent += ` Davet eden: <@${inviterId}> (**${totalInvites}** davet)`;
                    } else {
                        msgContent += ` (Davet eden bilgisi güncellenemedi)`;
                    }
                } else {
                    msgContent += ` (Davet eden bulunamadı)`;
                }

                try {
                    // Embed Hazırlığı
                    const { EmbedBuilder } = require('discord.js');

                    const leaveEmbed = new EmbedBuilder()
                        .setColor('#e74c3c') // Kırmızı (Çıkış)
                        .setTitle('<:cikis:1246429697231814717> Üye Ayrıldı')
                        .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                        .setDescription(
                            `<a:Hello:1246429715158274058> **Görüşürüz, ${member.user.username}!**\n\n` +
                            `Gittiğine üzüldük.\n` +
                            `Umarım seni tekrar görürüz!`
                        )
                        .addFields(
                            { name: '👤 Üye', value: `<@${member.id}>\n\`${member.user.tag}\``, inline: true },
                            { name: '📊 Kalan Üye', value: `${guild.memberCount}`, inline: true }
                        )
                        .setFooter({ text: `Şu an ${guild.memberCount} kişiyiz`, iconURL: guild.iconURL() })
                        .setTimestamp();

                    // Invite Tracker Mesajını, Embed'in yanına veya içine ekleyebiliriz.
                    // Resimde görünmediği için sadece Embed atıyorum.
                    // Eğer davet eden bilgisini de istiyorsan embed.description'a ekleyebilirim.

                    // msgContent şu an sadece log için kullanılıyor veya opsiyonel metin olarak atılabilir.
                    // Görselde sadece embed var.

                    await channel.send({ embeds: [leaveEmbed] });

                } catch (e) {
                    console.error("Leave msg send error:", e);
                }
            }
        }
    }
};
