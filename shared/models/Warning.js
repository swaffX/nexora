const mongoose = require('mongoose');

const warningSchema = new mongoose.Schema({
    odasi: { type: String, required: true },      // User ID
    odaId: { type: String, required: true },       // Guild ID
    moderatorId: { type: String, required: true },
    reason: { type: String, required: true },
    createdAt: { type: Date, default: Date.now }
});

warningSchema.index({ odasi: 1, odaId: 1 });

module.exports = mongoose.model('Warning', warningSchema);
