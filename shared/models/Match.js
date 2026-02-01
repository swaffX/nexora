const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    matchId: { type: String, required: true, unique: true }, // Interaction ID
    guildId: { type: String, required: true },
    hostId: { type: String, required: true },
    channelId: { type: String, required: true }, // Komutun kullanıldığı kanal
    lobbyVoiceId: { type: String }, // Oyuncuların geri döneceği kanal
    matchNumber: { type: Number, index: true }, // Sıralı Maç ID (Örn: #1, #2...)

    // Durum
    status: { type: String, enum: ['SETUP', 'DRAFT', 'VOTING', 'VETO', 'COIN_FLIP', 'SIDE_SELECTION', 'LIVE', 'FINISHED', 'CANCELLED'], default: 'SETUP' },

    // Takımlar
    captainA: { type: String },
    captainB: { type: String },
    teamA: [{ type: String }],
    teamB: [{ type: String }],

    // Draft
    pickTurn: { type: String, enum: ['A', 'B'], default: 'A' },
    availablePlayerIds: [{ type: String }],
    draftMessageId: { type: String },

    // Map Oylama (Yeni Sistem)
    votes: [{
        userId: String,
        mapName: String
    }],
    voteStatus: { type: String, enum: ['NONE', 'VOTING', 'TIE_BREAKER', 'FINISHED'], default: 'NONE' },
    voteEndTime: { type: Date },
    votingMessageId: { type: String }, // Oy sayısını güncellemek için mesaj ID

    // Eski Veto Alanları (Geriye dönük uyumluluk veya yedek için)
    vetoTurn: { type: String, enum: ['A', 'B'], default: 'A' },
    bannedMaps: [{ type: String }],
    selectedMap: { type: String },

    // Side Selection
    coinFlipWinner: { type: String }, // A veya B
    sideA: { type: String }, // Attack / Defend
    sideB: { type: String },

    // Kanallar
    createdChannelIds: [{ type: String }],

    // Bahis Sistemi
    bets: [{
        userId: { type: String },
        team: { type: String, enum: ['A', 'B'] },
        amount: { type: Number },
        claimed: { type: Boolean, default: false } // Kazananlar ödülünü aldı mı?
    }],

    // Maç Skoru
    scoreA: { type: Number, default: 0 },
    scoreB: { type: Number, default: 0 },

    // Maç Sonucu
    winnerTeam: { type: String, enum: ['A', 'B'] },
    playedMaps: { type: [String], default: [] } // Bu lobide oynanan haritalar
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
