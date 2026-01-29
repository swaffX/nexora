const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '..', '.env') });
const { AuditLogEvent } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

// Eylem takibi için yardımcı fonksiyon
async function trackAction(client, guildId, odasi, actionType, guildSettings) {
    const cacheKey = `${guildId}-${odasi}`;
    const now = Date.now();

    let userActions = client.actionCache.get(cacheKey) || {};

    // Eylem tipine göre kaydet
    if (!userActions[actionType]) {
        userActions[actionType] = [];
    }

    // Eski eylemleri temizle
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
            // Tüm tehlikeli rolleri kaldır
            const dangerousPermissions = [
                'Administrator',
                'ManageGuild',
                'ManageChannels',
                'ManageRoles',
                'BanMembers',
                'KickMembers'
            ];

            const rolesToRemove = member.roles.cache.filter(role =>
                dangerousPermissions.some(perm => role.permissions.has(perm))
            );

            for (const [, role] of rolesToRemove) {
                await member.roles.remove(role, `Anti-Nuke: ${reason}`).catch(() => { });
            }

            logger.guard('NUKE', `${member.user.tag} rolleri kaldırıldı: ${reason}`);
        }

        // Log kanalına bildir
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
    name: 'channelDelete',
    async execute(channel, client) {
        let guildSettings;
        try {
            guildSettings = await Guild.findOrCreate(channel.guild.id, channel.guild.name);
        } catch (error) {
            console.error('Guard Bot DB Hatası:', error.message);
            // DB Hatası durumunda varsayılan koruma aktif (Fail-Safe)
            guildSettings = {
                antiNuke: {
                    enabled: true,
                    channelDeleteLimit: 3,
                    action: 'ban',
                    logChannelId: null,
                    whitelistedUsers: []
                }
            };
        }

        if (!guildSettings.antiNuke?.enabled) return;

        const antiNuke = guildSettings.antiNuke;

        // Audit log'dan sileni bul
        try {
            const auditLogs = await channel.guild.fetchAuditLogs({
                type: AuditLogEvent.ChannelDelete,
                limit: 1
            });

            const log = auditLogs.entries.first();
            if (!log) return;
            const executor = log.executor;

            // Dost Botları Koru (Whitelist)
            const SAFE_BOT_IDS = require(path.join(__dirname, '..', '..', '..', 'shared', 'safeBots'));

            if (SAFE_BOT_IDS.includes(executor.id)) {
                // Dost bot veya herhangi bir bot ise işlem yapma
                return;
            }
            if (antiNuke.whitelistedUsers.includes(executor.id)) return;
            if (executor.id === channel.guild.ownerId) return;

            // Eylem sayısını takip et
            const count = await trackAction(client, channel.guild.id, executor.id, 'channelDelete', guildSettings);

            if (count >= antiNuke.channelDeleteLimit) {
                await punishUser(
                    channel.guild,
                    executor.id,
                    `${count} kanal silme (limit: ${antiNuke.channelDeleteLimit})`,
                    antiNuke.action,
                    antiNuke.logChannelId
                );
            }
        } catch (error) {
            logger.error('Audit log alınamadı:', error.message);
        }
    }
};
