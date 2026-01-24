const { EmbedBuilder } = require('discord.js');
const moment = require('moment');
moment.locale('tr');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        // Kayıtsız Rolünü Ver (ID'yi değiştirin!)
        const unregRoleId = '1464177726792347679';
        const role = member.guild.roles.cache.get(unregRoleId);
        if (role) await member.roles.add(role).catch(err => logger.error('Rol verme hatası:', err));

        // Hoş Geldin Kanalına Mesaj At (ID'yi değiştirin!)
        const channel = member.guild.channels.cache.get('1464177606684315730');
        if (!channel) return;

        const accountAge = moment(member.user.createdTimestamp).fromNow();
        const memberCount = member.guild.memberCount;

        const embed = new EmbedBuilder()
            .setColor(0x57F287)
            .setAuthor({ name: 'Nexora Sunucusuna Hoş Geldin!', iconURL: member.guild.iconURL() })
            .setTitle(`👋 Hey ${member.user.username}!`)
            .setDescription('Topluluğumuza katıldığın için teşekkürler.\nKuralları okumayı ve keyfine bakmayı unutma!')
            .addFields(
                { name: '👤 Üye', value: `<@${member.id}>`, inline: true },
                { name: '🎂 Hesap Tarihi', value: `${accountAge}`, inline: true },
                { name: '📊 Üye Sayısı', value: `#${memberCount}`, inline: true }
            )
            .setThumbnail(member.user.displayAvatarURL({ dynamic: true, size: 256 }))
            .setFooter({ text: `Üye #${memberCount} • Sunucuya katıldı`, iconURL: member.user.displayAvatarURL() })
            .setTimestamp();

        await channel.send({ content: `<@${member.id}>`, embeds: [embed] });
    },
};
