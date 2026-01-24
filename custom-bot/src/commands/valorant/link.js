const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Link your Riot Games account (RSO) to access statistics and verification.'),

    async execute(interaction) {
        // --- BU KISIM RIOT ONAYINDAN SONRA AKTİF OLACAK ---
        // const authUrl = `https://auth.riotgames.com/authorize?client_id=${process.env.RIOT_CLIENT_ID}&redirect_uri=${process.env.RIOT_REDIRECT_URI}&response_type=code&scope=openid+offline_access`;

        const embed = new EmbedBuilder()
            .setColor(0xFF4655)
            .setTitle('Valorant Account Integration')
            .setDescription('We are currently waiting for **Riot Games API Approval** to enable secure Login.\n\nOnce approved, this command will allow you to link your account via official RSO (Riot Sign On) to verify ownership and track stats.')
            .setThumbnail('https://img.icons8.com/color/48/valorant.png')
            .setFooter({ text: 'Nexora RSO System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('pending_rso')
                .setLabel('Login with Riot ID (Pending)')
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(true) // Şimdilik kapalı
        );

        await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });
    }
};
