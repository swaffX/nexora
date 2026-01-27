const mongoose = require('mongoose');

const musicGuildSchema = new mongoose.Schema({
    guildId: { type: String, required: true, unique: true, index: true },

    // DJ Settings
    djRoleId: { type: String, default: null }, // null = everyone can use

    // Playback Settings
    defaultVolume: { type: Number, default: 50, min: 1, max: 100 },
    announceNowPlaying: { type: Boolean, default: true },
    autoLeaveMinutes: { type: Number, default: 5 }, // Minutes to wait before leaving empty channel

    // Channel Restrictions
    textChannelId: { type: String, default: null }, // Lock commands to specific channel

    // Language
    language: { type: String, default: 'tr', enum: ['tr', 'en'] },

    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

// Update timestamp on save
musicGuildSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

// Get or create guild settings
musicGuildSchema.statics.getOrCreate = async function (guildId) {
    let guild = await this.findOne({ guildId });
    if (!guild) {
        guild = await this.create({ guildId });
    }
    return guild;
};

module.exports = mongoose.model('MusicGuild', musicGuildSchema);
