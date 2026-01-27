const { SlashCommandBuilder, EmbedBuilder, MessageFlags } = require('discord.js');
const path = require('path');
const { MusicUser } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { getQueue, formatDuration, createQueue } = require('../../managers/queueManager');
const { MusicGuild } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));
const { t } = require('../../locales');

const MAX_PLAYLISTS = 10;
const MAX_TRACKS_PER_PLAYLIST = 100;

module.exports = {
    data: new SlashCommandBuilder()
        .setName('playlist')
        .setNameLocalizations({ tr: 'çalmaListesi' })
        .setDescription('Manage your playlists')
        .setDescriptionLocalizations({ tr: 'Çalma listelerinizi yönetin' })
        .addSubcommand(sub =>
            sub.setName('create')
                .setNameLocalizations({ tr: 'oluştur' })
                .setDescription('Create a new playlist')
                .setDescriptionLocalizations({ tr: 'Yeni bir çalma listesi oluştur' })
                .addStringOption(opt =>
                    opt.setName('name')
                        .setNameLocalizations({ tr: 'isim' })
                        .setDescription('Playlist name')
                        .setDescriptionLocalizations({ tr: 'Çalma listesi adı' })
                        .setRequired(true)
                        .setMaxLength(32)
                )
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setNameLocalizations({ tr: 'sil' })
                .setDescription('Delete a playlist')
                .setDescriptionLocalizations({ tr: 'Çalma listesini sil' })
                .addStringOption(opt =>
                    opt.setName('name')
                        .setNameLocalizations({ tr: 'isim' })
                        .setDescription('Playlist name')
                        .setDescriptionLocalizations({ tr: 'Çalma listesi adı' })
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('add')
                .setNameLocalizations({ tr: 'ekle' })
                .setDescription('Add current song or URL to a playlist')
                .setDescriptionLocalizations({ tr: 'Çalan şarkıyı veya URL\'yi çalma listesine ekle' })
                .addStringOption(opt =>
                    opt.setName('name')
                        .setNameLocalizations({ tr: 'isim' })
                        .setDescription('Playlist name')
                        .setDescriptionLocalizations({ tr: 'Çalma listesi adı' })
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('remove')
                .setNameLocalizations({ tr: 'kaldır' })
                .setDescription('Remove a song from playlist')
                .setDescriptionLocalizations({ tr: 'Çalma listesinden şarkı kaldır' })
                .addStringOption(opt =>
                    opt.setName('name')
                        .setNameLocalizations({ tr: 'isim' })
                        .setDescription('Playlist name')
                        .setDescriptionLocalizations({ tr: 'Çalma listesi adı' })
                        .setRequired(true)
                        .setAutocomplete(true)
                )
                .addIntegerOption(opt =>
                    opt.setName('position')
                        .setNameLocalizations({ tr: 'sıra' })
                        .setDescription('Song position (1, 2, 3...)')
                        .setDescriptionLocalizations({ tr: 'Şarkı sırası (1, 2, 3...)' })
                        .setRequired(true)
                        .setMinValue(1)
                )
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setNameLocalizations({ tr: 'listele' })
                .setDescription('Show your playlists')
                .setDescriptionLocalizations({ tr: 'Çalma listelerinizi göster' })
        )
        .addSubcommand(sub =>
            sub.setName('view')
                .setNameLocalizations({ tr: 'görüntüle' })
                .setDescription('View playlist tracks')
                .setDescriptionLocalizations({ tr: 'Çalma listesi şarkılarını görüntüle' })
                .addStringOption(opt =>
                    opt.setName('name')
                        .setNameLocalizations({ tr: 'isim' })
                        .setDescription('Playlist name')
                        .setDescriptionLocalizations({ tr: 'Çalma listesi adı' })
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        )
        .addSubcommand(sub =>
            sub.setName('play')
                .setNameLocalizations({ tr: 'çal' })
                .setDescription('Play a playlist')
                .setDescriptionLocalizations({ tr: 'Çalma listesini çal' })
                .addStringOption(opt =>
                    opt.setName('name')
                        .setNameLocalizations({ tr: 'isim' })
                        .setDescription('Playlist name')
                        .setDescriptionLocalizations({ tr: 'Çalma listesi adı' })
                        .setRequired(true)
                        .setAutocomplete(true)
                )
        ),
    cooldown: 3,
    djRequired: false,

    async execute(interaction, client, lang) {
        const subcommand = interaction.options.getSubcommand();
        const user = await MusicUser.getOrCreate(interaction.user.id);

        switch (subcommand) {
            case 'create': {
                const name = interaction.options.getString('name');

                if (user.playlists.length >= MAX_PLAYLISTS) {
                    return interaction.reply({ content: t('playlistLimit', lang), flags: MessageFlags.Ephemeral });
                }

                if (user.playlists.some(p => p.name.toLowerCase() === name.toLowerCase())) {
                    return interaction.reply({ content: t('playlistExists', lang), flags: MessageFlags.Ephemeral });
                }

                user.playlists.push({ name, tracks: [] });
                await user.save();

                return interaction.reply(t('playlistCreated', lang, { name }));
            }

            case 'delete': {
                const name = interaction.options.getString('name');
                const index = user.playlists.findIndex(p => p.name.toLowerCase() === name.toLowerCase());

                if (index === -1) {
                    return interaction.reply({ content: t('playlistNotFound', lang), flags: MessageFlags.Ephemeral });
                }

                user.playlists.splice(index, 1);
                await user.save();

                return interaction.reply(t('playlistDeleted', lang, { name }));
            }

            case 'add': {
                const name = interaction.options.getString('name');
                const playlist = user.playlists.find(p => p.name.toLowerCase() === name.toLowerCase());

                if (!playlist) {
                    return interaction.reply({ content: t('playlistNotFound', lang), flags: MessageFlags.Ephemeral });
                }

                if (playlist.tracks.length >= MAX_TRACKS_PER_PLAYLIST) {
                    return interaction.reply({ content: t('playlistFull', lang), flags: MessageFlags.Ephemeral });
                }

                // Get current playing track
                const queue = await getQueue(client, interaction.guild.id);
                if (!queue || !queue.current) {
                    return interaction.reply({ content: t('noMusic', lang), flags: MessageFlags.Ephemeral });
                }

                const track = queue.current;
                playlist.tracks.push({
                    title: track.title,
                    url: track.url,
                    duration: track.duration,
                    thumbnail: track.thumbnail,
                    addedAt: new Date()
                });
                await user.save();

                return interaction.reply(t('trackAdded', lang, { title: track.title, playlist: name }));
            }

            case 'remove': {
                const name = interaction.options.getString('name');
                const position = interaction.options.getInteger('position');
                const playlist = user.playlists.find(p => p.name.toLowerCase() === name.toLowerCase());

                if (!playlist) {
                    return interaction.reply({ content: t('playlistNotFound', lang), flags: MessageFlags.Ephemeral });
                }

                if (position < 1 || position > playlist.tracks.length) {
                    return interaction.reply({ content: t('trackNotFound', lang), flags: MessageFlags.Ephemeral });
                }

                playlist.tracks.splice(position - 1, 1);
                await user.save();

                return interaction.reply(t('trackRemoved', lang));
            }

            case 'list': {
                if (!user.playlists.length) {
                    return interaction.reply({ content: t('noPlaylists', lang), flags: MessageFlags.Ephemeral });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x1DB954)
                    .setTitle(t('yourPlaylists', lang))
                    .setDescription(
                        user.playlists.map((p, i) =>
                            `\`${i + 1}.\` **${p.name}** - ${p.tracks.length} ${t('songs', lang)}`
                        ).join('\n')
                    )
                    .setFooter({ text: t('footer', lang) });

                return interaction.reply({ embeds: [embed] });
            }

            case 'view': {
                const name = interaction.options.getString('name');
                const playlist = user.playlists.find(p => p.name.toLowerCase() === name.toLowerCase());

                if (!playlist) {
                    return interaction.reply({ content: t('playlistNotFound', lang), flags: MessageFlags.Ephemeral });
                }

                if (!playlist.tracks.length) {
                    return interaction.reply({ content: t('playlistEmpty', lang), flags: MessageFlags.Ephemeral });
                }

                const embed = new EmbedBuilder()
                    .setColor(0x1DB954)
                    .setTitle(t('playlistTracks', lang, { name: playlist.name }))
                    .setDescription(
                        playlist.tracks.slice(0, 20).map((track, i) =>
                            `\`${i + 1}.\` [${track.title}](${track.url}) - \`${formatDuration(track.duration)}\``
                        ).join('\n') + (playlist.tracks.length > 20 ? `\n...ve ${playlist.tracks.length - 20} daha` : '')
                    )
                    .setFooter({ text: `${t('totalTracks', lang, { count: playlist.tracks.length })} | ${t('footer', lang)}` });

                return interaction.reply({ embeds: [embed] });
            }

            case 'play': {
                const name = interaction.options.getString('name');
                const playlist = user.playlists.find(p => p.name.toLowerCase() === name.toLowerCase());

                if (!playlist) {
                    return interaction.reply({ content: t('playlistNotFound', lang), flags: MessageFlags.Ephemeral });
                }

                if (!playlist.tracks.length) {
                    return interaction.reply({ content: t('playlistEmpty', lang), flags: MessageFlags.Ephemeral });
                }

                const voiceChannel = interaction.member.voice.channel;
                if (!voiceChannel) {
                    return interaction.reply({ content: t('notInVoice', lang), flags: MessageFlags.Ephemeral });
                }

                await interaction.deferReply();

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
                }

                // Add all tracks to queue
                for (const track of playlist.tracks) {
                    track.requestedBy = interaction.user.id;
                    queue.addTrack({ ...track });
                }

                // Start playing if not already
                if (!queue.current) {
                    const firstTrack = queue.tracks.shift();
                    await queue.play(firstTrack);
                }

                return interaction.editReply(t('playlistPlaying', lang, { name: playlist.name }));
            }
        }
    }
};
