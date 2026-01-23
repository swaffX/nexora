const { Collection } = require('discord.js');

// Her sunucu için davetleri tutacak Map
// Map<GuildID, Collection<InviteCode, InviteUses>>
const invites = new Map();

module.exports = {
    // Cache'i başlat/güncelle
    async fetchInvites(guild) {
        const fetchedInvites = await guild.invites.fetch();
        const codeUses = new Collection();
        fetchedInvites.each(inv => codeUses.set(inv.code, inv.uses));
        invites.set(guild.id, codeUses);
        return codeUses;
    },

    // Cache'ten davetleri al
    getInvites(guildId) {
        return invites.get(guildId);
    },

    // Cache'e tekil ekleme (InviteCreate event için)
    addInvite(invite) {
        const guildInvites = invites.get(invite.guild.id) || new Collection();
        guildInvites.set(invite.code, invite.uses);
        invites.set(invite.guild.id, guildInvites);
    },

    // Cache'ten silme (InviteDelete event için)
    removeInvite(invite) {
        const guildInvites = invites.get(invite.guild.id);
        if (guildInvites) {
            guildInvites.delete(invite.code);
        }
    }
};
