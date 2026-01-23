const { Events, EmbedBuilder } = require('discord.js');
const path = require('path');
const inviteCache = require('../utils/inviteCache');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const guild = member.guild;
        const channelId = '1464206305853177917'; // Kayıt/Hoşgeldin Kanalı

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

        // 3. Mesajı Gönder (Resimli ve Sade Format)
        const channel = guild.channels.cache.get(channelId);
        if (channel) {
            let msgContent = '';

            // Eğer inviter varsa mesaj metni
            if (inviter) {
                msgContent = `<:giris:1246429678567428170> <@${member.id}> Katıldı, Davet eden <@${inviter.id}> (**${inviteCount}** davet)`;
            } else {
                msgContent = `<:giris:1246429678567428170> <@${member.id}> Katıldı (Özel Link / Bot)`;
            }

            // Canvas Resmini Üret
            const { createWelcomeImage } = require('../utils/canvasHelper');
            try {
                const attachment = await createWelcomeImage(member);
                await channel.send({ content: msgContent, files: [attachment] });
            } catch (err) {
                console.error('Canvas hatası:', err);
                // Hata olursa sadece yazıyı at
                await channel.send(msgContent);
            }
        }
    }
};
