const mongoose = require('mongoose');

const trainerSettingsSchema = new mongoose.Schema({
    userId: { type: String, required: true, unique: true, index: true },
    
    // Valorant Uyumlu Sensitivity
    sensitivity: { type: Number, default: 0.5, min: 0.001, max: 5 },
    dpi: { type: Number, default: 800 },
    
    // Crosshair Ayarları (Valorant Tarzı)
    crosshair: {
        style: { 
            type: String, 
            default: 'cross',
            enum: ['cross', 'dot', 'circle', 'square', 'custom']
        },
        color: { type: String, default: '#00ff00' },
        outlineColor: { type: String, default: '#000000' },
        size: { type: Number, default: 4, min: 1, max: 20 },
        thickness: { type: Number, default: 2, min: 1, max: 10 },
        gap: { type: Number, default: 2, min: -5, max: 20 },
        outline: { type: Boolean, default: true },
        outlineThickness: { type: Number, default: 1, min: 0, max: 5 },
        centerDot: { type: Boolean, default: false },
        centerDotSize: { type: Number, default: 2, min: 1, max: 10 }
    },
    
    // Görsel Ayarlar
    graphics: {
        fov: { type: Number, default: 90, min: 60, max: 120 },
        showFPS: { type: Boolean, default: true },
        showAccuracy: { type: Boolean, default: true },
        showTimer: { type: Boolean, default: true }
    },
    
    // Ses Ayarları
    audio: {
        masterVolume: { type: Number, default: 0.7, min: 0, max: 1 },
        hitSound: { type: Boolean, default: true },
        missSound: { type: Boolean, default: false },
        hitSoundVolume: { type: Number, default: 0.5, min: 0, max: 1 }
    },
    
    // İstatistikler
    stats: {
        totalGamesPlayed: { type: Number, default: 0 },
        totalTimeSpent: { type: Number, default: 0 }, // Saniye
        favoriteMap: { type: String, default: null }
    }
    
}, { timestamps: true });

// Kullanıcı ayarlarını getir veya oluştur
trainerSettingsSchema.statics.findOrCreate = async function(userId) {
    let settings = await this.findOne({ userId });
    if (!settings) {
        settings = await this.create({ userId });
    }
    return settings;
};

module.exports = mongoose.model('TrainerSettings', trainerSettingsSchema);
