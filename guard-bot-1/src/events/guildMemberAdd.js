const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const utils = require(path.join(__dirname, '..', '..', '..', 'shared', 'utils'));

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const guildId = member.guild.id;

        // Guild ayarlarını al
        const guildSettings = await Guild.findOrCreate(guildId, member.guild.name);

        // Anti-raid kapalıysa çık
        if (!guildSettings.antiRaid.enabled) return;

        const antiRaid = guildSettings.antiRaid;

        // Whitelist kontrolü
        if (antiRaid.whitelistedUsers.includes(member.id)) return;

        // Hesap yaşı kontrolü
        const accountAge = utils.getAccountAge(member.user);
        if (accountAge < antiRaid.minAccountAge) {
            logger.guard('RAID', `Yeni hesap tespit edildi: ${member.user.tag} (${accountAge} gün)`);

            try {
                await member.send({
                    embeds: [embeds.warning(
                        'Erişim Engellendi',
                        `Hesabınız çok yeni olduğu için sunucuya katılamazsınız.\nMinimum hesap yaşı: **${antiRaid.minAccountAge} gün**\nHesap yaşınız: **${accountAge} gün**`
                    )]
                }).catch(() => { });

                await member.kick('Anti-Raid: Hesap çok yeni');
            } catch (error) {
                logger.error('Üye atılamadı:', error.message);
            }

            // Log kanalına bildir
            if (antiRaid.logChannelId) {
                const logChannel = member.guild.channels.cache.get(antiRaid.logChannelId);
                if (logChannel) {
                    logChannel.send({
                        embeds: [embeds.guard(
                            'Yeni Hesap Engellendi',
                            `${member.user.tag} sunucuya katılmaya çalıştı ama engellendi.`,
                            [
                                { name: 'Kullanıcı', value: `<@${member.id}>`, inline: true },
                                { name: 'Hesap Yaşı', value: `${accountAge} gün`, inline: true },
                                { name: 'Sebep', value: `Minimum ${antiRaid.minAccountAge} gün gerekli`, inline: true }
                            ]
                        )]
                    });
                }
            }
            return;
        }

        // Mass join kontrolü
        const now = Date.now();
        let recentJoins = client.joinCache.get(guildId) || [];

        // Eski joinleri temizle
        recentJoins = recentJoins.filter(timestamp => now - timestamp < antiRaid.joinTime);
        recentJoins.push(now);
        client.joinCache.set(guildId, recentJoins);

        // Limit kontrolü
        if (recentJoins.length >= antiRaid.joinLimit) {
            logger.guard('RAID', `Raid tespit edildi! ${member.guild.name} - ${recentJoins.length} üye ${antiRaid.joinTime / 1000} saniyede`);

            // Raid modunu aktifle
            if (!client.raidMode.get(guildId)) {
                client.raidMode.set(guildId, true);

                // Log kanalına bildir
                if (antiRaid.logChannelId) {
                    const logChannel = member.guild.channels.cache.get(antiRaid.logChannelId);
                    if (logChannel) {
                        logChannel.send({
                            embeds: [embeds.guard(
                                '🚨 RAID TESPİT EDİLDİ!',
                                `Sunucuya kısa sürede çok fazla üye katıldı!\n\n**Eylem:** ${antiRaid.action === 'lockdown' ? 'Sunucu kilitleniyor' : `Yeni üyeler ${antiRaid.action === 'ban' ? 'yasaklanıyor' : 'atılıyor'}`}`,
                                [
                                    { name: 'Katılım', value: `${recentJoins.length} üye`, inline: true },
                                    { name: 'Süre', value: `${antiRaid.joinTime / 1000} saniye`, inline: true }
                                ]
                            )]
                        });
                    }
                }

                // Lockdown uygula
                if (antiRaid.action === 'lockdown') {
                    try {
                        // Text kanallarını kilitle
                        const channels = member.guild.channels.cache.filter(c => c.type === 0);
                        for (const [, channel] of channels) {
                            await channel.permissionOverwrites.edit(member.guild.roles.everyone, {
                                SendMessages: false
                            }).catch(() => { });
                        }

                        logger.guard('RAID', 'Sunucu kilitlendi!');
                    } catch (error) {
                        logger.error('Lockdown uygulanamadı:', error.message);
                    }
                }

                // 5 dakika sonra raid modunu devre dışı bırak
                setTimeout(() => {
                    client.raidMode.set(guildId, false);
                    client.joinCache.delete(guildId);
                    logger.guard('RAID', `Raid modu devre dışı: ${member.guild.name}`);
                }, 5 * 60 * 1000);
            }

            // Kullanıcıya işlem uygula
            try {
                if (antiRaid.action === 'ban') {
                    await member.ban({ reason: 'Anti-Raid: Mass join tespit edildi' });
                } else {
                    await member.kick('Anti-Raid: Mass join tespit edildi');
                }
            } catch (error) {
                logger.error('Raid eylemi uygulanamadı:', error.message);
            }
        }
    }
};
