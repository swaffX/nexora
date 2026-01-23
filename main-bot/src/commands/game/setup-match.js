const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-match')
        .setDescription('5v5 Maç Oluşturma Panelini Kurar/Günceller (Admin)'),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'Yetkin yok!', ephemeral: true });
        }

        const TARGET_CHANNEL_ID = '1464222855398166612';
        const TARGET_MESSAGE_ID = '1464222898846957598';

        const embed = new EmbedBuilder()
            .setColor(0xFF4655) // Valorant Red
            .setTitle('⚔️ VALORANT 5v5 SCRIM')
            .setDescription(`
**Hoşgeldiniz Ajanlar!** 
Aşağıdaki butonu kullanarak lobideki oyuncularla hızlıca **Takım A** ve **Takım B** oluşturup maça başlayabilirsiniz.

**📍 Nasıl Çalışır?**
Sistem ses kanalındaki oyuncuları otomatik algılar ve seçim yapmanızı sağlar.

> **1️⃣ Maçı Başlat**
> "Maç Oluştur" butonuna tıklayarak draft ekranını açın.
>
> **2️⃣ Kaptanları Belirle**
> İki takım kaptanını seçin veya **Rastgele** atayın.
> 
> **3️⃣ Takımını Kur**
> Kaptanlar sırayla ses kanalındaki oyuncuları seçer (Draft).
>
> **4️⃣ Harita Yasakla & Başla**
> Haritaları eleyin, tarafınızı seçin ve savaş başlasın!

⚠️ *Maç oluşturmak için <#1463922466467483801> kanalında olmalısınız.*
            `)
            .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=6974bad2&is=69736952&hm=16b14c0c7fa6d91ad8528683d2876891b5833d4d516ef5891cd91bc4b8c9804d&')
            .setFooter({ text: 'Nexora Competitive • Powered by Swaff' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('match_create')
                .setLabel('🎮 Maç Oluştur')
                .setStyle(ButtonStyle.Success)
        );

        // Hedef kanalı ve mesajı bulmaya çalış
        const channel = interaction.guild.channels.cache.get(TARGET_CHANNEL_ID);
        if (!channel) return interaction.reply({ content: '❌ Hedef kanal bulunamadı!', ephemeral: true });

        try {
            const msg = await channel.messages.fetch(TARGET_MESSAGE_ID);
            if (msg) {
                await msg.edit({ embeds: [embed], components: [row] });
                return interaction.reply({ content: '✅ Maç Paneli başarıyla güncellendi!', ephemeral: true });
            }
        } catch (error) {
            // Mesaj bulunamazsa yeni at
            await channel.send({ embeds: [embed], components: [row] });
            return interaction.reply({ content: '⚠️ Sabit mesaj bulunamadı, yeni bir tane oluşturuldu. (Lütfen ID\'yi güncelle)', ephemeral: true });
        }
    }
};
