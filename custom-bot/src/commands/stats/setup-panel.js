const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags, AttachmentBuilder } = require('discord.js');
const canvasGenerator = require('../../utils/canvasGenerator');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-panel')
        .setDescription('Kullanıcı istatistik ve özelleştirme kontrol panelini kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Create modern banner
        const buffer = await canvasGenerator.createPanelBanner();
        const attachment = new AttachmentBuilder(buffer, { name: 'panel-banner.png' });

        const embed = new EmbedBuilder()
            .setImage('attachment://panel-banner.png')
            .setColor('#fbbf24')
            .setFooter({ text: 'NEXORA • Rekabetçi İstatistik ve Özelleştirme Paneli' });

        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('panel_stats')
                .setLabel('İstatistikler')
                .setEmoji('📊')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('panel_elo')
                .setLabel('ELO Kartı')
                .setEmoji('📈')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('panel_titles')
                .setLabel('Ünvanlar')
                .setEmoji('🏆')
                .setStyle(ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId('panel_customize')
                .setLabel('Kişiselleştir')
                .setEmoji('🎨')
                .setStyle(ButtonStyle.Primary)
        );

        await interaction.reply({ content: '✅ Kontrol paneli oluşturuldu.', flags: [MessageFlags.Ephemeral] });
        await interaction.channel.send({ embeds: [embed], components: [row1], files: [attachment] });
    }
};
