const { SlashCommandBuilder, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-match')
        .setDescription('5v5 Maç Lobi Sistemini Kurar')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
        try {
            // Önce botun yanıt verme süresini uzat
            await interaction.deferReply({ ephemeral: true });

            const embed = new EmbedBuilder()
                .setColor(0x5865F2) // Blurple (Discord Brand Color)
                .setTitle('⚔️ 5v5 Scrim & Match System')
                .setDescription('Aşağıdaki paneli kullanarak lobideki oyuncularla hızlıca **Takım A** ve **Takım B** oluşturun.')
                .setThumbnail(interaction.guild.iconURL({ dynamic: true, size: 512 }))
                .addFields(
                    { name: 'Nasıl Çalışır?', value: 'Sistem ses kanalındaki oyuncuları otomatik algılar ve seçim yapmanızı sağlar.', inline: false },
                    { name: '1️⃣ Maçı Başlat', value: '**Maç Oluştur** butonuna tıklayın.', inline: true },
                    { name: '2️⃣ Takımları Seç', value: 'Menüden **Takım A** ve **Takım B** oyuncularını belirleyin.', inline: true },
                    { name: '3️⃣ Otomatik Kurulum', value: 'Sistem odaları açar, oyuncuları taşır ve maçı başlatır.', inline: true }
                )
                .setFooter({ text: 'Nexora Competitive • Powered by Swaff', iconURL: interaction.client.user.displayAvatarURL() })
                .setTimestamp();

            const row = new ActionRowBuilder()
                .addComponents(
                    new ButtonBuilder()
                        .setCustomId('match_create')
                        .setLabel('Maç Oluştur')
                        .setStyle(ButtonStyle.Success) // Green button for "Start" action
                        .setEmoji('🎮')
                );

            await interaction.channel.send({ embeds: [embed], components: [row] });
            await interaction.editReply({ content: '✅ Maç paneli başarıyla kuruldu.' });

        } catch (error) {
            console.error('Setup-Match Hatası:', error);
            await interaction.editReply({ content: '❌ Paneli oluştururken bir hata meydana geldi (Botun mesaj gönderme yetkisi olduğundan emin olun).' });
        }
    }
};
