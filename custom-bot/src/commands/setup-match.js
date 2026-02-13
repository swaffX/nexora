const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageFlags, AttachmentBuilder } = require('discord.js');
const { MAIN_LOBBY, ADDITIONAL_LOBBIES } = require('../handlers/match/constants');
const path = require('path');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-match')
        .setDescription('Ana lobi için maç panelini kurar'),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'Yetkin yok!', flags: MessageFlags.Ephemeral });
        }

        const currentChannelId = interaction.channelId;
        
        // Sadece ana lobi panelinde çalışır
        if (currentChannelId !== MAIN_LOBBY.setupChannelId) {
            return interaction.reply({
                content: `❌ Bu komut sadece **Ana Lobi Panel Kanalında** (<#${MAIN_LOBBY.setupChannelId}>) çalışır.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const lobbyConfig = MAIN_LOBBY;

        // Canvas görseli oluştur
        const canvasGenerator = require('../utils/canvasGenerator');
        const canvasData = {
            matchNumber: 0,
            lobbyName: 'ANA LOBİ',
            captainA: null,
            captainB: null
        };

        const buffer = await canvasGenerator.createLobbySetupImage(canvasData);
        const fileName = 'lobby-panel.png';
        const attachment = new AttachmentBuilder(buffer, { name: fileName });

        const embed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setDescription(`## <:valo:1468313683469013206> ARENAYA HOŞ GELDİN <a:tacticbear:1467545426009002055>\n\nTakımını topla, stratejini belirle ve mücadeleye başla.\nOdanı kurmak için aşağıdaki butonu kullan.\n\n> <a:jetto:1467545477221318750> **Dikkat:** Odamızı kurmadan önce **<#${lobbyConfig.voiceId}>** ses kanalına giriş yapınız.`)
            .setImage(`attachment://${fileName}`)
            .setFooter({ text: 'Nexora Competitive Systems' });

        // Butonlar: Maç Oluştur + Ek Lobiler
        const row1 = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`match_create_main`)
                .setLabel('Maç Oluştur')
                .setEmoji('1467546027518197915')
                .setStyle(ButtonStyle.Success)
        );

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

        await interaction.channel.send({ embeds: [embed], components: [row1, row2], files: [attachment] });
        return interaction.reply({ content: `✅ **Ana Lobi** Paneli başarıyla kuruldu!`, flags: MessageFlags.Ephemeral });
    }
};
