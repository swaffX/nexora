const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Riot Games account (RSO) to access statistics and verification.')
        .addStringOption(option =>
            option.setName('riot-id')
                .setDescription('Your Riot ID (e.g., Player#TAG)')
                .setRequired(true)),

    async execute(interaction) {
        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
        const riotId = interaction.options.getString('riot-id');

        const embed = new EmbedBuilder()
            .setColor(0xFF4655)
            .setTitle('Valorant Account Integration')
            .setDescription('We are currently waiting for **Riot Games API Approval** to enable secure Login.\n\nOnce approved, this command will allow you to link your account via official RSO (Riot Sign On) to verify ownership and track stats.')
            .setThumbnail('https://img.icons8.com/color/48/valorant.png') // Geçici ikon
            .setFooter({ text: 'Nexora RSO System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('pending_rso')
                .setLabel('Login with Riot ID (Pending)')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true)
        );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }
};
