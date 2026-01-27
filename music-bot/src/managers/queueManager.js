const {
    joinVoiceChannel,
    createAudioPlayer,
    createAudioResource,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState
} = require('@discordjs/voice');
const play = require('play-dl');
const path = require('path');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const { MusicUser } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { t } = require('../locales');

class Queue {
    constructor(guildId, textChannel, voiceChannel, connection) {
        this.guildId = guildId;
        this.textChannel = textChannel;
        this.voiceChannel = voiceChannel;
        this.connection = connection;
        this.player = createAudioPlayer();
        this.tracks = [];
        this.current = null;
        this.volume = 50;
        this.loop = 'off'; // off, track, queue
        this.paused = false;
        this.autoLeaveMinutes = 5;
        this.leaveTimeout = null;
        this.announceNowPlaying = true;
        this.lang = 'tr';

        // Connect player to connection
        connection.subscribe(this.player);

        // Handle player state changes
        this.player.on(AudioPlayerStatus.Idle, () => this.handleTrackEnd());
        this.player.on('error', error => {
            logger.error(`[Neurovia Music] Player error: ${error.message}`);
            this.handleTrackEnd();
        });
    }

    async handleTrackEnd() {
        const finishedTrack = this.current;

        // Update user stats if we have a current track
        if (finishedTrack && finishedTrack.requestedBy) {
            try {
                const user = await MusicUser.getOrCreate(finishedTrack.requestedBy);
                user.stats.totalListened++;
                user.stats.totalTime += finishedTrack.duration || 0;
                user.addToTopTracks(finishedTrack);
                await user.save();
            } catch (e) {
                logger.error(`[Neurovia Music] Stats update error: ${e.message}`);
            }
        }

        // Handle loop modes
        if (this.loop === 'track' && this.current) {
            return this.play(this.current);
        }

        if (this.loop === 'queue' && this.current) {
            this.tracks.push(this.current);
        }

        // Play next track
        const nextTrack = this.tracks.shift();
        if (nextTrack) {
            await this.play(nextTrack);
        } else {
            this.current = null;
        }
    }

    async play(track) {
        try {
            this.current = track;

            // Get stream
            const stream = await play.stream(track.url);
            const resource = createAudioResource(stream.stream, {
                inputType: stream.type,
                inlineVolume: true
            });

            resource.volume?.setVolume(this.volume / 100);
            this.player.play(resource);

            // Announce now playing
            if (this.announceNowPlaying && this.textChannel) {
                const { EmbedBuilder } = require('discord.js');
                const embed = new EmbedBuilder()
                    .setColor(0x1DB954)
                    .setTitle(t('nowPlaying', this.lang))
                    .setDescription(`**${track.title}**`)
                    .setThumbnail(track.thumbnail)
                    .addFields({ name: t('duration', this.lang), value: formatDuration(track.duration), inline: true })
                    .setFooter({ text: t('footer', this.lang) });

                this.textChannel.send({ embeds: [embed] }).catch(() => { });
            }

        } catch (error) {
            logger.error(`[Neurovia Music] Play error: ${error.message}`);
            this.textChannel?.send(`❌ Şarkı çalınamadı: ${track.title}`).catch(() => { });
            this.handleTrackEnd();
        }
    }

    addTrack(track) {
        this.tracks.push(track);
    }

    skip() {
        this.player.stop();
    }

    stop() {
        this.tracks = [];
        this.current = null;
        this.loop = 'off';
        this.player.stop();
    }

    pause() {
        this.player.pause();
        this.paused = true;
    }

    resume() {
        this.player.unpause();
        this.paused = false;
    }

    setVolume(volume) {
        this.volume = volume;
        // Volume changes will apply to next track
    }

    shuffle() {
        for (let i = this.tracks.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.tracks[i], this.tracks[j]] = [this.tracks[j], this.tracks[i]];
        }
    }

    clear() {
        this.tracks = [];
    }

    remove(index) {
        if (index >= 0 && index < this.tracks.length) {
            return this.tracks.splice(index, 1)[0];
        }
        return null;
    }
}

// Helper function to format duration
function formatDuration(seconds) {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Create or get queue for a guild
async function getQueue(client, guildId) {
    return client.queues.get(guildId);
}

// Create new queue
async function createQueue(client, interaction, voiceChannel) {
    const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: interaction.guild.id,
        adapterCreator: interaction.guild.voiceAdapterCreator,
        selfDeaf: true
    });

    // Wait for connection to be ready
    try {
        await entersState(connection, VoiceConnectionStatus.Ready, 30000);
    } catch (error) {
        connection.destroy();
        throw new Error('Could not connect to voice channel');
    }

    const queue = new Queue(
        interaction.guild.id,
        interaction.channel,
        voiceChannel,
        connection
    );

    client.queues.set(interaction.guild.id, queue);
    return queue;
}

// Destroy queue
function destroyQueue(client, guildId) {
    const queue = client.queues.get(guildId);
    if (queue) {
        if (queue.connection) {
            queue.connection.destroy();
        }
        client.queues.delete(guildId);
    }
}

module.exports = {
    Queue,
    getQueue,
    createQueue,
    destroyQueue,
    formatDuration
};
