const { SlashCommandBuilder, PermissionFlagsBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-hub')
        .setDescription('Merkezi Lobi Sistemini Kurar (Kategori, Kanallar ve Panel)'),
    async execute(interaction) {
        // Sadece Admin
        if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
            return interaction.reply({ content: 'Yetkiniz yok.', ephemeral: true });
        }

        const categoryId = '1463883244436197397';
        const guild = interaction.guild;
        const category = await guild.channels.fetch(categoryId).catch(() => null);

        if (!category) {
            return interaction.reply({ content: `❌ Kategori bulunamadı! ID: ${categoryId}`, ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            // 1. Maç Paneli (Metin)
            const panelChannel = await guild.channels.create({
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

            // 2. Lobi Ses Kanalları
            const voiceChannels = [];
            for (let i = 1; i <= 3; i++) {
                const searchName = `🔊 Lobi ${i} Bekleme`;
                // Varsa tekrar oluşturma (opsiyonel ama temiz olsun diye direkt oluşturuyoruz)
                const vc = await guild.channels.create({
                    name: searchName,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    userLimit: 10 // Kullanıcı isteği (görselde 99, metinde belirtmemiş ama genelde 10)
                });
                voiceChannels.push({ id: vc.id, name: searchName, index: i });
            }

            // 3. Panel Mesajını Gönder
            const embed = new EmbedBuilder()
                .setColor(0xF1C40F) // Gold
                .setTitle('🏆 RANKED LOBİ PANELİ')
                .setDescription(
                    'Maç oluşturmak için aşağıdaki butonları kullanın.\n\n' +
                    '**Nasıl Çalışır?**\n' +
                    '1. Arkadaşlarınızla boş bir **Lobi Bekleme** kanalına girin.\n' +
                    '2. Bulunduğunuz lobinin butonuna **(Lobi X Kur)** basın.\n' +
                    '3. Bot sizi özel maç odasına taşıyacaktır.\n\n' +
                    '**Aktif Lobiler:**\n' +
                    `1️⃣ <#${voiceChannels[0].id}>\n` +
                    `2️⃣ <#${voiceChannels[1].id}>\n` +
                    `3️⃣ <#${voiceChannels[2].id}>`
                )
                .setFooter({ text: 'Nexora Ranked System • Made by Swaff' })
                .setImage('https://media.discordapp.net/attachments/1213149999035228200/1242549144887754853/line.png?ex=6643aece&is=66425d4e&hm=2e728c70725206987771761765ad818787f06533722513413554694464673678&'); // Örnek çizgi

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`lobby_start_1_${voiceChannels[0].id}`).setLabel('Lobi 1 Kur').setStyle(ButtonStyle.Success).setEmoji('🎮'),
                new ButtonBuilder().setCustomId(`lobby_start_2_${voiceChannels[1].id}`).setLabel('Lobi 2 Kur').setStyle(ButtonStyle.Success).setEmoji('🎮'),
                new ButtonBuilder().setCustomId(`lobby_start_3_${voiceChannels[2].id}`).setLabel('Lobi 3 Kur').setStyle(ButtonStyle.Success).setEmoji('🎮')
            );

            await panelChannel.send({ embeds: [embed], components: [row] });

            // 4. Sonuç Raporu
            let report = `✅ **Kurulum Tamamlandı!**\n\n**Panel Kanalı:** <#${panelChannel.id}>\n\n**Ses Kanalları:**\n`;
            voiceChannels.forEach(vc => report += `- ${vc.name}: \`${vc.id}\`\n`);
            report += `\n⚠️ **ÖNEMLİ:** Bu ID'leri \`src/handlers/match/constants.js\` veya ilgili config dosyasına kaydetmeniz gerekebilir (Otomasyon için butonlara ID'leri gömdüm, ekstra kayda gerek yok).`;

            await interaction.editReply(report);

        } catch (error) {
            console.error(error);
            await interaction.editReply(`❌ Bir hata oluştu: ${error.message}`);
        }
    }
};
