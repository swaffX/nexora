const path = require('path');
const { Guild, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const { EmbedBuilder } = require('discord.js');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: 'guildMemberRemove',
    async execute(member, client) {
        const guildSettings = await Guild.findOrCreate(member.guild.id, member.guild.name);

        // 1. Goodbye embedi (Eğer enabled ise)
        // Kullanıcı setup-v2'de goodbye'ı kapattırdı ama SS attı "goodbye kanalı ayarla" dedi (Step 794).
        // Demek ki goodbye tekrar aktif olacak.
        // Hangi kanala atılacak? Log/Goodbye kanalı yoksa Register kanalına mı? Veya log kanalına mı?
        // SS'te ayrı bir mesaj var. 
        // setup-final.js scriptinde GOODBYE kanalını ayarlayacağım.

        if (guildSettings.goodbye.enabled && guildSettings.goodbye.channelId) {
            const goodbyeChannel = member.guild.channels.cache.get(guildSettings.goodbye.channelId);
            if (goodbyeChannel) {
                // embeds.js'deki goodbye fonksiyonunu kullan
                await goodbyeChannel.send({
                    embeds: [embeds.goodbye(member, guildSettings.goodbye.message)]
                });
            }
        }

        // 2. Member Log (Çıkış Logu) -> member-logs
        if (guildSettings.logs && guildSettings.logs.member) {
            const logChannel = member.guild.channels.cache.get(guildSettings.logs.member);
            if (logChannel) {
                try {
                    const embed = new EmbedBuilder()
                        .setColor(0xED4245) // Red
                        .setAuthor({ name: 'Üye Ayrıldı', iconURL: member.user.displayAvatarURL() })
                        .setDescription(`<@${member.id}> sunucudan ayrıldı.`)
                        .addFields(
                            { name: 'Kullanıcı', value: `${member.user.tag}`, inline: true },
                            { name: 'Kalan Üye', value: `${member.guild.memberCount}`, inline: true }
                        )
                        .setTimestamp()
                        .setFooter({ text: `ID: ${member.id}` });

                    await logChannel.send({ embeds: [embed] });
                } catch (error) {
                    logger.error('Member log (leave) hatası:', error);
                }
            }
        }
    }
};
