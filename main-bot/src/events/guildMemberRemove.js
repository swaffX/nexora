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
                let msgContent = `<:leave:1330926528766115931> <@${member.id}> Ayrıldı.`;

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

                        msgContent += ` <@${inviterId}> tarafından davet edildi. **Kalan Davet ${totalInvites}**`;
                    } else {
                        msgContent += ` Davet eden bulunamadı (Veri yok).`;
                    }
                } else {
                    msgContent += ` Davet eden bulunamadı.`;
                }

                await channel.send(msgContent);
            }
        }
    }
};
