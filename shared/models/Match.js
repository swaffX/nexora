const mongoose = require('mongoose');

const matchSchema = new mongoose.Schema({
    matchId: { type: String, required: true, unique: true }, // Interaction ID
    lobbyId: { type: String }, // '1', '2', '3' vs.
    guildId: { type: String, required: true },
    hostId: { type: String, required: true },
    channelId: { type: String, required: true }, // Komutun kullanıldığı kanal
    lobbyVoiceId: { type: String }, // Oyuncuların geri döneceği kanal
    matchNumber: { type: Number, index: true }, // Sıralı Maç ID (Örn: #1, #2...)

    // Durum
    status: { type: String, default: 'SETUP' },

    // Takımlar
    captainA: { type: String },
    captainB: { type: String },
    teamA: [{ type: String }],
    teamB: [{ type: String }],

    // Draft
    pickTurn: { type: String, enum: ['A', 'B'], default: 'A' },
    availablePlayerIds: [{ type: String }],
    draftMessageId: { type: String },
    undoCount: { type: Number, default: 0 },
    lastPickTeam: { type: String, enum: ['A', 'B'], default: null },

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

    // Taraf Seçimi (Yeni Sistem)
    sideSelector: { type: String }, // Tarafı seçecek olan kaptanın ID'si
    teamASide: { type: String, enum: ['ATTACK', 'DEFEND'] },
    teamBSide: { type: String, enum: ['ATTACK', 'DEFEND'] },

    // Lobby Code (Yeni)
    lobbyCode: { type: String },

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

    // ELO Logları
    eloChanges: [{
        userId: String,
        oldElo: Number,
        newElo: Number,
        change: Number,
        reason: String
    }],
    winner: { type: String }, // Match winner (A, B, or DRAW)

    // Maç Sonucu ve Kanıt
    winnerTeam: { type: String, enum: ['A', 'B'] },
    playedMaps: { type: [String], default: [] }, // Bu lobide oynanan haritalar
    lobbyCode: { type: String }, // Valorant Lobi Kodu
    evidenceUrl: { type: String }, // Maç Sonu SS Linki
    mvpPlayerId: { type: String }, // Maçın MVP'si (Kazanan Takım)
    mvpLoserId: { type: String }, // Kaybeden Takımın MVP'si
    // RPS (Taş Kağıt Makas)
    rpsMoveA: { type: String, default: null }, // ROCK, PAPER, SCISSORS
    rpsMoveB: { type: String, default: null }
}, { timestamps: true });

module.exports = mongoose.model('Match', matchSchema);
