const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { MusicGuild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { getQueue, createQueue, formatDuration } = require('../../managers/queueManager');
const { search } = require('../../utils/search');
const { t } = require('../../locales');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('play')
        .setNameLocalizations({ tr: 'çal' })
        .setDescription('Play a song from YouTube or Spotify')
        .setDescriptionLocalizations({ tr: 'YouTube veya Spotify\'dan şarkı çal' })
        .addStringOption(option =>
            option.setName('query')
                .setNameLocalizations({ tr: 'arama' })
                .setDescription('Song name or URL')
                .setDescriptionLocalizations({ tr: 'Şarkı adı veya URL' })
                .setRequired(true)
        ),
    cooldown: 3,
    djRequired: false,

    async execute(interaction, client, lang) {
        const query = interaction.options.getString('query');

        // Check if user is in voice channel
        const voiceChannel = interaction.member.voice.channel;
        if (!voiceChannel) {
            return interaction.reply({
                content: t('notInVoice', lang),
                flags: MessageFlags.Ephemeral
            });
        }

        // Defer reply since search might take a moment
        await interaction.deferReply();

        // Search for track(s)
        const result = await search(query);

        if (!result) {
            return interaction.editReply(t('nothingFound', lang, { query }));
        }

        // Get or create queue
        let queue = await getQueue(client, interaction.guild.id);

        if (!queue) {
            try {
                const guildSettings = await MusicGuild.getOrCreate(interaction.guild.id);
                queue = await createQueue(client, interaction, voiceChannel);
                queue.volume = guildSettings.defaultVolume;
                queue.announceNowPlaying = guildSettings.announceNowPlaying;
                queue.autoLeaveMinutes = guildSettings.autoLeaveMinutes;
                queue.lang = guildSettings.language;
            } catch (error) {
                return interaction.editReply('❌ Ses kanalına bağlanılamadı!');
            }
        } else {
            // Check if user is in same channel
            if (voiceChannel.id !== queue.voiceChannel.id) {
                return interaction.editReply(t('notSameVoice', lang));
            }
        }

        // Handle playlist (array of tracks)
        if (Array.isArray(result)) {
            for (const track of result) {
                track.requestedBy = interaction.user.id;
                queue.addTrack(track);
            }

            // Start playing if not already
            if (!queue.current) {
                const firstTrack = queue.tracks.shift();
                await queue.play(firstTrack);
            }

            return interaction.editReply(t('addedPlaylist', lang, { count: result.length }));
        }

        // Single track
        result.requestedBy = interaction.user.id;

        if (!queue.current) {
            // No current track - play immediately
            await queue.play(result);

            const embed = new EmbedBuilder()
                .setColor(0x1DB954)
                .setTitle(t('nowPlaying', lang))
                .setDescription(`**${result.title}**`)
                .setThumbnail(result.thumbnail)
                .addFields({ name: t('duration', lang), value: formatDuration(result.duration), inline: true })
                .setFooter({ text: t('footer', lang) });

            return interaction.editReply({ embeds: [embed] });
        } else {
            // Add to queue
            queue.addTrack(result);
            return interaction.editReply(t('addedToQueue', lang, { title: result.title }));
        }
    }
};
