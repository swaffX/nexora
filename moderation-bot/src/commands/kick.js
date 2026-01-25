const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kullanıcıyı sunucudan at')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Atılacak kullanıcı')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('sebep')
                .setDescription('Atma sebebi')),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep') || 'Belirtilmedi';

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (member) {
            const { MessageFlags } = require('discord.js');
            if (!member.kickable) {
                return interaction.reply({
                    embeds: [embeds.error('Yetki Hatası', 'Bu kullanıcıyı atamazsınız.')],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    embeds: [embeds.error('Yetki Hatası', 'Bu kullanıcıyı atamazsınız.')],
                    flags: MessageFlags.Ephemeral
                });
            }
        } else {
            const { MessageFlags } = require('discord.js');
            return interaction.reply({
                embeds: [embeds.error('Hata', 'Kullanıcı bulunamadı.')],
                flags: MessageFlags.Ephemeral
            });
        }

        try {
            try {
                await user.send({
                    embeds: [embeds.error(
                        'Sunucudan Atıldınız',
                        `**${interaction.guild.name}** sunucusundan atıldınız.\n**Sebep:** ${reason}`
                    )]
                });
            } catch (error) { }

            await member.kick(reason);

            await interaction.reply({
                embeds: [embeds.moderation('Kick', user, interaction.user, reason)]
            });

        } catch (error) {
            const { MessageFlags } = require('discord.js');
            await interaction.reply({
                embeds: [embeds.error('Hata', `Kick başarısız: ${error.message}`)],
                flags: MessageFlags.Ephemeral
            });
        }
    }
};
