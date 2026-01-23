const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true }, // Ticket sahibi
    channelId: { type: String, required: true },
    ticketId: { type: Number, required: true }, // 0001, 0002 gibi
    type: { type: String, required: true }, // support, report, billing vb.

    status: { type: String, enum: ['OPEN', 'CLOSED', 'LOCKED'], default: 'OPEN' },

    claimedBy: { type: String, default: null }, // İlgilenen yetkili

    createdAt: { type: Date, default: Date.now },
    closedAt: { type: Date, default: null },

    transcript: [{ // Basit transcript tutma (Gelişmişi için dosya yapılabilir)
        authorId: String,
        content: String,
        timestamp: Date,
        authorName: String
    }],

    rate: { type: Number, default: 0 } // Kullanıcı memnuniyeti 1-5
});

module.exports = mongoose.model('Ticket', ticketSchema);
