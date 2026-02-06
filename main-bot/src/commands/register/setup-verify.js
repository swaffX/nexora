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
        // Premium Embed Tasarımı
        const description = [
            '# 👋 ARAMIZA HOŞ GELDİN',
            '**Nexora Platformuna katıldığın için mutluyuz!**',
            '',
            'Burada diğer oyuncularla tanışabilir, rekabetçi maçlara katılabilir ve ödüller kazanabilirsin.',
            '',
            '```yaml',
            'Güvenlik: 🛡️ Aktif',
            'Sunucu: 🟢 Online',
            'Üye Sayısı: ' + interaction.guild.memberCount,
            '```',
            '',
            '> **Nasıl Kayıt Olurum?**',
            '> Aşağıdaki **Kayıt Ol** butonuna basarak sunucuya giriş yapabilirsin.',
            '',
            '*(Kayıt olarak sunucu kurallarını kabul etmiş sayılırsınız)*'
        ].join('\n');

        const embed = new EmbedBuilder()
            .setColor(0x2B2D31) // Discord Dark Theme Background
            .setDescription(description)
            .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=69872fd2&is=6985de52&hm=73ce403ba2061e8071b2affcbc754b71f8e1d63e6a4be6a8e8558ac1f3a2fca6&')
            .setFooter({ text: 'Nexora Security System', iconURL: interaction.guild.iconURL() });

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('verify_user')
                    .setLabel('Kayıt Ol')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('<a:welcome3:1246429706346303489>'),
                new ButtonBuilder()
                    .setLabel('Destek')
                    .setStyle(ButtonStyle.Link)
                    .setURL(`https://discord.com/channels/${interaction.guild.id}/1465728112825204880`)
                    .setEmoji('🎫')
            );

        await interaction.channel.send({ embeds: [embed], components: [row] });
        await interaction.reply({ content: '✅ Sade kayıt mesajı (GIF ve Destek butonu ile) başarıyla gönderildi.', flags: MessageFlags.Ephemeral });
    }
};
