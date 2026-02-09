const mongoose = require('mongoose');

const trainerScoreSchema = new mongoose.Schema({
    userId: { type: String, required: true, index: true }, // Discord User ID
    username: { type: String, required: true },
    avatar: { type: String },
    
    // Harita Bilgisi
    mapId: { 
        type: String, 
        required: true,
        enum: ['gridshot', 'tracking', 'flicking', 'microshot', 'sixshot', 'spidershot'],
        index: true
    },
    
    // Skor Detayları
    score: { type: Number, required: true, index: true },
    accuracy: { type: Number, default: 0 }, // Yüzde (0-100)
    hits: { type: Number, default: 0 },
    misses: { type: Number, default: 0 },
    duration: { type: Number, required: true }, // Saniye
    
    // Ayarlar (Replay için)
    settings: {
        sensitivity: { type: Number, default: 0.5 },
        crosshairStyle: { type: String, default: 'default' },
        crosshairColor: { type: String, default: '#00ff00' },
        crosshairSize: { type: Number, default: 4 },
        crosshairThickness: { type: Number, default: 2 },
        crosshairGap: { type: Number, default: 2 },
        crosshairOutline: { type: Boolean, default: true }
    },
    
    // Metadata
    deviceInfo: {
        userAgent: String,
        screenResolution: String
    }
    
}, { timestamps: true });

// Compound index: Her harita için kullanıcı başına en iyi skor
trainerScoreSchema.index({ userId: 1, mapId: 1, score: -1 });

// Leaderboard için index
trainerScoreSchema.index({ mapId: 1, score: -1 });

// Kullanıcının bir haritadaki en iyi skoru
trainerScoreSchema.statics.getUserBestScore = async function(userId, mapId) {
    return this.findOne({ userId, mapId }).sort({ score: -1 });
};

// Harita leaderboard'u (Top 10)
trainerScoreSchema.statics.getLeaderboard = async function(mapId, limit = 10) {
    return this.aggregate([
        { $match: { mapId } },
        { $sort: { score: -1 } },
        { $group: {
            _id: '$userId',
            username: { $first: '$username' },
            avatar: { $first: '$avatar' },
            score: { $max: '$score' },
            accuracy: { $first: '$accuracy' },
            createdAt: { $first: '$createdAt' }
        }},
        { $sort: { score: -1 } },
        { $limit: limit },
        { $project: {
            userId: '$_id',
            username: 1,
            avatar: 1,
            score: 1,
            accuracy: 1,
            createdAt: 1,
            _id: 0
        }}
    ]);
};

// Kullanıcının sıralaması
trainerScoreSchema.statics.getUserRank = async function(userId, mapId) {
    const userBest = await this.getUserBestScore(userId, mapId);
    if (!userBest) return null;
    
    const rank = await this.countDocuments({
        mapId,
        score: { $gt: userBest.score }
    });
    
    return rank + 1;
};

module.exports = mongoose.model('TrainerScore', trainerScoreSchema);
