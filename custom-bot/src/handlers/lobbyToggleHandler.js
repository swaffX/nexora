const { ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { ADDITIONAL_LOBBIES, MAIN_LOBBY } = require('./match/constants');
const path = require('path');

module.exports = {
    async handleToggle(interaction) {
        // Yetki kontrolü
        const REQUIRED_ROLE_ID = '1463875325019557920';
        if (!interaction.member.permissions.has('Administrator') && !interaction.member.roles.cache.has(REQUIRED_ROLE_ID)) {
            return interaction.reply({ content: '❌ Bu işlemi sadece yetkililer yapabilir!', ephemeral: true });
        }

        const lobbyId = parseInt(interaction.customId.split('_')[2]); // 2 veya 3
        const lobby = ADDITIONAL_LOBBIES[lobbyId];

        if (!lobby) {
            return interaction.reply({ content: '❌ Geçersiz lobi!', ephemeral: true });
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            if (!lobby.enabled) {
                // LOBİYİ AÇ
                const category = await interaction.guild.channels.create({
                    name: `🎮 ${lobby.name.toUpperCase()}`,
                    type: ChannelType.GuildCategory,
                    position: 1
                });

                const panelChannel = await interaction.guild.channels.create({
                    name: `🕹️-maç-panel-${lobbyId}`,
                    type: ChannelType.GuildText,
                    parent: category.id
                });

                const voiceChannel = await interaction.guild.channels.create({
                    name: `🎮 Lobi ${lobbyId} Bekleme`,
                    type: ChannelType.GuildVoice,
                    parent: category.id,
                    userLimit: 99
                });

                // Config güncelle
                lobby.categoryId = category.id;
                lobby.setupChannelId = panelChannel.id;
                lobby.voiceId = voiceChannel.id;
                lobby.enabled = true;

                // Panel mesajını gönder (Canvas ile)
                const canvasGenerator = require('../utils/canvasGenerator');
                const canvasData = {
                    matchNumber: 0,
                    lobbyName: lobby.name.toUpperCase(),
                    captainA: null,
                    captainB: null
                };

                const buffer = await canvasGenerator.createLobbySetupImage(canvasData);
                const fileName = `lobby-${lobbyId}-panel.png`;
                const attachment = new AttachmentBuilder(buffer, { name: fileName });

                const embed = new EmbedBuilder()
                    .setColor(0x2F3136)
                    .setDescription(`## <:valo:1468313683469013206> ${lobby.name.toUpperCase()} ARENAYA HOŞ GELDİN <a:tacticbear:1467545426009002055>\n\nTakımını topla, stratejini belirle ve mücadeleye başla.\nOdanı kurmak için aşağıdaki butonu kullan.\n\n> <a:jetto:1467545477221318750> **Dikkat:** Odamızı kurmadan önce **<#${voiceChannel.id}>** ses kanalına giriş yapınız.`)
                    .setImage(`attachment://${fileName}`)
                    .setFooter({ text: 'Nexora Competitive Systems' });

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId(`match_create_${lobbyId}`)
                        .setLabel('Maç Oluştur')
                        .setEmoji('1467546027518197915')
                        .setStyle(ButtonStyle.Success)
                );

                await panelChannel.send({ embeds: [embed], components: [row], files: [attachment] });

                // Ana paneli güncelle
                await this.updateMainPanel(interaction.guild);

                await interaction.editReply({
                    content: `✅ **${lobby.name}** başarıyla açıldı!\n\n📁 Kategori: <#${category.id}>\n📋 Panel: <#${panelChannel.id}>\n🔊 Bekleme: <#${voiceChannel.id}>`
                });

            } else {
                // LOBİYİ KAPAT
                const category = interaction.guild.channels.cache.get(lobby.categoryId);
                if (category) {
                    const channels = category.children.cache;
                    for (const [id, channel] of channels) {
                        await channel.delete().catch(() => {});
                    }
                    await category.delete().catch(() => {});
                }

                // Config sıfırla
                lobby.categoryId = null;
                lobby.setupChannelId = null;
                lobby.voiceId = null;
                lobby.enabled = false;

                // Ana paneli güncelle
                await this.updateMainPanel(interaction.guild);

                await interaction.editReply({ content: `✅ **${lobby.name}** kapatıldı ve kanallar silindi.` });
            }

        } catch (error) {
            console.error('Lobby Toggle Error:', error);
            await interaction.editReply({ content: '❌ İşlem sırasında hata oluştu!' });
        }
    },

    async updateMainPanel(guild) {
        // Ana lobi panelindeki butonları güncelle
        const mainChannel = guild.channels.cache.get(MAIN_LOBBY.setupChannelId);
        if (!mainChannel) return;

        // Son mesajı bul (panel mesajı)
        const messages = await mainChannel.messages.fetch({ limit: 10 });
        const panelMessage = messages.find(m => 
            m.author.id === guild.members.me.id && 
            m.embeds.length > 0 &&
            m.components.length > 0
        );

        if (!panelMessage) return;

        // Butonları güncelle
        const row2 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`lobby_toggle_2`)
                .setLabel(ADDITIONAL_LOBBIES[2].enabled ? '🟢 Lobby 2 Kapat' : '🔴 Lobby 2 Aç')
                .setStyle(ADDITIONAL_LOBBIES[2].enabled ? ButtonStyle.Danger : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`lobby_toggle_3`)
                .setLabel(ADDITIONAL_LOBBIES[3].enabled ? '🟢 Lobby 3 Kapat' : '🔴 Lobby 3 Aç')
                .setStyle(ADDITIONAL_LOBBIES[3].enabled ? ButtonStyle.Danger : ButtonStyle.Secondary)
        );

        // İlk row'u koru (Maç Oluştur butonu)
        const row1 = panelMessage.components[0];

        await panelMessage.edit({ components: [row1, row2] }).catch(() => {});
    }
};
