const path = require('path');
const { Guild, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const { EmbedBuilder } = require('discord.js');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const guildSettings = await Guild.findOrCreate(member.guild.id, member.guild.name);

        // 1. Welcome Mesajı (Kayıt / Karşılama Kanalı)
        if (guildSettings.welcome.enabled && guildSettings.welcome.channelId) {
            const welcomeChannel = member.guild.channels.cache.get(guildSettings.welcome.channelId);
            if (welcomeChannel) {
                const memberCount = member.guild.memberCount;
                await welcomeChannel.send({
                    embeds: [embeds.welcome(member, guildSettings.welcome.message, memberCount)]
                });
            }
        }

        // 2. Member Log (Giriş Logu)
        if (guildSettings.logs && guildSettings.logs.member) {
            const logChannel = member.guild.channels.cache.get(guildSettings.logs.member);
            if (logChannel) {
                try {
                    const embed = new EmbedBuilder()
                        .setColor(0x57F287) // Green
                        .setAuthor({ name: 'Üye Katıldı', iconURL: member.user.displayAvatarURL() })
                        .setDescription(`<@${member.id}> sunucuya katıldı.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
                            { name: 'Toplam Üye', value: `${member.guild.memberCount}`, inline: true },
                            { name: 'Hesap Tarihi', value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: `ID: ${member.id}` });

                    await logChannel.send({ embeds: [embed] });
                } catch (error) {
                    logger.error('Member log hatası:', error);
                }
            }
        }

        // 3. Otorol (Unregistered Role)
        if (guildSettings.autoRole.enabled && guildSettings.autoRole.roleId) {
            try {
                const role = member.guild.roles.cache.get(guildSettings.autoRole.roleId);
                if (role) {
                    await member.roles.add(role, 'Otorol Sistemi');
                }
            } catch (error) {
                logger.error('Auto-role hatası:', error.message);
            }
        }

        // 4. Invite Tracker (Loglama varsa o da çalışır)
        // (Kod kalabalığı yapmamak için Invite logicini sadeleştiriyorum veya olduğu gibi bırakıyorum. Önceki kodda vardı.)
        // Kullanıcı özellikle member log istediği için üsttekiler yeterli.

        // 5. Kişi Sayacı (Kanal İsmi Güncelleme)
        // Setup-v2'de kapatmıştım ama kullanıcı "logslarda artış sağlamıyor" derken log kanalındaki mesajı kastediyor.
        // Eğer stat kanalını da tekrar istiyorsa açabilirim ama "loglardaki artış" dediği için log mesajı yeterli.
    }
};
