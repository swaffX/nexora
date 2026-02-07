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
    MIN_ELO: 0,
    MAX_ELO: 3000,
    DEFAULT_ELO: 200,
    DEFAULT_LEVEL: 1,
    BASE_WIN: 20,
    BASE_LOSS: -20,
    MVP_BONUS: 5,
    MAX_ROUND_BONUS: 10,
    WIN_STREAK_BONUS: 5,      // Seri Bonusu (+5 ELO)
    WIN_STREAK_THRESHOLD: 3,  // 3. maçtan itibaren bonus başlar
    FAIRNESS_DIVISOR: 40, // Her 40 ELO farkı = ±1 puan
    MAX_FAIRNESS_ADJUSTMENT: 10,
    LEVEL_THRESHOLDS: [
        { max: 200, level: 1, name: 'Challenger I' },
        { max: 400, level: 2, name: 'Challenger II' },
        { max: 600, level: 3, name: 'Challenger III' },
        { max: 850, level: 4, name: 'Expert' },
        { max: 1100, level: 5, name: 'Master' },
        { max: 1350, level: 6, name: 'Elite' },
        { max: 1650, level: 7, name: 'Warlord' },
        { max: 1950, level: 8, name: 'Godlike' },
        { max: 2300, level: 9, name: 'Grandmaster' },
        { max: Infinity, level: 10, name: 'Nexora Champion' }
    ],
    TITLES: {
        'Satchel Enjoyer': { color: '#ff8800', description: 'Swaff\'a özel RaZe Main ünvanı.' },
        'MVP Master': { color: '#fbbf24', description: '5 kez maçın adamı (MVP) ol.' },
        'Headshot Machine': { color: '#ffffff', description: '25 kez maçın adamı (MVP) ol.' },
        'Veteran': { color: '#a1a1aa', description: '10 maç sınırını geç.' },
        'Clutch King': { color: '#60a5fa', description: '50 maç sınırını geç.' },
        'On Fire': { color: '#ef4444', description: '5 maçlık galibiyet serisi yakala.' },
        'Unstoppable': { color: '#dc2626', description: '10 maçlık galibiyet serisi yakala.' },
        'Unlucky': { color: '#3b82f6', description: '5 maç üst üste mağlubiyet (Teselli).' },
        'Immortal': { color: '#a855f7', description: '2000 ELO barajını aş.' },
        'Nexora Elite': { color: '#2ecc71', description: 'Level 6 ve üzerine ulaş.' },
        'Rookie': { color: '#94a3b8', description: 'Nexora ELO sistemine giriş ünvanı.' }
    },
    BACKGROUND_THEMES: {
        'Default': { path: null, name: 'Varsayılan Dark' },
        'Raze': { path: 'Raze.png', name: 'Raze Special' },
        'Jett': { path: 'Jett.png', name: 'Jett Special' },
    },
};

/**
 * Ezeli Rakip (Nemesis) hesapla: Kullanıcının en çok hangi rakibe karşı yenildiğini bulur.
 */
async function calculateNemesis(userId, guildId) {
    const path = require('path');
    const { Match } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

    const matches = await Match.find({
        status: 'FINISHED',
        odaId: guildId,
        $or: [{ teamA: userId }, { teamB: userId }]
    });

    const losesTo = {}; // { opponentId: count }

    for (const m of matches) {
        const isTeamA = m.teamA.includes(userId);
        const winners = m.winner === 'A' ? m.teamA : m.teamB;
        const losers = m.winner === 'A' ? m.teamB : m.teamA;

        // Eğer kullanıcı kaybeden takımdaysa, kazanan takımdaki herkesi "yendi beni" listesine ekle
        const wasInLoserTeam = (isTeamA && m.winner === 'B') || (!isTeamA && m.winner === 'A');

        if (wasInLoserTeam) {
            for (const winnerId of winners) {
                losesTo[winnerId] = (losesTo[winnerId] || 0) + 1;
            }
        }
    }

    let nemesisId = null;
    let maxLoses = 0;
    for (const [id, count] of Object.entries(losesTo)) {
        if (count > maxLoses) {
            maxLoses = count;
            nemesisId = id;
        }
    }

    return nemesisId ? { userId: nemesisId, count: maxLoses } : null;
}

function getTitleColor(titleName) {
    return ELO_CONFIG.TITLES[titleName]?.color || '#888';
}

