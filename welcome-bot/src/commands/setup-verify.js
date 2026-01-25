const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-register')
        .setDescription('Kayıt olma panelini kurar. (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x57F287) // Yeşil
            .setTitle('✅ Sunucu Kayıt İşlemi')
            .setDescription('Sunucumuza erişmek için lütfen aşağıdaki butona tıklayarak kaydınızı tamamlayın.\n\nKuralları okuduğunuzu ve kabul ettiğinizi beyan edersiniz.\n\n**Nexora Security**');

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_user')
                    .setLabel('Kayıt Ol')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('✅')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        const { MessageFlags } = require('discord.js');
        await interaction.reply({ content: 'Kayıt paneli kuruldu!', flags: MessageFlags.Ephemeral });
    }
};
