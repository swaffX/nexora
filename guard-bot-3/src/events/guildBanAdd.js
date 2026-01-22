const path = require('path');
const { AuditLogEvent } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

async function trackAction(client, guildId, odasi, actionType, guildSettings) {
    const cacheKey = `${guildId}-${odasi}`;
    const now = Date.now();

    let userActions = client.actionCache.get(cacheKey) || {};

    if (!userActions[actionType]) {
        userActions[actionType] = [];
    }

    const timeWindow = guildSettings.antiNuke.timeWindow;
    userActions[actionType] = userActions[actionType].filter(t => now - t < timeWindow);
    userActions[actionType].push(now);

    client.actionCache.set(cacheKey, userActions);

    return userActions[actionType].length;
}

async function punishUser(guild, odasi, reason, action, logChannelId) {
    try {
        const member = await guild.members.fetch(odasi).catch(() => null);
        if (!member) return;

        if (action === 'ban') {
            await member.ban({ reason: `Anti-Nuke: ${reason}` });
            logger.guard('NUKE', `${member.user.tag} yasaklandı: ${reason}`);
        } else {
            const dangerousPermissions = [
                'Administrator', 'ManageGuild', 'ManageChannels',
                'ManageRoles', 'BanMembers', 'KickMembers'
            ];

            const rolesToRemove = member.roles.cache.filter(role =>
                dangerousPermissions.some(perm => role.permissions.has(perm))
            );

            for (const [, role] of rolesToRemove) {
                await member.roles.remove(role, `Anti-Nuke: ${reason}`).catch(() => { });
            }
        }

        if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel) {
                logChannel.send({
                    embeds: [embeds.guard(
                        '🚨 Anti-Nuke Tetiklendi',
                        `Tehlikeli aktivite tespit edildi ve engellendi.`,
                        [
                            { name: 'Kullanıcı', value: `<@${odasi}>`, inline: true },
                            { name: 'Sebep', value: reason, inline: true },
                            { name: 'Eylem', value: action === 'ban' ? 'Yasaklama' : 'Rol Kaldırma', inline: true }
                        ]
                    )]
                });
            }
        }
    } catch (error) {
        logger.error('Anti-nuke ceza uygulanamadı:', error.message);
    }
}

module.exports = {
    name: 'guildBanAdd',
    async execute(ban, client) {
        const guildSettings = await Guild.findOrCreate(ban.guild.id, ban.guild.name);

        if (!guildSettings.antiNuke.enabled) return;

        const antiNuke = guildSettings.antiNuke;

        try {
            const auditLogs = await ban.guild.fetchAuditLogs({
                type: AuditLogEvent.MemberBanAdd,
                limit: 1
            });

            const log = auditLogs.entries.first();
            if (!log) return;

            const executor = log.executor;
            if (executor.bot) return;
            if (antiNuke.whitelistedUsers.includes(executor.id)) return;
            if (executor.id === ban.guild.ownerId) return;

            const count = await trackAction(client, ban.guild.id, executor.id, 'ban', guildSettings);

            if (count >= antiNuke.banLimit) {
                await punishUser(
                    ban.guild,
                    executor.id,
                    `${count} yasaklama (limit: ${antiNuke.banLimit})`,
                    antiNuke.action,
                    antiNuke.logChannelId
                );

                // Yasağı geri al
                try {
                    await ban.guild.members.unban(ban.user, 'Anti-Nuke: Yasak geri alındı');
                } catch (e) { }
            }
        } catch (error) {
            logger.error('Audit log alınamadı:', error.message);
        }
    }
};
