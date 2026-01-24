const { EmbedBuilder, PermissionsBitField, ChannelType } = require('discord.js');

async function runAudit(guild) {
    const report = {
        riskyRoles: [],
        openChannels: [],
        unusedRoles: [],
        riskyBots: [],
        everyonePing: []
    };

    // Tüm üyeleri fetchle (Rol üyelerini doğru saymak için)
    await guild.members.fetch();

    // 1. Rol Taraması
    guild.roles.cache.forEach(role => {
        // Yönetici Yetkisi
        if (role.permissions.has(PermissionsBitField.Flags.Administrator)) {
            report.riskyRoles.push({ name: role.name, id: role.id, members: role.members.size });
        }
        // Boş Roller (Bot rolleri hariç - managed)
        if (role.members.size === 0 && role.name !== '@everyone' && !role.managed) {
            report.unusedRoles.push(role.name);
        }
        // Everyone ping yetkisi
        if (role.permissions.has(PermissionsBitField.Flags.MentionEveryone) && role.name !== '@everyone') {
            report.everyonePing.push(role.name);
        }
    });

    // 2. Kanal Taraması
    guild.channels.cache.forEach(channel => {
        if (channel.type === ChannelType.GuildText) {
            const perms = channel.permissionsFor(guild.roles.everyone);
            // Everyone mesaj atabiliyor mu?
            if (perms.has(PermissionsBitField.Flags.SendMessages)) {
                report.openChannels.push(channel.name);
            }
        }
    });

    // 3. Bot Taraması
    const bots = guild.members.cache.filter(u => u.user.bot);
    bots.forEach(bot => {
        if (bot.permissions.has(PermissionsBitField.Flags.Administrator)) {
            report.riskyBots.push(bot.user.tag);
        }
    });

    return report;
}

module.exports = { runAudit };
