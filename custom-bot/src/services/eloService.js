/**
 * ELO Management Service
 * Merkezi ELO yönetim servisi - Tüm ELO değişiklikleri buradan geçer
 * 
 * Özellikler:
 * - Tek kaynak prensibi (Single Source of Truth)
 * - Min/Max sınırları
 * - Audit loglama
 * - Level hesaplama
 */

const ELO_CONFIG = {
    MIN_ELO: 100,
    MAX_ELO: 3000,
    DEFAULT_ELO: 100,
    DEFAULT_LEVEL: 1,
    BASE_WIN: 20,
    BASE_LOSS: -20,
    MVP_BONUS: 5,
    MAX_ROUND_BONUS: 10,
    FAIRNESS_DIVISOR: 40, // Her 40 ELO farkı = ±1 puan
    MAX_FAIRNESS_ADJUSTMENT: 10,
    LEVEL_THRESHOLDS: [
        { max: 500, level: 1 },
        { max: 750, level: 2 },
        { max: 900, level: 3 },
        { max: 1050, level: 4 },
        { max: 1200, level: 5 },
        { max: 1350, level: 6 },
        { max: 1530, level: 7 },
        { max: 1750, level: 8 },
        { max: 2000, level: 9 },
        { max: Infinity, level: 10 }
    ]
};

/**
 * ELO değerinden Level hesapla
 * @param {number} elo 
 * @returns {number} Level (1-10)
 */
function getLevelFromElo(elo) {
    if (typeof elo !== 'number' || isNaN(elo)) elo = ELO_CONFIG.DEFAULT_ELO;

    for (const threshold of ELO_CONFIG.LEVEL_THRESHOLDS) {
        if (elo <= threshold.max) return threshold.level;
    }
    return 10;
}

/**
 * ELO değerini sınırlar içinde tut
 * @param {number} elo 
 * @returns {number} Clamped ELO
 */
function clampElo(elo) {
    if (typeof elo !== 'number' || isNaN(elo)) return ELO_CONFIG.DEFAULT_ELO;
    if (elo < ELO_CONFIG.MIN_ELO) return ELO_CONFIG.MIN_ELO;
    if (elo > ELO_CONFIG.MAX_ELO) return ELO_CONFIG.MAX_ELO;
    return Math.round(elo);
}

/**
 * Kullanıcının matchStats objesini başlat veya düzelt
 * @param {Object} user Mongoose User document
 * @returns {Object} Düzeltilmiş user object
 */
function ensureValidStats(user) {
    if (!user.matchStats) {
        user.matchStats = {};
    }

    const stats = user.matchStats;

    // Varsayılan değerleri uygula
    if (typeof stats.elo !== 'number' || isNaN(stats.elo)) {
        stats.elo = ELO_CONFIG.DEFAULT_ELO;
    }
    if (typeof stats.matchLevel !== 'number' || isNaN(stats.matchLevel)) {
        stats.matchLevel = ELO_CONFIG.DEFAULT_LEVEL;
    }
    if (typeof stats.totalMatches !== 'number') {
        stats.totalMatches = 0;
    }
    if (typeof stats.totalWins !== 'number') {
        stats.totalWins = 0;
    }
    if (typeof stats.totalLosses !== 'number') {
        stats.totalLosses = 0;
    }

    // Sınırları uygula
    stats.elo = clampElo(stats.elo);
    stats.matchLevel = getLevelFromElo(stats.elo);

    return user;
}

/**
 * ELO değişikliği yap ve logla
 * @param {Object} user Mongoose User document
 * @param {number} change ELO değişikliği (+/-)
 * @param {string} reason Değişiklik nedeni (Audit için)
 * @returns {Promise<Object>} Güncellenmiş user
 */
async function applyEloChange(user, change, reason = 'Unknown') {
    ensureValidStats(user);

    const oldElo = user.matchStats.elo;
    const oldLevel = user.matchStats.matchLevel;

    // Değişikliği uygula
    const newElo = clampElo(oldElo + change);
    const newLevel = getLevelFromElo(newElo);

    user.matchStats.elo = newElo;
    user.matchStats.matchLevel = newLevel;

    // Audit Log
    const changeSign = change >= 0 ? '+' : '';
    console.log(`[ELO AUDIT] User: ${user.odasi} | ELO: ${oldElo} → ${newElo} (${changeSign}${change}) | Level: ${oldLevel} → ${newLevel} | Reason: ${reason}`);

    await user.save();
    return user;
}

/**
 * Maç sonrası ELO değişikliğini hesapla
 * @param {Object} params Hesaplama parametreleri
 * @returns {number} Final ELO değişikliği
 */
function calculateMatchEloChange({ isWin, roundDiff, myTeamAvg, enemyTeamAvg, isMvpWinner, isMvpLoser }) {
    // Adalet faktörü hesapla
    let eloDiff = enemyTeamAvg - myTeamAvg;
    let fairnessAdjustment = Math.round(eloDiff / ELO_CONFIG.FAIRNESS_DIVISOR);

    // Sınırla
    if (fairnessAdjustment > ELO_CONFIG.MAX_FAIRNESS_ADJUSTMENT) {
        fairnessAdjustment = ELO_CONFIG.MAX_FAIRNESS_ADJUSTMENT;
    }
    if (fairnessAdjustment < -ELO_CONFIG.MAX_FAIRNESS_ADJUSTMENT) {
        fairnessAdjustment = -ELO_CONFIG.MAX_FAIRNESS_ADJUSTMENT;
    }

    // Raund bonusu (max 10)
    const roundBonus = Math.min(roundDiff || 0, ELO_CONFIG.MAX_ROUND_BONUS);

    let finalChange = 0;

    if (isWin) {
        // Kazanma: Baz + Raund Bonusu + Adalet + MVP
        finalChange = ELO_CONFIG.BASE_WIN + roundBonus + fairnessAdjustment;
        if (isMvpWinner) finalChange += ELO_CONFIG.MVP_BONUS;
    } else {
        // Kaybetme: Baz + Adalet + MVP Koruması
        finalChange = ELO_CONFIG.BASE_LOSS + fairnessAdjustment;
        if (isMvpLoser) finalChange += ELO_CONFIG.MVP_BONUS;

        // Limit: Kayıp asla pozitif olamaz
        if (finalChange > 0) finalChange = 0;
    }

    return finalChange;
}

/**
 * Yeni kullanıcı için varsayılan matchStats objesi oluştur
 * @returns {Object} Default matchStats
 */
function createDefaultStats() {
    return {
        totalMatches: 0,
        totalWins: 0,
        totalLosses: 0,
        elo: ELO_CONFIG.DEFAULT_ELO,
        matchLevel: ELO_CONFIG.DEFAULT_LEVEL
    };
}

module.exports = {
    ELO_CONFIG,
    getLevelFromElo,
    clampElo,
    ensureValidStats,
    applyEloChange,
    calculateMatchEloChange,
    createDefaultStats
};
