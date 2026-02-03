const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, PermissionsBitField, MessageFlags } = require('discord.js');
const { getLobbyBySetupChannel } = require('../handlers/match/constants');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('setup-match')
        .setDescription('Oda için özel maç panelini kurar (Sadece tanımlı lobi kanallarında çalışır)'),
    async execute(interaction) {
        if (!interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
            return interaction.reply({ content: 'Yetkin yok!', flags: MessageFlags.Ephemeral });
        }

        const currentChannelId = interaction.channelId;
        const lobbyConfig = getLobbyBySetupChannel(currentChannelId);

        if (!lobbyConfig) {
            return interaction.reply({
                content: `❌ Bu komut sadece tanımlı **Lobi Kurulum Kanallarında** çalışır.\n\nTanımlı Kanallar:\n• Lobby 1\n• Lobby 2\n• Lobby 3`,
                flags: MessageFlags.Ephemeral
            });
        }

        const embed = new EmbedBuilder()
            .setColor(0x2F3136) // Dark Theme Background
            .setAuthor({ name: `NEXORA COMPETITIVE • ${lobbyConfig.name}`, iconURL: 'https://cdn.discordapp.com/emojis/1467546027518197915.webp?size=96&quality=lossless' })
            .setDescription(`## <:valo:1468313683469013206> ARENAYA HOŞ GELDİN <a:tacticbear:1467545426009002055>\n\nTakımını topla, stratejini belirle ve mücadeleye başla.\nOdanı kurmak için aşağıdaki butonu kullan.\n\n> <a:jetto:1467545477221318750> **Dikkat:** Odamızı kurmadan önce **<#${lobbyConfig.voiceId}>** ses kanalına giriş yapınız.`)
            .setImage('https://i.pinimg.com/originals/a0/a6/50/a0a6504d603e87483ee76059fc7100e4.gif') // Şık, minimalist bir Valorant Gif'i
            .setFooter({ text: 'Nexora Systems' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId(`match_create_${lobbyConfig.id}`) // Örn: match_create_1
                .setLabel('Maç Oluştur')
                .setEmoji('1467546027518197915')
                .setStyle(ButtonStyle.Secondary)
        );

        // Kanal temizliği yapmıyorum, sadece mesaj atıyorum
        await interaction.channel.send({ embeds: [embed], components: [row] });
        return interaction.reply({ content: `✅ **${lobbyConfig.name}** Paneli başarıyla kuruldu!`, flags: MessageFlags.Ephemeral });
    }
};
