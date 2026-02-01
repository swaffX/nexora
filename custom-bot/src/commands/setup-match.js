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
            .setTitle('🏆 NEXORA E-SPORTS ARENA')
            .setDescription(`**🔥 REKABET SENİ ÇAĞIRIYOR!**\n\nGerçek bir ajan gibi savaşmaya hazır mısın?\nKendi lobini kur, stratejini belirle ve zafere ulaş.\n\n🔻 **Sistem Nasıl Çalışır?**\n• **Lobi Kur:** Takım arkadaşlarını topla.\n• **Draft Yap:** En iyi kadroyu kur.\n• **Savaş:** Haritanı seç ve maça başla!\n\n<a:jetto:1467545477221318750> _Lobi oluşturmak için **<#1463922466467483801>** kanalında olmalısın._`)
            .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=6974bad2&is=69736952&hm=16b14c0c7fa6d91ad8528683d2876891b5833d4d516ef5891cd91bc4b8c9804d&')
            .setFooter({ text: 'Nexora Competitive Systems' })
            .setTimestamp();

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('match_create')
                .setLabel('Maç Oluştur')
                .setEmoji('1467546027518197915')
                .setStyle(ButtonStyle.Secondary)
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
