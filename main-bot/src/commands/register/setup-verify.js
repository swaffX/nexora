const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const path = require('path');
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('Kayıt butonu mesajını gönderir')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_user')
                    .setLabel('Kayıt Ol')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        await interaction.channel.send({ embeds: [embeds.verify()], components: [row] });
        await interaction.reply({ content: 'Kayıt mesajı gönderildi.', ephemeral: true });
    }
};
