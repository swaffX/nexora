const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    matchId: { type: Number, required: true }, // Match-1
    guildId: { type: String, required: true },
    categoryId: { type: String, required: true }, // Match category
    team1ChannelId: { type: String },
    team2ChannelId: { type: String },
    lobbyId: { type: String }, // Geri dönülecek lobi
    creatorId: { type: String },
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Match', matchSchema);
