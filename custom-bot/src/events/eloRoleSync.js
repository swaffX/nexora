const { Events } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const eloService = require('../services/eloService');

const REQUIRED_ROLE_ID = '1466189076347486268';

module.exports = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember, newMember, client) {
        // Sadece ilgili sunucuda çalışsın (isteğe bağlı, şimdilik her yerde)
        // if (newMember.guild.id !== process.env.GUILD_ID) return;

        const hadRole = oldMember.roles.cache.has(REQUIRED_ROLE_ID);
        const hasRole = newMember.roles.cache.has(REQUIRED_ROLE_ID);

        // Rol Değişimi Yoksa Çık
        if (hadRole === hasRole) return;

        const userId = newMember.id;
        const guildId = newMember.guild.id;

        try {
            if (!hadRole && hasRole) {
                // ROL EKLENDİ -> Sisteme Kaydet
                console.log(`[ELO Sync] Rol eklendi: ${newMember.user.tag} (${userId})`);

                let userDoc = await User.findOne({ odasi: userId, odaId: guildId });
                if (!userDoc) {
                    userDoc = new User({
                        odasi: userId,
                        odaId: guildId,
                        matchStats: eloService.createDefaultStats() // 200 ELO ve Level 1
                    });
                    await userDoc.save();
                    console.log(`[ELO Sync] Yeni kullanıcı oluşturuldu: ${newMember.user.tag}`);
                } else if (!userDoc.matchStats || !userDoc.matchStats.elo) {
                    // Kullanıcı var ama matchStats yoksa ekle
                    userDoc.matchStats = eloService.createDefaultStats();
                    await userDoc.save();
                    console.log(`[ELO Sync] Kullanıcı stats güncellendi: ${newMember.user.tag}`);
                }
            }
            else if (hadRole && !hasRole) {
                // ROL ALINDI -> Sistemden Sil (matchStats'ı temizle)
                console.log(`[ELO Sync] Rol alındı: ${newMember.user.tag} (${userId})`);

                // matchStats alanını silmek (unset) yerine null/boş yapabiliriz veya dokümanı tamamen silebiliriz.
                // İsteğe göre:
                // 1. Dokümanı tamamen sil: await User.deleteOne({ odasi: userId, odaId: guildId });
                // 2. Sadece ELO verisini sil:

                await User.findOneAndUpdate(
                    { odasi: userId, odaId: guildId },
                    { $unset: { matchStats: "" } } // matchStats alanını tamamen kaldırır
                );
                console.log(`[ELO Sync] Kullanıcı stats silindi: ${newMember.user.tag}`);
            }
        } catch (error) {
            console.error('[ELO Sync Error] GuildMemberUpdate:', error);
        }
    }
};