// Level Emojileri (Discord Custom Emoji IDs)
const LEVEL_EMOJIS = {
    1: '<:level1:1468451643355041815>',
    2: '<:level2:1468451665265819749>',
    3: '<:level3:1468451677295345829>',
    4: '<:level4:1468451696693743729>',
    5: '<:level5:1468451709754933389>',
    6: '<:level6:1468451723071717426>',
    7: '<:level7:1468451735478472923>',
    8: '<:level8:1468451750813110312>',
    9: '<:level9:1468451768009621525>',
    10: '<:level10:1468451780777214185>'
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
    if (typeof stats.winStreak !== 'number') {
        stats.winStreak = 0;
    }
    if (typeof stats.totalMVPs !== 'number') {
        stats.totalMVPs = 0;
    }
    if (!Array.isArray(stats.titles)) {
        stats.titles = [];
    }
    // --- TITLE ATAMALARI (Otomatik Görevler) ---
    const SPECIAL_USER_ID = '315875588906680330';
    const activeTitles = stats.titles || [];

    // Herkese Başlangıç Titlesi
    if (!activeTitles.includes('Rookie')) {
        activeTitles.push('Rookie');
        if (!stats.activeTitle) stats.activeTitle = 'Rookie';
    }

    // Sana özel title
    if (user.odasi === SPECIAL_USER_ID) {
        if (!activeTitles.includes('Satchel Enjoyer')) activeTitles.push('Satchel Enjoyer');
        if (!stats.activeTitle) stats.activeTitle = 'Satchel Enjoyer';
    }

    // MVP Master (5 MVP) & Headshot Machine (25 MVP)
    if (stats.totalMVPs >= 5 && !activeTitles.includes('MVP Master')) activeTitles.push('MVP Master');
    if (stats.totalMVPs >= 25 && !activeTitles.includes('Headshot Machine')) activeTitles.push('Headshot Machine');

    // Veteran (10 Maç) & Clutch King (50 Maç)
    if (stats.totalMatches >= 10 && !activeTitles.includes('Veteran')) activeTitles.push('Veteran');
    if (stats.totalMatches >= 50 && !activeTitles.includes('Clutch King')) activeTitles.push('Clutch King');

    // On Fire (5 Seri) & Unstoppable (10 Seri)
    if (stats.winStreak >= 5 && !activeTitles.includes('On Fire')) activeTitles.push('On Fire');
    if (stats.winStreak >= 10 && !activeTitles.includes('Unstoppable')) activeTitles.push('Unstoppable');

    // Unlucky (5 Mağlubiyet Serisi)
    if (stats.winStreak <= -5 && !activeTitles.includes('Unlucky')) activeTitles.push('Unlucky');

    // Immortal (2000 ELO)
    if (stats.elo >= 2000 && !activeTitles.includes('Immortal')) activeTitles.push('Immortal');

    // Nexora Elite (Level 6)
    if (stats.matchLevel >= 6 && !activeTitles.includes('Nexora Elite')) activeTitles.push('Nexora Elite');

    stats.titles = activeTitles;
    // -------------------------------------------

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
 * @param {Object} client Discord.js Client (Rol güncelleme için)
 * @returns {Promise<Object>} Güncellenmiş user
 */
async function applyEloChange(user, change, reason = 'Unknown', client = null) {
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

    // ROL SENKRONİZASYONU (Otomatik)
    const rankHandler = require('../handlers/rankHandler');
    if (client || global.client) {
        const dClient = client || global.client;
        const guild = dClient.guilds.cache.get(user.odaId);
        if (guild) {
            try {
                const member = await guild.members.fetch(user.odasi).catch(() => null);
                if (member) {
                    await rankHandler.syncRank(member, newLevel);
                }
            } catch (e) {
                console.error(`Automatic rank sync failed for ${user.odasi}:`, e.message);
            }
        }
    }

    return user;
}

/**
 * Maç sonrası ELO değişikliğini hesapla
 * @param {Object} params Hesaplama parametreleri
 * @returns {number} Final ELO değişikliği
 */
function calculateMatchEloChange({ isWin, roundDiff, myTeamAvg, enemyTeamAvg, isMvpWinner, isMvpLoser, currentStreak = 0 }) {
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
    let reasonText = '';

    if (isWin) {
        // Kazanma: Baz + Raund Bonusu + Adalet + MVP
        finalChange = ELO_CONFIG.BASE_WIN + roundBonus + fairnessAdjustment;

        // Win Streak Bonusu
        // currentStreak, maç ÖNCESİ seri. Bu maçı kazandığı için +1 olacak.
        // Eğer (currentStreak + 1) >= 3 ise Bonus Alır.
        if ((currentStreak + 1) >= ELO_CONFIG.WIN_STREAK_THRESHOLD) {
            finalChange += ELO_CONFIG.WIN_STREAK_BONUS;
            reasonText = `Win + Streak x${currentStreak + 1}`;
        }

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
        winStreak: 0,
        elo: ELO_CONFIG.DEFAULT_ELO,
        matchLevel: ELO_CONFIG.DEFAULT_LEVEL,
        totalMVPs: 0,
        titles: [],
        activeTitle: null
    };
}

/**
 * Level için emoji döndür
 * @param {number} level 1-10
 * @returns {string} Discord emoji string
 */
function getLevelEmoji(level) {
    if (typeof level !== 'number' || level < 1) level = 1;
    if (level > 10) level = 10;
    return LEVEL_EMOJIS[level] || LEVEL_EMOJIS[1];
}

/**
 * Oyuncuları ELO'ya göre dengeli iki takıma ayır
 * Algoritma: Snake Draft (1-2-2-2-1 pattern)
 * @param {Array} players [{ odasi: string, elo: number }]
 * @returns {Object} { teamA: string[], teamB: string[] }
 */
function balanceTeams(players) {
    if (!players || players.length < 2) {
        return { teamA: [], teamB: [] };
    }

    // ELO'ya göre büyükten küçüğe sırala
    const sorted = [...players].sort((a, b) => (b.elo || 100) - (a.elo || 100));

    const teamA = [];
    const teamB = [];

    // Snake draft: Tek indexler A, çift indexler B (alternatif döngülerle ters)
    sorted.forEach((player, index) => {
        const round = Math.floor(index / 2);
        if (round % 2 === 0) {
            // Rounds 0, 2, 4... → A-B-A-B pattern
            (index % 2 === 0 ? teamA : teamB).push(player.odasi);
        } else {
            // Rounds 1, 3, 5... → B-A-B-A pattern
            (index % 2 === 0 ? teamB : teamA).push(player.odasi);
        }
    });

    return { teamA, teamB };
}

/**
 * Kullanıcının stats geçmişini (Win/Loss/Streak) maç geçmişine bakarak yeniden hesapla
 * @param {Object} user 
 */
async function recalculateStatsFromHistory(user) {
    const path = require('path');
    const { Match } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));

    // Stats.js'deki reset filtresiyle uyumlu olsun
    const MIN_MATCH_ID = '1468676273680285706';

    const matches = await Match.find({
        status: 'FINISHED',
        matchId: { $gte: MIN_MATCH_ID },
        $or: [{ teamA: user.odasi }, { teamB: user.odasi }]
    }).sort({ createdAt: 1 });

    let wins = 0;
    let losses = 0;
    let streak = 0;
    let mvps = 0;

    for (const m of matches) {
        let actualWinner = m.winner;
        if (m.scoreA !== undefined && m.scoreB !== undefined) {
            if (m.scoreA > m.scoreB) actualWinner = 'A';
            else if (m.scoreB > m.scoreA) actualWinner = 'B';
        }

        const isTeamA = m.teamA.some(id => String(id) === String(user.odasi));
        const isWin = (isTeamA && actualWinner === 'A') || (!isTeamA && actualWinner === 'B');

        if (isWin) {
            wins++;
            if (streak < 0) streak = 1;
            else streak++;
        } else {
            losses++;
            if (streak > 0) streak = -1;
            else streak--;
        }

        // MVP Check
        if (String(m.mvpPlayerId) === String(user.odasi) || String(m.mvpLoserId) === String(user.odasi)) {
            mvps++;
        }
    }

    if (!user.matchStats) user.matchStats = {};
    user.matchStats.totalMatches = wins + losses;
    user.matchStats.totalWins = wins;
    user.matchStats.totalLosses = losses;
    user.matchStats.winStreak = streak;
    user.matchStats.totalMVPs = mvps;

    await user.save();
    return user;
}

module.exports = {
    ELO_CONFIG,
    LEVEL_EMOJIS,
    getLevelFromElo,
    getLevelEmoji,
    clampElo,
    ensureValidStats,
    applyEloChange,
    calculateMatchEloChange,
    createDefaultStats,
    balanceTeams,
    recalculateStatsFromHistory,
    getTitleColor,
    calculateNemesis
};
