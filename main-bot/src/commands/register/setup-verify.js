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
            .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=6985de52&is=69848cd2&hm=bd64540f2cfe9e4d57bfc4c1260e3900cf9ecda72811872f010d236b8e2a16d3&')
            .setFooter({ text: 'Nexora Security' });

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
