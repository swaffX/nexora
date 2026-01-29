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
        const TARGET_MESSAGE_ID = '1464557643841405055';

        const embed = new EmbedBuilder()
            .setColor(0xFF4655) // Valorant Red
            .setTitle('⚔️ NEXORA 5v5 SCRIM ARENA')
            .setDescription(`
**Hey Ajan!** 🌪️
Rekabet dolu bir maça hazır mısın? Aşağıdaki butonu kullanarak lobini kur ve savaş meydanına in!

**🚀 Maç Akışı Nasıl İşler?**

> **1️⃣ Lobi Kurulumu**
> **"🎮 Maç Oluştur"** butonuna tıkla ve özel maç odanı aç.
> *(Not: <#1463922466467483801> kanalında olman şart!)*
> 
> **2️⃣ Takım Kaptanları**
> **Team A** ve **Team B** kaptanlarını ses kanalındaki oyunculardan seç veya **🎲 Rastgele** dağıt.
> 
> **3️⃣ Oyuncu Seçimi (Draft)**
> Kaptanlar sırasıyla lobideki oyuncuları takımlarına seçer.
> 
> **4️⃣ Harita & Taraf**
> Takımlar oylama ile haritayı seçer, yazı tura galibi ise tarafını (Attack/Defend) belirler.
> 
> **5️⃣ Maç Sonu**
> Maç bittiğinde kazananı belirle ve skoru gir. İstatistikler anında işlenir!

**🛑 Kontrol Sende:** Kurulumun herhangi bir aşamasında maçı iptal edebilirsin.

🔒 **Gereksinimler:**
• Ses Kanalı: <#1463922466467483801>
• Yetkili Rolü: <@&1463875325019557920>
            `)
            .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=6974bad2&is=69736952&hm=16b14c0c7fa6d91ad8528683d2876891b5833d4d516ef5891cd91bc4b8c9804d&')
            .setFooter({ text: 'Nexora Competitive System • v2.0' })
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
                const { MessageFlags } = require('discord.js');
                return interaction.reply({ content: '✅ Maç Paneli başarıyla güncellendi!', flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            // Mesaj bulunamazsa yeni at
            await channel.send({ embeds: [embed], components: [row] });
            const { MessageFlags } = require('discord.js');
            return interaction.reply({ content: '⚠️ Sabit mesaj bulunamadı, yeni bir panel oluşturuldu. (Lütfen ID\'yi güncelle)', flags: MessageFlags.Ephemeral });
        }
    }
};
