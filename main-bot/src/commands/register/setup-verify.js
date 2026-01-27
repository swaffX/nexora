const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
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
                    .setStyle(ButtonStyle.Success) // Yeşil renk kayıt için daha davetkar
                    .setEmoji('<a:welcome3:1246429706346303489>'),
                new ButtonBuilder()
                    .setLabel('Kurallar')
                    .setStyle(ButtonStyle.Secondary)
                    .setCustomId('rules_modal')
                    .setEmoji('📜'),
                new ButtonBuilder()
                    .setLabel('Destek')
                    .setStyle(ButtonStyle.Danger)
                    .setCustomId('create_ticket')
                    .setEmoji('🎫') // 🆘 yerine daha uygun bir bilet emojisi
            );

        await interaction.channel.send({ embeds: [embeds.verify()], components: [row] });
        await interaction.reply({ content: 'Kayıt mesajı gönderildi.', flags: MessageFlags.Ephemeral });
    }
};
