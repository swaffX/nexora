const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits, MessageFlags } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-panel')
        .setDescription('Kullanıcı istatistik ve özelleştirme kontrol panelini kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setTitle('🚀 NEXORA REKABETÇİ PANEL')
            .setDescription('Aşağıdaki butonları kullanarak istatistiklerinize bakabilir, ünvanlarınızı yönetebilir veya profil kartınızı kişiselleştirebilirsiniz.\n\n' +
                '📊 **İstatistikler:** Detaylı maç geçmişi ve favoriler.\n' +
                '📈 **ELO Kartı:** Mevcut rank ve ilerleme durumunuz.\n' +
                '🏆 **Ünvanlar:** Kazandığınız ünvanları inceleyin.\n' +
                '🎨 **Kişiselleştir:** Kart arkaplanını ve ünvanını değiştir.')
            .setImage('https://wallpapercave.com/wp/wp6664273.jpg') // Aesthetic Valorant banner
            .setColor('#fbbf24')
            .setFooter({ text: 'Tüm işlemler size özel (ephemeral) olarak açılır.' });

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
        await interaction.channel.send({ embeds: [embed], components: [row1] });
    }
};
