const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    async handleButton(interaction, args, client) {
        // Zaten kayıtlı mı kontrolü
        const guildSettings = await Guild.findOrCreate(interaction.guild.id);
        const member = interaction.member;

        if (!guildSettings.register.enabled) {
            return interaction.reply({ content: 'Kayıt sistemi şu an kapalı.', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        const registeredRole = guildSettings.register.registeredRoleId;
        const unregisteredRole = guildSettings.register.unregisteredRoleId;

        try {
            let changed = false;

            // Rol Ekleme
            if (registeredRole && !member.roles.cache.has(registeredRole)) {
                await member.roles.add(registeredRole);
                changed = true;
            }

            // Rol Çıkarma (Varsa)
            if (unregisteredRole && member.roles.cache.has(unregisteredRole)) {
                await member.roles.remove(unregisteredRole);
                changed = true;
            }

            if (!changed) {
                return interaction.editReply({ content: '✅ Zaten kayıtlısınız!' });
            }

            await interaction.editReply({ content: '✅ Kaydınız başarıyla tamamlandı! İyi eğlenceler.' });

            // Sohbet Kanalına Hoşgeldin Embedi
            // Kullanıcının belirttiği ID (Fallback olarak)
            const targetChannelId = guildSettings.register.chatChannelId || '1463875477377912853';

            if (targetChannelId) {
                try {
                    let chatChannel = interaction.guild.channels.cache.get(targetChannelId);
                    if (!chatChannel) {
                        chatChannel = await interaction.guild.channels.fetch(targetChannelId).catch(() => null);
                    }

                    if (chatChannel) {
                        const memberCount = interaction.guild.memberCount;
                        await chatChannel.send({
                            content: `<@${member.id}> aramıza katıldı! 🎉 Herkes selam versin!`,
                            embeds: [embeds.welcome(member, "", memberCount)]
                        });
                    } else {
                        console.error(`Sohbet kanalı bulunamadı: ${targetChannelId}`);
                    }
                } catch (msgError) {
                    console.error('Sohbet mesajı gönderme hatası:', msgError);
                }
            }

        } catch (error) {
            console.error('Verify Hatası:', error);
            await interaction.editReply({ content: '❌ İşlem sırasında bir hata oluştu (Yetki yetersiz olabilir).' });
        }
    }
};
