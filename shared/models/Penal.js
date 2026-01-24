const mongoose = require('mongoose');

const penalSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    userId: { type: String, required: true },
    type: { type: String, enum: ['MUTE', 'JAIL', 'BAN'], required: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date, required: true }, // Süreli cezalar için zorunlu
    active: { type: Boolean, default: true },
    reason: { type: String, default: 'Belirtilmedi' },
    moderatorId: { type: String, required: true }
});

module.exports = mongoose.model('Penal', penalSchema);
