const { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } = require('discord.js');
const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('unjail')
        .setDescription('Kullanıcıyı karantinadan çıkarır')
        .addUserOption(option =>
            option.setName('target')
                .setDescription('Çıkarılacak kullanıcı')
                .setRequired(true))
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('target');
        const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);

        if (!member) {
            return interaction.reply({ content: '❌ Kullanıcı bulunamadı.', ephemeral: true });
        }

        const guildSettings = await Guild.findOne({ odaId: interaction.guild.id });
        const jailRoleId = guildSettings?.jailSystem?.roleId;

        if (!jailRoleId) {
            return interaction.reply({ content: '❌ Jail rolü ayarlanmamış.', ephemeral: true });
        }

        if (!member.roles.cache.has(jailRoleId)) {
            return interaction.reply({ content: '❌ Kullanıcı zaten karantinada değil.', ephemeral: true });
        }

        try {
            await member.roles.remove(jailRoleId);

            const embed = new EmbedBuilder()
                .setColor('#00FF00')
                .setDescription(`🔓 <@${targetUser.id}> karantinadan çıkarıldı.`);

            await interaction.reply({ embeds: [embed] });

        } catch (error) {
            console.error(error);
            await interaction.reply({ content: '❌ İşlem sırasında bir hata oluştu.', ephemeral: true });
        }
    }
};
