const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { embeds } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'embeds'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-verify')
        .setDescription('Kayıt butonu mesajını gönderir')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        // Basit Embed
        const embed = new EmbedBuilder()
            .setColor(0x57F287) // Canlı Yeşil
            .setTitle('👋 Sunucuya Hoş Geldin!')
            .setDescription('Sohbet kanallarına erişmek ve topluluğumuza katılmak için aşağıdaki **Kayıt Ol** butonuna tıklamanız yeterlidir.\n\nİyi eğlenceler! 🚀')
            .setFooter({ text: 'Nexora Security' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_user')
                    .setLabel('Kayıt Ol')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Sade kayıt mesajı başarıyla gönderildi.', flags: MessageFlags.Ephemeral });
    }
};
