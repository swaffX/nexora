const path = require('path');
const { AuditLogEvent } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

// Eylem takibi için yardımcı fonksiyon
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

// Ceza uygula
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

            logger.guard('NUKE', `${member.user.tag} rolleri kaldırıldı: ${reason}`);
        }

        if (logChannelId) {
            const logChannel = guild.channels.cache.get(logChannelId);
            if (logChannel) {
                logChannel.send({
                    embeds: [embeds.guard(
                        '🚨 Anti-Nuke Tetiklendi',
                        `Tehlikeli aktivite tespit edildi ve engelllendi.`,
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
    name: 'roleDelete',
    async execute(role, client) {
        const guildSettings = await Guild.findOrCreate(role.guild.id, role.guild.name);

        if (!guildSettings.antiNuke?.enabled) return;

        const antiNuke = guildSettings.antiNuke;

        try {
            const auditLogs = await role.guild.fetchAuditLogs({
                type: AuditLogEvent.RoleDelete,
                limit: 1
            });

            const log = auditLogs.entries.first();
            if (!log) return;

            const executor = log.executor;

            // --- WHITELIST CHECK START ---
            const SAFE_BOT_IDS = require(path.join(__dirname, '..', '..', '..', 'shared', 'safeBots'));
            if (SAFE_BOT_IDS.includes(executor.id)) return;
            // --- WHITELIST CHECK END ---

            if (antiNuke.whitelistedUsers.includes(executor.id)) return;
            if (executor.id === role.guild.ownerId) return;

            const count = await trackAction(client, role.guild.id, executor.id, 'roleDelete', guildSettings);

            if (count >= antiNuke.roleDeleteLimit) {
                await punishUser(
                    role.guild,
                    executor.id,
                    `${count} rol silme (limit: ${antiNuke.roleDeleteLimit})`,
                    antiNuke.action,
                    antiNuke.logChannelId
                );
            }
        } catch (error) {
            logger.error('Audit log alınamadı:', error.message);
        }
    }
};
