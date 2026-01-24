const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require(path.join(__dirname, '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ban')
        .setDescription('Kullanıcıyı yasakla')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Yasaklanacak kullanıcı')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('sebep')
                .setDescription('Yasaklama sebebi'))
        .addIntegerOption(opt =>
            opt.setName('mesaj-sil')
                .setDescription('Silinecek mesaj günü (0-7)')
                .setMinValue(0)
                .setMaxValue(7)),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';
        const deleteMessageDays = interaction.options.getInteger('mesaj-sil') || 0;

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);

        if (member) {
            if (!member.bannable) {
                return interaction.reply({
                    embeds: [embeds.error('Yetki Hatası', 'Bu kullanıcıyı yasaklayamazsınız.')],
                    ephemeral: true
                });
            }

            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    embeds: [embeds.error('Yetki Hatası', 'Bu kullanıcıyı yasaklayamazsınız.')],
                    ephemeral: true
                });
            }
        }

        try {
            // DM gönder
            try {
                await user.send({
                    embeds: [embeds.error(
                        'Yasaklandınız',
                        `**${interaction.guild.name}** sunucusundan yasaklandınız.\n**Sebep:** ${reason}`
                    )]
                });
            } catch (error) { }

            await interaction.guild.members.ban(user, {
                reason: reason,
                deleteMessageSeconds: deleteMessageDays * 24 * 60 * 60
            });

            await interaction.reply({
                embeds: [embeds.moderation('Ban', user, interaction.user, reason)]
            });

        } catch (error) {
            await interaction.reply({
                embeds: [embeds.error('Hata', `Ban başarısız: ${error.message}`)],
                ephemeral: true
            });
        }
    }
};
