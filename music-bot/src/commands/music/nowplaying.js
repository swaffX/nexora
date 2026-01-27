const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const { getQueue, formatDuration } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setNameLocalizations({ tr: 'şuançalan' })
        .setDescription('Show the currently playing song')
        .setDescriptionLocalizations({ tr: 'Şu an çalan şarkıyı göster' }),
    cooldown: 3,
    djRequired: false,

    async execute(interaction, client, lang) {
        const queue = await getQueue(client, interaction.guild.id);

        if (!queue || !queue.current) {
            return interaction.reply({
                content: t('noMusic', lang),
                flags: MessageFlags.Ephemeral
            });
        }

        const track = queue.current;

        // Progress bar (basic - we don't track exact position)
        const loopStatus = queue.loop === 'track' ? '🔂' :
            queue.loop === 'queue' ? '🔁' : '▶️';
        const pauseStatus = queue.paused ? '⏸️' : loopStatus;

        const embed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setTitle(t('nowPlaying', lang))
            .setDescription(`**${track.title}**`)
            .setThumbnail(track.thumbnail)
            .addFields(
                { name: t('duration', lang), value: formatDuration(track.duration), inline: true },
                { name: 'Durum', value: pauseStatus, inline: true },
                { name: '🔊 Ses', value: `${queue.volume}%`, inline: true }
            )
            .setFooter({ text: t('footer', lang) });

        if (track.requestedBy) {
            embed.addFields({
                name: t('requestedBy', lang),
                value: `<@${track.requestedBy}>`,
                inline: true
            });
        }

        return interaction.reply({ embeds: [embed] });
    }
};
