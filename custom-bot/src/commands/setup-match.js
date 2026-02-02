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
            .setColor(0xFF4655) // Valorant Red
            .setTitle(`🏆 NEXORA E-SPORTS ARENA (${lobbyConfig.name})`)
            .setDescription(`**HEY AJAN!** <a:tacticbear:1467545426009002055>\n\n**${lobbyConfig.name}** için özel sahadasın.\nKendi lobini kur, takımını topla ve rekabete başla.\n\n🔻 **Sistem Nasıl Çalışır?**\n• **Lobi Kur:** Takım arkadaşlarını topla.\n• **Draft Yap:** En iyi kadroyu kur.\n• **Savaş:** Haritanı seç ve maça başla!\n\n<a:jetto:1467545477221318750> _Lobi oluşturmak için **<#${lobbyConfig.voiceId}>** ses kanalında olmalısın._`)
            .setImage('https://cdn.discordapp.com/attachments/531892263652032522/1464235225818075147/standard_2.gif?ex=6974bad2&is=69736952&hm=16b14c0c7fa6d91ad8528683d2876891b5833d4d516ef5891cd91bc4b8c9804d&')
            .setFooter({ text: `Nexora Competitive Systems • ${lobbyConfig.name}` })
            .setTimestamp();

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
