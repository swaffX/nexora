const { SlashCommandBuilder, EmbedBuilder, PermissionsBitField, MessageFlags } = require('discord.js');
const { LOBBY_CONFIG, BLOCKED_ROLE_ID } = require('../../handlers/match/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('custom-rooms')
        .setDescription('Aktif Lobi ve Oda Konfigürasyonlarını Gösterir (Admin)'),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'Yetkin yok!', flags: MessageFlags.Ephemeral });
        }

        const embed = new EmbedBuilder()
            .setColor(0x00FF00)
            .setTitle('⚙️ Custom Rooms Configuration')
            .setDescription('Mevcut Lobi ve Oda ayarlarının dökümü aşağıdadır.')
            .addFields(
                { name: '🚫 Yasaklı Rol (Görüntüleme Engeli)', value: `<@&${BLOCKED_ROLE_ID}> (${BLOCKED_ROLE_ID})`, inline: false }
            );

        Object.values(LOBBY_CONFIG).forEach(lobby => {
            embed.addFields({
                name: `📁 ${lobby.name} (ID: ${lobby.id})`,
                value: `**Voice ID:** <#${lobby.voiceId}> (${lobby.voiceId})\n**Category ID:** <#${lobby.categoryId}> (${lobby.categoryId})\n**Setup Channel:** <#${lobby.setupChannelId}> (${lobby.setupChannelId})`,
                inline: false
            });
        });

        embed.setFooter({ text: 'Nexora System Check' }).setTimestamp();
        await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
    }
};
