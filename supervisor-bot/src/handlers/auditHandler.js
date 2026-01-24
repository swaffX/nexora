const { PermissionsBitField, ChannelType } = require('discord.js');

async function runAudit(guild) {
    // Verileri tazeleyelim
    await guild.members.fetch();
    await guild.roles.fetch();
    await guild.channels.fetch();

    const report = {
        score: 100,
        riskyHumanRoles: [], // Yönetici İnsan Rolleri
        riskyBotRoles: [],   // Yönetici Bot Rolleri
        dangerousRoles: [],  // Yönetici Değil AMA Tehlikeli (Ban/Kick/ManageServer)
        openChannels: [],
        unusedRoles: [],
        everyonePing: [],
        totalRoles: guild.roles.cache.size,
        totalChannels: guild.channels.cache.size
    };

    // 1. ROL TARAMASI (Hiyerarşik Sıralama: En Üstten En Alta)
    const roles = guild.roles.cache.sort((a, b) => b.position - a.position);

    roles.forEach(role => {
        if (role.id === guild.id) return; // @everyone geç

        const isAdmin = role.permissions.has(PermissionsBitField.Flags.Administrator);
        const isBotRole = role.managed; // Bot veya Entegrasyon rolü mü?

        // A) YÖNETİCİ ROLLERİ
        if (isAdmin) {
            if (isBotRole) {
                // Bot Rolü
                report.riskyBotRoles.push({
                    name: role.name,
                    id: role.id,
                    botId: role.tags?.botId
                });
            } else {
                // İnsan Rolü (RİSK!)
                report.riskyHumanRoles.push({
                    name: role.name,
                    id: role.id,
                    members: role.members.size,
                    position: role.position
                });
                // Çok fazla kişide admin varsa puan düş
                if (role.members.size > 3) report.score -= 5;
            }
        }
        // B) TEHLİKELİ ROLLER (Yönetici değil ama Ban/Kick/Yönetim var)
        else if (!isBotRole && (
            role.permissions.has(PermissionsBitField.Flags.BanMembers) ||
            role.permissions.has(PermissionsBitField.Flags.KickMembers) ||
            role.permissions.has(PermissionsBitField.Flags.ManageGuild) ||
            role.permissions.has(PermissionsBitField.Flags.ManageChannels) ||
            role.permissions.has(PermissionsBitField.Flags.ManageRoles)
        )) {
            report.dangerousRoles.push({
                name: role.name,
                members: role.members.size,
                perms: role.permissions.toArray() // İsteğe bağlı
            });
        }

        // C) EVERYONE PING
        if (role.permissions.has(PermissionsBitField.Flags.MentionEveryone) && !isBotRole) {
            report.everyonePing.push(role.name);
            report.score -= 2;
        }

        // D) BOŞ ROLLER
        if (role.members.size === 0 && !isBotRole) {
            report.unusedRoles.push(role.name);
        }
    });

    // 2. KANAL TARAMASI
    const textChannels = guild.channels.cache.filter(c => c.type === ChannelType.GuildText);

    textChannels.forEach(channel => {
        const perms = channel.permissionsFor(guild.roles.everyone);

        // Everyone Mesaj Atabiliyor mu?
        if (perms.has(PermissionsBitField.Flags.SendMessages)) {
            report.openChannels.push({
                name: channel.name,
                id: channel.id,
                parent: channel.parent?.name || 'Kategorisiz'
            });
            report.score -= 1;
        }
    });

    // SKOR DÜZELTMESİ
    if (report.score < 0) report.score = 0;

    return report;
}

module.exports = { runAudit };
