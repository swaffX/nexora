const mongoose = require('mongoose');

const valorantUserSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true }, // Discord ID
    riotName: { type: String, required: true },
    riotTag: { type: String, required: true },
    region: { type: String, default: 'eu' },
    lastRank: { type: String, default: null }, // Örn: Palladium 3
    lastTier: { type: Number, default: 0 },    // Sayısal rank değeri
    updatedAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ValorantUser', valorantUserSchema);
