const mongoose = require('mongoose');

const trackSchema = new mongoose.Schema({
    title: String,
    url: String,
    duration: Number, // seconds
    thumbnail: String,
    addedAt: { type: Date, default: Date.now }
});

const playlistSchema = new mongoose.Schema({
    name: { type: String, required: true },
    tracks: { type: [trackSchema], default: [] },
    createdAt: { type: Date, default: Date.now }
});

const topTrackSchema = new mongoose.Schema({
    title: String,
    url: String,
    playCount: { type: Number, default: 1 }
});

const musicUserSchema = new mongoose.Schema({
    discordId: { type: String, required: true, unique: true, index: true },

    // User Playlists
    playlists: { type: [playlistSchema], default: [] },

    // Listening Statistics
    stats: {
        totalListened: { type: Number, default: 0 }, // Total songs listened
        totalTime: { type: Number, default: 0 },      // Total time in seconds
        topTracks: { type: [topTrackSchema], default: [] }
    },

    // Preferences
    preferences: {
        language: { type: String, default: 'tr', enum: ['tr', 'en'] },
        announceNowPlaying: { type: Boolean, default: true }
    },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
musicUserSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Get or create user
musicUserSchema.statics.getOrCreate = async function (discordId) {
    let user = await this.findOne({ discordId });
    if (!user) {
        user = await this.create({ discordId });
    }
    return user;
};

// Add track to top tracks
musicUserSchema.methods.addToTopTracks = function (track) {
    const existing = this.stats.topTracks.find(t => t.url === track.url);
    if (existing) {
        existing.playCount++;
    } else {
        this.stats.topTracks.push({
            title: track.title,
            url: track.url,
            playCount: 1
        });
    }
    // Sort and keep top 10
    this.stats.topTracks.sort((a, b) => b.playCount - a.playCount);
    this.stats.topTracks = this.stats.topTracks.slice(0, 10);
};

module.exports = mongoose.model('MusicUser', musicUserSchema);
