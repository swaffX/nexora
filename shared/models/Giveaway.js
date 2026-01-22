const mongoose = require('mongoose');

const giveawaySchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    odaId: { type: String, required: true },
    hostedBy: { type: String, required: true },
    prize: { type: String, required: true },
    winnerCount: { type: Number, default: 1 },
    endsAt: { type: Date, required: true },
    ended: { type: Boolean, default: false },
    winners: [{ type: String }],
    participants: [{ type: String }],
    requirements: {
        roleId: { type: String, default: null },
        minLevel: { type: Number, default: 0 },
        minMessages: { type: Number, default: 0 }
    }
}, { timestamps: true });

giveawaySchema.index({ odaId: 1, ended: 1 });
giveawaySchema.index({ endsAt: 1, ended: 1 });

module.exports = mongoose.model('Giveaway', giveawaySchema);
