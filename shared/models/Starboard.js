const mongoose = require('mongoose');

const starboardSchema = new mongoose.Schema({
    originalMessageId: { type: String, required: true },
    starboardMessageId: { type: String, required: true },
    channelId: { type: String, required: true },
    odaId: { type: String, required: true },
    authorId: { type: String, required: true },
    starCount: { type: Number, default: 0 },
    content: { type: String },
    attachments: [{ type: String }]
}, { timestamps: true });

starboardSchema.index({ originalMessageId: 1, odaId: 1 }, { unique: true });

module.exports = mongoose.model('Starboard', starboardSchema);
