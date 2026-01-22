const mongoose = require('mongoose');

const tempVoiceSchema = new mongoose.Schema({
    channelId: { type: String, required: true, unique: true },
    odaId: { type: String, required: true },
    ownerId: { type: String, required: true },
    name: { type: String },
    userLimit: { type: Number, default: 0 },
    locked: { type: Boolean, default: false },
    permitted: [{ type: String }],
    rejected: [{ type: String }]
}, { timestamps: true });

tempVoiceSchema.index({ odaId: 1, ownerId: 1 });

module.exports = mongoose.model('TempVoice', tempVoiceSchema);
