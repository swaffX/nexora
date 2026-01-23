const { Events, EmbedBuilder } = require('discord.js');
const path = require('path');
const inviteCache = require('../utils/inviteCache');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const guild = member.guild;
        const channelId = '1464206305853177917'; // Kayıt/Hoşgeldin Kanalı

        // --- OTO ROL (Hardcoded) ---
        const autoRoleId = '1463875341553635553';
        try {
            const role = guild.roles.cache.get(autoRoleId);
            if (role) {
                await member.roles.add(role);
            } else {
                console.warn(`[OtoRol] Rol bulunamadı: ${autoRoleId}`);
            }
        } catch (error) {
            console.error(`[OtoRol] Hata (${member.user.tag}):`, error);
        }
        // ---------------------------

        // 1. Yeni davetleri çek
        const newInvites = await guild.invites.fetch();

        // 2. Cache ile karşılaştırıp davet edeni bul
        const cachedInvites = inviteCache.getInvites(guild.id);

        let inviter = null;
        let usedInvite = null;

        if (cachedInvites) {
            usedInvite = newInvites.find(inv => {
                const prevUses = cachedInvites.get(inv.code);
                return prevUses !== undefined && inv.uses > prevUses;
            });
        }

        // Cache'i güncelle (Her halükarda yeni durumu kaydet)
        inviteCache.fetchInvites(guild);

        let inviteCount = 0;
        let inviterUser = null;

        if (usedInvite && usedInvite.inviter) {
            inviter = usedInvite.inviter;
            inviterUser = await User.findOne({ odasi: inviter.id, odaId: guild.id });

            // Eğer inviter DB'de yoksa oluştur
            if (!inviterUser) {
                inviterUser = await User.findOrCreate(inviter.id, guild.id, inviter.username);
            }

            // DB Güncelle: Regular Invite +1
            // Kendi kendini davet etme kontrolü (Opsiyonel ama iyi olur)
            if (inviter.id !== member.id) {
                if (!inviterUser.invites) inviterUser.invites = { regular: 0, bonus: 0, fake: 0, left: 0 };
                inviterUser.invites.regular += 1;
                await inviterUser.save();

                // Gelen kişiye "invitedBy" işle
                const memberData = await User.findOrCreate(member.id, guild.id, member.user.username);
                memberData.invitedBy = inviter.id;
                await memberData.save();

                memberData.save(); // Promise beklemeye gerek yok
            }

            inviteCount = inviterUser.getTotalInvites ? inviterUser.getTotalInvites() : (inviterUser.invites.regular + inviterUser.invites.bonus - inviterUser.invites.fake - inviterUser.invites.left);
        }

        // 3. Mesajı Gönder (Embed Formatı)
        const channel = guild.channels.cache.get(channelId);
        if (channel) {

            // Hesap Tarihi Hesaplama
            const createdTimestamp = Math.floor(member.user.createdTimestamp / 1000);
            const joinedTimestamp = Math.floor(member.joinedTimestamp / 1000);

            // Üye Sırası (Yaklaşık)
            const memberCount = guild.memberCount;

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#2ecc71') // Yeşil (Giriş)
                .setTitle('<:giris:1246429678567428170> Nexora Sunucusuna Hoş Geldin!')
                .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 512 }))
                .setDescription(
                    `<a:Hello:1246429715158274058> **Hey ${member.user.username}!**\n\n` +
                    `Topluluğumuza katıldığın için teşekkürler.\n` +
                    `Kuralları okumayı ve keyfine bakmayı unutma!\n\n` +
                    (inviter ? `<a:tik:1242549144887754853> Davet Eden: <@${inviter.id}> (**${inviteCount}** davet)` : `(Özel Bağlantı ile katıldı)`)
                )
                .addFields(
                    { name: '👤 Üye', value: `<@${member.id}>\n\`${member.user.tag}\``, inline: true },
                    { name: '🎂 Hesap Tarihi', value: `<t:${createdTimestamp}:R>`, inline: true }, // "1 yıl önce" formatı
                    { name: '📊 Üye Sayısı', value: `#${memberCount}`, inline: true }
                )
                .setFooter({ text: `Üye #${memberCount} • Sunucuya katıldı`, iconURL: guild.iconURL() })
                .setTimestamp();

            await channel.send({ content: `<@${member.id}>`, embeds: [welcomeEmbed] });
        }
    }
};
