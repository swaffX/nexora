const path = require('path');
const { MessageFlags } = require('discord.js');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    async handleButton(interaction, args, client) {
        // Zaten kayıtlı mı kontrolü
        const guildSettings = await Guild.findOrCreate(interaction.guild.id);
        const member = interaction.member;

        if (!guildSettings.register.enabled) {
            return interaction.reply({ content: 'Kayıt sistemi şu an kapalı.', flags: MessageFlags.Ephemeral });
        }

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

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

        } catch (error) {
            console.error('Verify Hatası:', error);
            await interaction.editReply({ content: '❌ İşlem sırasında bir hata oluştu (Yetki yetersiz olabilir).' });
        }
    }
};
