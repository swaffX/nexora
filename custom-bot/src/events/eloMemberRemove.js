const { Events } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    name: Events.GuildMemberRemove,
    async execute(member, client) {
        const userId = member.id;
        const guildId = member.guild.id;

        try {
            // Sunucudan çıkan kişinin ELO verilerini temizle
            // İsterseniz kaydı tamamen silebiliriz veya sadece ELO'yu silebiliriz.
            // Rol senkronizasyonunda "stats silme" yöntemini kullandık, burada da aynısını yapalım.

            const result = await User.findOneAndUpdate(
                { odasi: userId, odaId: guildId },
                { $unset: { matchStats: "" } }
            );

            if (result && result.matchStats) {
                console.log(`[ELO Sync] Sunucudan ayrıldı, stats silindi: ${member.user.tag} (${userId})`);
            }
        } catch (error) {
            console.error('[ELO Sync Error] GuildMemberRemove:', error);
        }
    }
};
