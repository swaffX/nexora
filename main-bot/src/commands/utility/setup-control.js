const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-control')
        .setDescription('Kontrol Merkezi panelini kurar. (Admin)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        const embed = new EmbedBuilder()
            .setColor(0x2B2D31) // Discord Dark
            .setTitle('🛸 NEXORA CONTROL CENTER')
            .setDescription('Hesabınızı yönetmek ve bilgilere hızlıca erişmek için butonları kullanın.')
            .addFields(
                { name: 'Kısayollar', value: '👤 **Profil**: Seviye ve istatistikler\n🎁 **Günlük**: Günlük maaşını al\n🎒 **Envanter**: Eşyalarını gör\n💳 **Cüzdan**: Bakiyeni kontrol et' }
            )
            .setImage('https://media.discordapp.net/attachments/1069725546600210583/1166060424576311356/nexora_banner.png?ex=6549216d&is=6536ac6d&hm=...') // Opsiyonel
            .setFooter({ text: 'Nexora Systems • made by swaff' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder().setCustomId('ctrl_profile').setLabel('Profilim').setStyle(ButtonStyle.Primary).setEmoji('👤'),
                new ButtonBuilder().setCustomId('ctrl_inventory').setLabel('Envanter').setStyle(ButtonStyle.Secondary).setEmoji('🎒'),
                new ButtonBuilder().setCustomId('ctrl_daily').setLabel('Günlük Ödül').setStyle(ButtonStyle.Success).setEmoji('🎁'),
                new ButtonBuilder().setCustomId('ctrl_wallet').setLabel('Cüzdan').setStyle(ButtonStyle.Secondary).setEmoji('💳')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Kontrol Merkezi başarıyla kuruldu!', ephemeral: true });
    }
};
