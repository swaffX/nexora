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

        // Yeni panel görseli oluştur
        const canvasGenerator = require('../utils/canvasGenerator');
        const buffer = await canvasGenerator.createMatchPanelImage();
        const fileName = 'match-panel.png';
        const attachment = new AttachmentBuilder(buffer, { name: fileName });

        // Sadece görsel, yazı yok
        const embed = new EmbedBuilder()
            .setColor(0x2F3136)
            .setImage(`attachment://${fileName}`);

        // Tüm butonlar tek satırda
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`match_create_main`)
                .setLabel('Maç Oluştur')
                .setEmoji('1467546027518197915')
                .setStyle(ButtonStyle.Success),
            new ButtonBuilder()
                .setCustomId(`lobby_toggle_2`)
                .setLabel(ADDITIONAL_LOBBIES[2].enabled ? 'Lobby 2 Kapat' : 'Lobby 2 Aç')
                .setEmoji(ADDITIONAL_LOBBIES[2].enabled ? '🟢' : '🔴')
                .setStyle(ADDITIONAL_LOBBIES[2].enabled ? ButtonStyle.Danger : ButtonStyle.Secondary),
            new ButtonBuilder()
                .setCustomId(`lobby_toggle_3`)
                .setLabel(ADDITIONAL_LOBBIES[3].enabled ? 'Lobby 3 Kapat' : 'Lobby 3 Aç')
                .setEmoji(ADDITIONAL_LOBBIES[3].enabled ? '🟢' : '🔴')
                .setStyle(ADDITIONAL_LOBBIES[3].enabled ? ButtonStyle.Danger : ButtonStyle.Secondary)
        );

        await interaction.channel.send({ embeds: [embed], components: [row], files: [attachment] });
        return interaction.reply({ content: `✅ **Ana Lobi** Paneli başarıyla kuruldu!`, flags: MessageFlags.Ephemeral });
    }
};
