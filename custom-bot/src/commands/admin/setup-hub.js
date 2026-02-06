const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-hub')
        .setDescription('Merkezi Lobi Panelini Yönetir (Otomatik Güncelleme)')
        .addStringOption(option =>
            option.setName('yazi')
                .setDescription('Paneldeki açıklamayı değiştirir (Boş bırakılırsa varsayılan kullanılır)')
        ),
    async execute(interaction) {
        // Sadece Admin
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Yetkiniz yok.', flags: MessageFlags.Ephemeral });
        }

        const categoryId = '1463883244436197397';
        const guild = interaction.guild;
        const customText = interaction.options.getString('yazi');

        // Görseller
        const PANEL_GIF = 'https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=69872fd2&is=6985de52&hm=73ce403ba2061e8071b2affcbc754b71f8e1d63e6a4be6a8e8558ac1f3a2fca6&';
        const BTN_EMOJI = '<a:welcome3:1246429706346303489>';

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        try {
            const category = await guild.channels.fetch(categoryId).catch(() => null);
            if (!category) {
                return interaction.editReply({ content: `❌ Kategori bulunamadı! ID: ${categoryId}` });
            }

            // 1. Kanalları Kontrol Et / Oluştur (Eğer silindiyse tamir et)
            let panelChannel = category.children.cache.find(c => c.name === '🕹️-maç-panel' && c.type === ChannelType.GuildText);

            // Eğer panel kanalı yoksa oluştur
            if (!panelChannel) {
                panelChannel = await guild.channels.create({
                    name: '🕹️-maç-panel',
                    type: ChannelType.GuildText,
                    parent: category.id,
                    permissionOverwrites: [
                        {
                            id: guild.roles.everyone.id,
                            deny: [PermissionFlagsBits.SendMessages],
                            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory]
                        }
                    ]
                });
            }

            // Ses Kanalları ve ID Toplama
            let voiceChatIds = [];
            for (let i = 1; i <= 3; i++) {
                let searchName = `🔊 Lobi ${i} Bekleme`;
                let vc = category.children.cache.find(c => c.name === searchName && c.type === ChannelType.GuildVoice);

                if (!vc) {
                    vc = await guild.channels.create({
                        name: searchName,
                        type: ChannelType.GuildVoice,
                        parent: category.id,
                        userLimit: 10
                    });
                }
                voiceChatIds.push(vc.id);
            }

            // 2. İçeriği Hazırla (Premium Markdown)
            const defaultDescription = [
                '# 🏆 RANKED ARENA',
                '**Rekabetin kalbi burada atıyor!**',
                '',
                'Sıralamada yükselmek, ELO kazanmak ve şampiyonluğunu kanıtlamak için mücadeleye katıl.',
                '',
                '```yaml',
                'Lobiler: 🟢 Aktif',
                'Mod: 5v5 Competitive',
                'Harita: Seçmeli (Veto)',
                'Anti-Cheat: 🛡️ Korumalı',
                '```',
                '',
                '> **Nasıl Oynarım?**',
                '> Aşağıdaki ses kanallarından birine gir ve **Lobi Kur** butonuna bas.',
                '',
                '<a:welcome3:1246429706346303489> **İyi oyunlar!**'
            ].join('\n');

            const embed = new EmbedBuilder()
                .setColor(0x2B2D31)
                .setDescription(customText ? customText : defaultDescription)
                .setImage(PANEL_GIF)
                .setFooter({ text: 'Nexora Competitive System', iconURL: interaction.guild.iconURL() });

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`lobby_start_1_${voiceChatIds[0]}`).setLabel('Lobi 1 Kur').setStyle(ButtonStyle.Success).setEmoji(BTN_EMOJI),
                new ButtonBuilder().setCustomId(`lobby_start_2_${voiceChatIds[1]}`).setLabel('Lobi 2 Kur').setStyle(ButtonStyle.Success).setEmoji(BTN_EMOJI),
                new ButtonBuilder().setCustomId(`lobby_start_3_${voiceChatIds[2]}`).setLabel('Lobi 3 Kur').setStyle(ButtonStyle.Success).setEmoji(BTN_EMOJI)
            );

            // 3. Mesajı Bul ve Güncelle
            const messages = await panelChannel.messages.fetch({ limit: 10 }).catch(() => new Map());
            const existingPanel = messages.find(m => m.author.id === interaction.client.user.id && m.components.length > 0);

            if (existingPanel) {
                // Güncelle
                await existingPanel.edit({ embeds: [embed], components: [row] });
                await interaction.editReply(`✅ **Panel Güncellendi!**\nYazı başarıyla değiştirildi.`);
            } else {
                // Yeni Gönder
                await panelChannel.send({ embeds: [embed], components: [row] });
                await interaction.editReply(`✅ **Panel Oluşturuldu!**\n<#${panelChannel.id}>`);
            }

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Bir hata oluştu: ${error.message}`);
        }
    }
};
