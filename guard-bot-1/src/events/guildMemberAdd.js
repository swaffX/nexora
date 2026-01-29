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

        // ==================== 🕵️‍♂️ FAKE HESAP TESPİTİ V2 ====================
        let isRisky = false;
        let riskReason = '';

        // 1. Hesap Yaşı Kontrolü
        const accountAge = utils.getAccountAge(member.user);
        if (accountAge < antiRaid.minAccountAge) {
            isRisky = true;
            riskReason = `Hesap çok yeni (${accountAge} gün)`;
        }

        // 2. Avatar Kontrolü (Default Avatar mı?)
        // Eğer hesap 7 günden yeniyse VE avatarı yoksa risklidir.
        if (!isRisky && accountAge < 7 && !member.user.avatar) {
            isRisky = true;
            riskReason = 'Yeni ve avatarsız hesap';
        }

        // 3. Şüpheli İsim Kontrolü (Örn: "Free Nitro", "Steam Gift", karışık sayılar)
        if (!isRisky) {
            const suspiciousPatterns = [/free.*nitro/i, /discord.*gift/i, /steam.*community/i, /boring_.*regex/i, /sell.*boost/i];
            if (suspiciousPatterns.some(regex => regex.test(member.user.username))) {
                isRisky = true;
                riskReason = 'Şüpheli kullanıcı adı';
            }
        }

        if (isRisky) {
            logger.guard('RAID', `Riskli hesap tespit edildi: ${member.user.tag} - Sebep: ${riskReason}`);

            // İşlem: Jail mi Kick mi?
            const jailRoleId = guildSettings.jailSystem?.roleId;

            try {
                // Kullanıcıya DM at
                try {
                    await member.send({
                        embeds: [embeds.warning(
                            'Erişim Kısıtlandı',
                            `Hesabınız güvenlik filtrelerine takıldı.\nSebep: **${riskReason}**\n\nMin. Hesap Yaşı: **${antiRaid.minAccountAge} Gün**`
                        )]
                    });
                } catch (e) { }

                // Jail varsa Jail, yoksa Kick/Ban
                if (jailRoleId && member.guild.roles.cache.has(jailRoleId)) {
                    await member.roles.add(jailRoleId, 'Anti-Raid: Riskli Hesap');
                    logger.guard('RAID', `${member.user.tag} karantinaya alındı (Jail).`);
                } else {
                    // Jail yoksa eski usul Kick
                    // Sadece hesap yaşı çok küçükse atalım, diğerlerinde loglayalım (Yanlış pozitif olmasın)
                    if (accountAge < antiRaid.minAccountAge) {
                        await member.kick(`Anti-Raid: ${riskReason}`);
                    }
                }

            } catch (error) {
                logger.error('Riskli üyeye işlem yapılamadı:', error.message);
            }

            // Log kanalına bildir
            if (antiRaid.logChannelId) {
                const logChannel = member.guild.channels.cache.get(antiRaid.logChannelId);
                if (logChannel) {
                    logChannel.send({
                        embeds: [embeds.guard(
                            'Riskli Hesap İşlemi',
                            `${member.user.tag} filtreye takıldı.`,
                            [
                                { name: 'Kullanıcı', value: `<@${member.id}>`, inline: true },
                                { name: 'Hesap Yaşı', value: `${accountAge} gün`, inline: true },
                                { name: 'Sebep', value: riskReason, inline: true },
                                { name: 'İşlem', value: jailRoleId ? 'Karantina (Jail)' : (accountAge < antiRaid.minAccountAge ? 'Atıldı' : 'İzleniyor'), inline: true }
                            ]
                        )]
                    });
                }
            }

            // Eğer Jail'e aldıysak veya attıysak buradak çıkabiliriz
            // Ama mass join kontrolü için saymaya devam etmeliyiz? Hayır, riskli ise zaten işlem yapıldı.
            if (jailRoleId || accountAge < antiRaid.minAccountAge) return;
        }

        // ==================== 🚀 MASS JOIN (RAID) KONTROLÜ ====================
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

                        logger.guard('RAID', 'Sunucu kilitlendi (Otomatik)!');
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
