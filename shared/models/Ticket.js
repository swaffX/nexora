const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
    odaId: { type: String, required: true },
    odasi: { type: String, required: true },       // Ticket sahibi
    channelId: { type: String, required: true },
    category: { type: String, default: 'general' },
    status: { type: String, enum: ['open', 'claimed', 'closed'], default: 'open' },
    claimedBy: { type: String, default: null },
    transcript: [{
        author: { type: String },
        content: { type: String },
        timestamp: { type: Date }
    }],
    closedAt: { type: Date, default: null },
    closedBy: { type: String, default: null }
}, { timestamps: true });

ticketSchema.index({ odaId: 1, odasi: 1 });
ticketSchema.index({ channelId: 1 });

module.exports = mongoose.model('Ticket', ticketSchema);
