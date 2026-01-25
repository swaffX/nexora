const { EmbedBuilder } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const moment = require('moment');
moment.locale('tr');

module.exports = {
    async handleVerify(interaction, client) {
        const { MessageFlags } = require('discord.js');
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const member = interaction.member;
        const roleId = '1339943438463762512'; // ÜYE ROLÜ ID (Değiştirmeyi unutma!)
        const unregisterRoleId = '1464177726792347679'; // KAYITSIZ ROL ID (Varsa)

        // Zaten kayıtlı mı?
        if (member.roles.cache.has(roleId)) {
            return interaction.editReply({ content: '✅ Zaten kayıtlısınız!' });
        }

        try {
            // Rol ver
            const role = interaction.guild.roles.cache.get(roleId);
            if (role) await member.roles.add(role);

            // Kayıtsız rolünü al (varsa)
            const unregRole = interaction.guild.roles.cache.get(unregisterRoleId);
            if (unregRole && member.roles.cache.has(unregRole.id)) await member.roles.remove(unregRole);

            // Veritabanına kaydet
            await User.findOrCreate(member.id, interaction.guild.id, member.user.username);

            // Hoş Geldin Mesajı (Genel Sohbete) - GÖRSEL 3 TİPİ
            const generalChannel = interaction.guild.channels.cache.get('1069725547640393840'); // #genel-sohbet ID'si

            if (generalChannel) {
                const accountAge = moment(member.user.createdTimestamp).fromNow();
                const memberCount = interaction.guild.memberCount;

                const embed = new EmbedBuilder()
                    .setColor(0x57F287)
                    .setAuthor({ name: 'Nexora Sunucusuna Hoş Geldin!', iconURL: interaction.guild.iconURL() })
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

                await generalChannel.send({ content: `<@${member.id}> aramıza katıldı! 🎉 Herkes selam versin!`, embeds: [embed] });
            }

            await interaction.editReply({ content: '✅ Kayıt işleminiz başarıyla tamamlandı! İyi eğlenceler.' });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: '❌ Kayıt sırasında bir hata oluştu.' });
        }
    }
};
