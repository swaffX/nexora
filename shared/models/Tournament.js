const mongoose = require('mongoose');

const tournamentSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    name: { type: String, required: true },
    prize: { type: String, default: 'Onur ve Şeref' },
    status: { type: String, enum: ['WAITING', 'ACTIVE', 'FINISHED'], default: 'WAITING' },
    createdBy: { type: String, required: true },

    // Katılımcılar (Takım Kaptanları veya Bireysel)
    participants: [{
        userId: { type: String },
        username: { type: String },
        teamName: { type: String, default: null } // Takım ismi (opsiyonel)
    }],

    // Eşleşmeler
    currentRound: { type: Number, default: 1 },
    matches: [{
        round: { type: Number },
        player1: { type: String }, // User ID
        player2: { type: String }, // User ID (veya null if bye)
        winner: { type: String, default: null }
    }]

}, { timestamps: true });

module.exports = mongoose.model('Tournament', tournamentSchema);
