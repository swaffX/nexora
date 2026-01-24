const path = require('path');
const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const { Warning } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Kullanıcıya uyarı ver')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Uyarılacak kullanıcı')
                .setRequired(true))
        .addStringOption(opt =>
            opt.setName('sebep')
                .setDescription('Uyarı sebebi')
                .setRequired(true)),

    async execute(interaction) {
        const user = interaction.options.getUser('kullanıcı');
        const reason = interaction.options.getString('sebep');

        const member = await interaction.guild.members.fetch(user.id).catch(() => null);
        if (member) {
            if (member.roles.highest.position >= interaction.member.roles.highest.position) {
                return interaction.reply({
                    embeds: [embeds.error('Yetki Hatası', 'Bu kullanıcıyı uyaramazsınız.')],
                    ephemeral: true
                });
            }
        }

        await Warning.create({
            odasi: user.id,
            odaId: interaction.guild.id,
            moderatorId: interaction.user.id,
            reason: reason
        });

        const warnCount = await Warning.countDocuments({
            odasi: user.id,
            odaId: interaction.guild.id
        });

        await interaction.reply({
            embeds: [embeds.moderation('Uyarı', user, interaction.user, reason)]
        });

        try {
            await user.send({
                embeds: [embeds.warning(
                    'Uyarı Aldınız',
                    `**${interaction.guild.name}** sunucusunda uyarı aldınız.\n**Sebep:** ${reason}\n**Toplam Uyarı:** ${warnCount}`
                )]
            });
        } catch (error) { }
    }
};
