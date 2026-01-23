const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionFlagsBits } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-ticket')
        .setDescription('Ticket sistemini kurar.')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction) {
        // Embed Setup
        const embed = new EmbedBuilder()
            .setTitle('NEXORA Destek Sistemi')
            .setDescription('Aşağıdaki butonları kullanarak ilgili kategoride destek talebi oluşturabilirsiniz.\n\n' +
                '🎫 **Destek Talebi:** Genel sorular ve yardım istekleri.\n' +
                '🚨 **Şikayet / Bildiri:** Kural ihlali veya sistem hatası bildirimi.\n' +
                '📝 **Yetkili Başvurusu:** Ekibimize katılmak için başvuru.')
            .setColor('#5865F2')
            .setImage('https://media.discordapp.net/attachments/121212121212/banner.gif') // Placeholder or user provided
            .setFooter({ text: 'NEXORA Support System' });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('ticket_create_support')
                    .setLabel('Destek Talebi')
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('🎫'),
                new ButtonBuilder()
                    .setCustomId('ticket_create_report')
                    .setLabel('Şikayet / Bildiri')
                    .setStyle(ButtonStyle.Danger)
                    .setEmoji('🚨'),
                new ButtonBuilder()
                    .setCustomId('ticket_create_application')
                    .setLabel('Yetkili Başvurusu')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('📝')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: 'Ticket paneli oluşturuldu.', ephemeral: true });
    }
};
