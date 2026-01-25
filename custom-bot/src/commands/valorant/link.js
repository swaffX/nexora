const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('link')
        .setDescription('Connect your Riot Games account.')
        .addStringOption(option =>
            option.setName('name')
                .setDescription('Riot Username')
                .setRequired(false))
        .addStringOption(option =>
            option.setName('tag')
                .setDescription('Riot Tag')
                .setRequired(false)),

    async execute(interaction) {
        const name = interaction.options.getString('name');
        const tag = interaction.options.getString('tag');

        if (name && tag) {
            // Manuel Linkleme (Dev Mode / Temporary)
            try {
                const path = require('path');
                const ValorantUser = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models', 'ValorantUser'));

                let vUser = await ValorantUser.findOne({ userId: interaction.user.id });
                if (!vUser) vUser = new ValorantUser({ userId: interaction.user.id });

                vUser.riotName = name;
                vUser.riotTag = tag;
                vUser.region = 'eu'; // Varsayılan
                await vUser.save();

                return interaction.reply({
                    content: `✅ **Bağlandı:** \`${name}#${tag}\`\nArtık istatistiklerinizi görüntüleyebilirsiniz.`,
                    ephemeral: true
                });
            } catch (error) {
                console.error(error);
                return interaction.reply({ content: '❌ Kayıt sırasında hata oluştu.', ephemeral: true });
            }
        }

        // --- RSO FLOW (WAITING APPROVAL) ---
        const embed = new EmbedBuilder()
            .setColor(0xFF4655)
            .setTitle('Valorant Account Integration')
            .setDescription('**Manual Link:**\nUse `/link name:YOURNAME tag:TAG` to link manually.\n\n**Official RSO:**\nWe are currently waiting for **Riot Games API Approval** for secure login.')
            .setThumbnail('https://img.icons8.com/color/48/valorant.png')
            .setFooter({ text: 'Nexora RSO System' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId('pending_rso')
                .setLabel('Login via Riot (Pending)')
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
