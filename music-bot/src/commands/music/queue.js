const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getQueue, formatDuration } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setNameLocalizations({ tr: 'kuyruk' })
        .setDescription('Show the music queue')
        .setDescriptionLocalizations({ tr: 'Müzik kuyruğunu göster' })
        .addIntegerOption(option =>
            option.setName('page')
                .setNameLocalizations({ tr: 'sayfa' })
                .setDescription('Page number')
                .setDescriptionLocalizations({ tr: 'Sayfa numarası' })
                .setMinValue(1)
        ),
    cooldown: 3,
    djRequired: false,

    async execute(interaction, client, lang) {
        const queue = await getQueue(client, interaction.guild.id);

        if (!queue || (!queue.current && !queue.tracks.length)) {
            return interaction.reply({
                content: t('queueEmpty', lang),
                flags: MessageFlags.Ephemeral
            });
        }

        const page = interaction.options.getInteger('page') || 1;
        const itemsPerPage = 10;
        const totalPages = Math.ceil(queue.tracks.length / itemsPerPage) || 1;
        const currentPage = Math.min(page, totalPages);

        const startIndex = (currentPage - 1) * itemsPerPage;
        const endIndex = startIndex + itemsPerPage;
        const tracksOnPage = queue.tracks.slice(startIndex, endIndex);

        let description = '';

        // Current track
        if (queue.current) {
            description += `🎵 **Şu An Çalıyor:**\n`;
            description += `[${queue.current.title}](${queue.current.url}) - \`${formatDuration(queue.current.duration)}\`\n\n`;
        }

        // Queue tracks
        if (tracksOnPage.length) {
            description += `📜 **Kuyruk:**\n`;
            tracksOnPage.forEach((track, index) => {
                const position = startIndex + index + 1;
                description += `\`${position}.\` [${track.title}](${track.url}) - \`${formatDuration(track.duration)}\`\n`;
            });
        }

        // Loop mode indicator
        const loopIndicator = queue.loop === 'track' ? '🔂 Şarkı Döngüsü' :
            queue.loop === 'queue' ? '🔁 Kuyruk Döngüsü' : '';

        const embed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setTitle(t('queue', lang))
            .setDescription(description || t('queueEmpty', lang))
            .setFooter({
                text: `${t('queuePage', lang, { page: currentPage, total: totalPages })} | ${t('totalTracks', lang, { count: queue.tracks.length })} ${loopIndicator ? `| ${loopIndicator}` : ''} | ${t('footer', lang)}`
            });

        return interaction.reply({ embeds: [embed] });
    }
};
