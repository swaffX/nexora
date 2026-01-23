const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    matchId: { type: String, required: true, unique: true }, // Interaction ID
    guildId: { type: String, required: true },
    hostId: { type: String, required: true },
    channelId: { type: String, required: true }, // Komutun kullanıldığı kanal
    lobbyVoiceId: { type: String }, // Oyuncuların geri döneceği kanal

    // Durum
    status: { type: String, enum: ['SETUP', 'DRAFT', 'VETO', 'SIDE_SELECTION', 'LIVE', 'FINISHED'], default: 'SETUP' },

    // Takımlar
    captainA: { type: String },
    captainB: { type: String },
    teamA: [{ type: String }],
    teamB: [{ type: String }],

    // Draft
    pickTurn: { type: String, enum: ['A', 'B'], default: 'A' },
    availablePlayerIds: [{ type: String }],

    // Veto & Map
    vetoTurn: { type: String, enum: ['A', 'B'], default: 'A' },
    bannedMaps: [{ type: String }],
    selectedMap: { type: String },

    // Side Selection
    coinFlipWinner: { type: String }, // A veya B
    sideA: { type: String }, // Attack / Defend
    sideB: { type: String },

    // Kanallar
    createdChannelIds: [{ type: String }],

    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
