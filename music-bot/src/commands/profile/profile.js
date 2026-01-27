const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { MusicUser } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { formatDuration } = require('../../managers/queueManager');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setNameLocalizations({ tr: 'profil' })
        .setDescription('View your music profile')
        .setDescriptionLocalizations({ tr: 'Müzik profilinizi görüntüleyin' })
        .addUserOption(opt =>
            opt.setName('user')
                .setNameLocalizations({ tr: 'kullanıcı' })
                .setDescription('User to view profile (default: yourself)')
                .setDescriptionLocalizations({ tr: 'Profilini görmek istediğiniz kullanıcı (varsayılan: kendiniz)' })
        ),
    cooldown: 5,
    djRequired: false,

    async execute(interaction, client, lang) {
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const musicUser = await MusicUser.getOrCreate(targetUser.id);

        // Calculate time listened
        const totalSeconds = musicUser.stats.totalTime || 0;
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);

        const embed = new EmbedBuilder()
            .setColor(0x1DB954)
            .setTitle(`${t('profile', lang)} - ${targetUser.username}`)
            .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
            .addFields(
                {
                    name: `📊 ${t('totalListened', lang)}`,
                    value: `**${musicUser.stats.totalListened || 0}** ${t('songs', lang)}`,
                    inline: true
                },
                {
                    name: `⏱️ ${t('totalTime', lang)}`,
                    value: `**${hours}** ${t('hours', lang)} **${minutes}** ${t('minutes', lang)}`,
                    inline: true
                },
                {
                    name: '📚 Playlist',
                    value: `**${musicUser.playlists.length}** playlist`,
                    inline: true
                }
            )
            .setFooter({ text: t('footer', lang) });

        // Top tracks
        if (musicUser.stats.topTracks && musicUser.stats.topTracks.length > 0) {
            const topTracksText = musicUser.stats.topTracks.slice(0, 5).map((track, i) =>
                `\`${i + 1}.\` [${track.title.substring(0, 40)}${track.title.length > 40 ? '...' : ''}](${track.url}) (${track.playCount}x)`
            ).join('\n');

            embed.addFields({
                name: `🏆 ${t('topTracks', lang)}`,
                value: topTracksText || t('noStats', lang),
                inline: false
            });
        } else {
            embed.addFields({
                name: `🏆 ${t('topTracks', lang)}`,
                value: t('noStats', lang),
                inline: false
            });
        }

        return interaction.reply({ embeds: [embed] });
    }
};
