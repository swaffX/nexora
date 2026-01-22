const mongoose = require('mongoose');

const suggestionSchema = new mongoose.Schema({
    messageId: { type: String, required: true },
    channelId: { type: String, required: true },
    odaId: { type: String, required: true },
    odasi: { type: String, required: true },
    content: { type: String, required: true },
    status: { type: String, enum: ['pending', 'approved', 'denied', 'implemented'], default: 'pending' },
    upvotes: { type: Number, default: 0 },
    downvotes: { type: Number, default: 0 },
    reviewedBy: { type: String, default: null },
    reviewNote: { type: String, default: null }
}, { timestamps: true });

suggestionSchema.index({ odaId: 1, status: 1 });

module.exports = mongoose.model('Suggestion', suggestionSchema);
