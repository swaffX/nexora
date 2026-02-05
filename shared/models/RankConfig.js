const mongoose = require('mongoose');

const rankConfigSchema = new mongoose.Schema({
    guildId: { type: String, required: true },
    roles: [{
        level: { type: Number, required: true },
        roleId: { type: String, required: true }
    }]
}, { timestamps: true });

// Tek guild için tek config olmalı
rankConfigSchema.index({ guildId: 1 }, { unique: true });

module.exports = mongoose.model('RankConfig', rankConfigSchema);
