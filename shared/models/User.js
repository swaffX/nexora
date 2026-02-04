const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
    odasi: { type: String, required: true },      // Discord User ID
    odaId: { type: String, required: true },       // Discord Guild ID
    username: { type: String },

    // Kayıt Bilgileri
    registeredName: { type: String, default: null },
    gender: { type: String, enum: ['erkek', 'kadın', null], default: null },
    registeredAt: { type: Date, default: null },
    registeredBy: { type: String, default: null },
    isRegistered: { type: Boolean, default: false },

    // Level Sistemi
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 0 },
    totalMessages: { type: Number, default: 0 },
    totalVoiceMinutes: { type: Number, default: 0 },

    // Günlük İstatistikler
    dailyMessages: { type: Number, default: 0 },
    dailyVoice: { type: Number, default: 0 },
    lastDailyReset: { type: Date, default: Date.now },

    // Haftalık İstatistikler
    weeklyMessages: { type: Number, default: 0 },
    weeklyVoice: { type: Number, default: 0 },
    lastWeeklyReset: { type: Date, default: Date.now },

    // Aylık İstatistikler
    monthlyMessages: { type: Number, default: 0 },
    monthlyVoice: { type: Number, default: 0 },
    lastMonthlyReset: { type: Date, default: Date.now },

    // Davet Bilgileri
    invites: {
        regular: { type: Number, default: 0 },
        bonus: { type: Number, default: 0 },
        fake: { type: Number, default: 0 },
        left: { type: Number, default: 0 }
    },
    invitedBy: { type: String, default: null },

    // Ekonomi
    balance: { type: Number, default: 0 },
    bank: { type: Number, default: 0 },
    lastDaily: { type: Date, default: null },
    lastWork: { type: Date, default: null },
    inventory: [{
        itemId: { type: String, required: true },
        amount: { type: Number, default: 1 }
    }],
    activePet: { type: String, default: null }, // Takılı olan Pet ID

    // AFK
    afk: {
        enabled: { type: Boolean, default: false },
        reason: { type: String, default: null },
        since: { type: Date, default: null }
    },



    // Kariyer Sistemi
    career: {
        job: { type: String, default: null },
        level: { type: Number, default: 1 },
        xp: { type: Number, default: 0 },
        lastWorkTime: { type: Date, default: null },
        totalEarnings: { type: Number, default: 0 }
    },

    // Görev Sistemi
    quests: [{
        questId: { type: String },
        progress: { type: Number, default: 0 },
        target: { type: Number },
        isCompleted: { type: Boolean, default: false },
        isClaimed: { type: Boolean, default: false } // Ödül alındı mı?
    }],
    lastQuestReset: { type: Date, default: null },

    // Başarım Sistemi
    achievements: [{
        id: { type: String },
        unlockedAt: { type: Date, default: Date.now }
    }],

    // Detaylı İstatistikler (Başarımlar için)
    stats: {
        totalBets: { type: Number, default: 0 },
        totalWins: { type: Number, default: 0 },
        totalWork: { type: Number, default: 0 },
        totalDuelsWon: { type: Number, default: 0 },
        totalPetUpgrades: { type: Number, default: 0 }
    },

    // Profil Özelleştirme
    reputation: { type: Number, default: 0 },
    bio: { type: String, default: 'Hakkımda bir şey yazılmamış.' },
    backgroundImage: { type: String, default: null }, // Canvas profili için arka plan URL

    // Ses kanalı takibi
    voiceJoinedAt: { type: Date, default: null },
    currentVoiceChannel: { type: String, default: null },

    // Jail Sistemi
    jail: {
        isJailed: { type: Boolean, default: false },
        roles: [{ type: String }], // Silinen rollerin ID'leri
        jailedAt: { type: Date, default: null },
        jailedUntil: { type: Date, default: null }, // Tahliye tarihi
        reason: { type: String, default: null }
    },

    // Maç İstatistikleri (FaceIT ELO Sistemi)
    matchStats: {
        totalMatches: { type: Number, default: 0 },
        totalWins: { type: Number, default: 0 },
        totalLosses: { type: Number, default: 0 },
        elo: { type: Number, default: 1000 }, // Başlangıç 1000
        matchLevel: { type: Number, default: 3 } // Başlangıç Level 3
    }

}, { timestamps: true });

// Compound index
userSchema.index({ odasi: 1, odaId: 1 }, { unique: true });

// Leaderboard için indexler
userSchema.index({ odaId: 1, xp: -1 });
userSchema.index({ odaId: 1, totalMessages: -1 });
userSchema.index({ odaId: 1, totalVoiceMinutes: -1 });
userSchema.index({ odaId: 1, weeklyMessages: -1 });
userSchema.index({ odaId: 1, monthlyMessages: -1 });

// Static methods
userSchema.statics.findOrCreate = async function (userId, guildId, username = null) {
    let user = await this.findOne({ odasi: userId, odaId: guildId });
    if (!user) {
        user = await this.create({
            odasi: userId,
            odaId: guildId,
            username: username
        });
    }
    return user;
};

userSchema.statics.getLeaderboard = async function (guildId, type, period, limit = 10) {
    const field = period === 'all' ? type : `${period}${type.charAt(0).toUpperCase() + type.slice(1)}`;

    const fieldMap = {
        'messages': 'totalMessages',
        'voice': 'totalVoiceMinutes',
        'xp': 'xp',
        'dailyMessages': 'dailyMessages',
        'weeklyMessages': 'weeklyMessages',
        'monthlyMessages': 'monthlyMessages',
        'dailyVoice': 'dailyVoice',
        'weeklyVoice': 'weeklyVoice',
        'monthlyVoice': 'monthlyVoice'
    };

    const sortField = fieldMap[field] || fieldMap[type] || 'xp';

    return this.find({ odaId: guildId })
        .sort({ [sortField]: -1 })
        .limit(limit)
        .select('odasi username ' + sortField);
};

// Instance methods
userSchema.methods.addXP = async function (amount) {
    const oldLevel = this.level;
    this.xp += amount;
    this.level = Math.floor(0.1 * Math.sqrt(this.xp));
    await this.save();
    return this.level > oldLevel ? this.level : null;
};

userSchema.methods.getTotalInvites = function () {
    return this.invites.regular + this.invites.bonus - this.invites.fake - this.invites.left;
};

module.exports = mongoose.model('User', userSchema);
