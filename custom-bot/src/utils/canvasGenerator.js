const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
// Match System Visuals v2.0 - Updated Leaderboard, Versus, Turn, Pick, Roster
const fs = require('fs');
const eloService = require('../services/eloService');

// --- ASSET CACHE (LRU Implementation) ---
const assetCache = new Map();
const MAX_CACHE_SIZE = 50; // Maksimum 50 resim sakla (RAM KorumasÃƒâ€Ã‚Â±)

async function loadCachedImage(imagePath) {
    if (assetCache.has(imagePath)) {
        // LRU MantÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸Ãƒâ€Ã‚Â±: Erişilen öÃƒâ€Ã…Â¸eyi silip sona ekle (En yeni yap)
        const img = assetCache.get(imagePath);
        assetCache.delete(imagePath);
        assetCache.set(imagePath, img);
        return img;
    }
    try {
        if (fs.existsSync(imagePath)) {
            const img = await loadImage(imagePath);

            // Kapasite Dolduysa En Eskiyi Sil (Map'in başÃƒâ€Ã‚Â±ndaki eleman)
            if (assetCache.size >= MAX_CACHE_SIZE) {
                const oldestKey = assetCache.keys().next().value;
                assetCache.delete(oldestKey);
            }

            assetCache.set(imagePath, img);
            return img;
        }
    } catch (e) {
        console.error("Image load error:", e);
    }
    return null;
}

const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const getLevelInfo = (elo) => {
    const level = eloService.getLevelFromElo(elo);
    const thresholds = eloService.ELO_CONFIG.LEVEL_THRESHOLDS;
    const colors = {
        1: '#00ff00', 2: '#00ff00', 3: '#00ff00',
        4: '#ffcc00', 5: '#ffcc00', 6: '#ffcc00', 7: '#ffcc00',
        8: '#ff4400', 9: '#ff4400', 10: '#ff0000'
    };
    let min = 100, max = 500;
    for (let i = 0; i < thresholds.length; i++) {
        if (thresholds[i].level === level) {
            min = i > 0 ? thresholds[i - 1].max + 1 : 100;
            max = thresholds[i].max === Infinity ? 3000 : thresholds[i].max;
            break;
        }
    }
    return { lv: level, min, max, color: colors[level] || '#ffffff' };
};

// YÃƒâ€Ã‚Â±ldÃƒâ€Ã‚Â±z Çizim Fonksiyonu (MVP için)
function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
    // Glow
    ctx.shadowColor = color;
    ctx.shadowBlur = 10;
    ctx.fill();
    ctx.shadowBlur = 0;
}

module.exports = {
    async createMatchResultImage(match, eloChanges, playersData) {
        // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
        //  NEXORA MATCH RESULT v3.0
        //  Level icons, wider layout, premium design
        // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
        const width = 1400;
        const height = 920;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ BACKGROUND (Map Image) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        let mapBg = null;
        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            const mapName = match.selectedMap || match.map || 'Unknown';
            let p = path.join(assetsPath, `${mapName}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);
            mapBg = await loadCachedImage(p);
        } catch (e) { }

        if (mapBg) {
            const scale = Math.max(width / mapBg.width, height / mapBg.height);
            const w = mapBg.width * scale;
            const h = mapBg.height * scale;
            ctx.drawImage(mapBg, (width - w) / 2, (height - h) / 2, w, h);
            ctx.fillStyle = 'rgba(6, 6, 10, 0.88)';
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, '#0a0a0f');
            bgGrad.addColorStop(1, '#06060a');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ TOP ACCENT LINE ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        const topLine = ctx.createLinearGradient(0, 0, width, 0);
        topLine.addColorStop(0, '#3b82f6');
        topLine.addColorStop(0.5, '#ffffff20');
        topLine.addColorStop(1, '#ef4444');
        ctx.fillStyle = topLine;
        ctx.fillRect(0, 0, width, 3);

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ HEADER (Score) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        const scoreA = match.scoreA ?? match.score?.A ?? 0;
        const scoreB = match.scoreB ?? match.score?.B ?? 0;
        const aWin = scoreA > scoreB;
        const bWin = scoreB > scoreA;
        const colorA = aWin ? '#3b82f6' : (bWin ? '#ef4444' : '#a1a1aa');
        const colorB = bWin ? '#3b82f6' : (aWin ? '#ef4444' : '#a1a1aa');

        // Map name
        ctx.textAlign = 'center';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.fillStyle = '#52525b';
        const mapText = (match.selectedMap || match.map || 'MAP').toUpperCase();
        ctx.fillText(mapText, width / 2, 50);

        // Scores
        ctx.font = 'bold 110px Arial, sans-serif';

        // Score A (left)
        ctx.textAlign = 'right';
        ctx.fillStyle = colorA;
        ctx.shadowColor = colorA;
        ctx.shadowBlur = 6;
        ctx.fillText(scoreA, width / 2 - 50, 160);
        ctx.shadowBlur = 0;

        // Dash
        ctx.textAlign = 'center';
        ctx.fillStyle = '#3f3f46';
        ctx.fillText(':', width / 2, 155);

        // Score B (right)
        ctx.textAlign = 'left';
        ctx.fillStyle = colorB;
        ctx.shadowColor = colorB;
        ctx.shadowBlur = 6;
        ctx.fillText(scoreB, width / 2 + 50, 160);
        ctx.shadowBlur = 0;

        // WINNER pill badge under the winning score
        if (aWin || bWin) {
            const winnerX = aWin ? width / 2 - 100 : width / 2 + 100;
            const pillW = 90;
            const pillH = 24;
            const pillY = 175;
            ctx.beginPath();
            ctx.roundRect(winnerX - pillW / 2, pillY, pillW, pillH, 12);
            ctx.fillStyle = 'rgba(46, 204, 113, 0.15)';
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(winnerX - pillW / 2, pillY, pillW, pillH, 12);
            ctx.strokeStyle = 'rgba(46, 204, 113, 0.4)';
            ctx.lineWidth = 1;
            ctx.stroke();
            ctx.font = 'bold 13px Arial, sans-serif';
            ctx.fillStyle = '#2ecc71';
            ctx.textAlign = 'center';
            ctx.fillText('WINNER', winnerX, pillY + 16);
        }

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ TEAM HEADERS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        const startY = 230;
        const colWidth = 580;
        const teamAX = 50;
        const teamBX = width - 50 - colWidth;

        // Team A header
        ctx.textAlign = 'left';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.fillStyle = colorA;
        ctx.fillText('TEAM A', teamAX + 10, startY);

        // Team B header
        ctx.textAlign = 'right';
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.fillStyle = colorB;
        ctx.fillText('TEAM B', teamBX + colWidth - 10, startY);

        // Divider lines under headers
        const divGradA = ctx.createLinearGradient(teamAX, 0, teamAX + colWidth, 0);
        divGradA.addColorStop(0, colorA);
        divGradA.addColorStop(1, 'transparent');
        ctx.fillStyle = divGradA;
        ctx.fillRect(teamAX, startY + 12, colWidth, 2);

        const divGradB = ctx.createLinearGradient(teamBX, 0, teamBX + colWidth, 0);
        divGradB.addColorStop(0, 'transparent');
        divGradB.addColorStop(1, colorB);
        ctx.fillStyle = divGradB;
        ctx.fillRect(teamBX, startY + 12, colWidth, 2);

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ PLAYER ROWS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        const safeEloChanges = Array.isArray(eloChanges) ? eloChanges : [];
        const rowH = 90;
        const rowGap = 10;

        const drawPlayerRow = async (userId, x, y, isRightAlign, teamColor) => {
            const user = playersData[userId] || { username: 'Unknown' };
            const eloLog = safeEloChanges.find(l => l.userId === userId) || { change: 0, newElo: 100 };
            const lvlInfo = getLevelInfo(eloLog.newElo);
            const mvpPlayer = match.mvpPlayerId || match.mvp;
            const mvpLoser = match.mvpLoserId || match.loserMvp;
            const isMvp = (mvpPlayer === userId) || (mvpLoser === userId);

            // Row background
            ctx.beginPath();
            ctx.roundRect(x, y, colWidth, rowH, 10);
            const rowGrad = ctx.createLinearGradient(x, y, x + colWidth, y);
            if (isRightAlign) {
                rowGrad.addColorStop(0, 'rgba(15, 15, 20, 0.3)');
                rowGrad.addColorStop(1, 'rgba(15, 15, 20, 0.7)');
            } else {
                rowGrad.addColorStop(0, 'rgba(15, 15, 20, 0.7)');
                rowGrad.addColorStop(1, 'rgba(15, 15, 20, 0.3)');
            }
            ctx.fillStyle = rowGrad;
            ctx.fill();

            // MVP highlight
            if (isMvp) {
                ctx.beginPath();
                ctx.roundRect(x, y, colWidth, rowH, 10);
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.globalAlpha = 0.6;
                ctx.stroke();
                ctx.globalAlpha = 1;

                // MVP glow
                const mvpGlow = ctx.createRadialGradient(
                    isRightAlign ? x + colWidth : x, y + rowH / 2, 0,
                    isRightAlign ? x + colWidth : x, y + rowH / 2, 200
                );
                mvpGlow.addColorStop(0, 'rgba(251, 191, 36, 0.04)');
                mvpGlow.addColorStop(1, 'transparent');
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(x, y, colWidth, rowH, 10);
                ctx.clip();
                ctx.fillStyle = mvpGlow;
                ctx.fillRect(x, y, colWidth, rowH);
                ctx.restore();
            }

            // Layout positions based on alignment
            if (!isRightAlign) {
                // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ LEFT SIDE (Team A) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
                // Level Icon
                const iconSize = 42;
                const iconX = x + 14;
                const iconY = y + (rowH - iconSize) / 2;
                try {
                    const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                    if (fs.existsSync(iconPath)) {
                        const icon = await loadCachedImage(iconPath);
                        if (icon) {
                            ctx.shadowColor = lvlInfo.color;
                            ctx.shadowBlur = 6;
                            ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
                            ctx.shadowBlur = 0;
                        }
                    }
                } catch (e) { }

                // Avatar
                const avSize = 52;
                const avX = iconX + iconSize + 10;
                const avY = y + (rowH - avSize) / 2;
                ctx.beginPath();
                ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 3, 0, Math.PI * 2);
                ctx.fillStyle = lvlInfo.color;
                ctx.globalAlpha = 0.5;
                ctx.fill();
                ctx.globalAlpha = 1;

                if (user.avatarURL) {
                    try {
                        const av = await loadImage(user.avatarURL);
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(av, avX, avY, avSize, avSize);
                        ctx.restore();
                    } catch (e) { }
                }

                // Name
                ctx.textAlign = 'left';
                ctx.font = 'bold 24px Arial, sans-serif';
                ctx.fillStyle = '#ffffff';
                let name = (user.username || 'Unknown').toUpperCase();
                if (name.length > 13) name = name.substring(0, 13) + '..';
                const nameX = avX + avSize + 15;
                ctx.fillText(name, nameX, y + rowH / 2 - 2);

                // MVP Star next to name
                if (isMvp) {
                    const nameW = ctx.measureText(name).width;
                    drawStar(ctx, nameX + nameW + 15, y + rowH / 2 - 6, 5, 10, 5, '#fbbf24');
                    ctx.font = 'bold 14px Arial, sans-serif';
                    ctx.fillStyle = '#fbbf24';
                    ctx.fillText('MVP', nameX + nameW + 30, y + rowH / 2 - 1);
                }

                // ELO info (under name)
                ctx.font = '15px Arial, sans-serif';
                ctx.fillStyle = '#52525b';
                ctx.fillText(`LVL ${lvlInfo.lv}  •  ${eloLog.newElo} ELO`, nameX, y + rowH / 2 + 18);

                // ELO change (far right)
                const changeText = eloLog.change > 0 ? `+${eloLog.change}` : `${eloLog.change}`;
                const changeColor = eloLog.change >= 0 ? '#2ecc71' : '#ef4444';
                ctx.textAlign = 'right';
                ctx.font = 'bold 26px Arial, sans-serif';
                ctx.fillStyle = changeColor;
                ctx.fillText(changeText, x + colWidth - 20, y + rowH / 2 + 8);

            } else {
                // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ RIGHT SIDE (Team B) ÃƒÂ¢Ã¢â€šÂ¬Ã¢â‚¬Â mirrored ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
                // ELO change (far left)
                const changeText = eloLog.change > 0 ? `+${eloLog.change}` : `${eloLog.change}`;
                const changeColor = eloLog.change >= 0 ? '#2ecc71' : '#ef4444';
                ctx.textAlign = 'left';
                ctx.font = 'bold 26px Arial, sans-serif';
                ctx.fillStyle = changeColor;
                ctx.fillText(changeText, x + 20, y + rowH / 2 + 8);

                // Level Icon (right side)
                const iconSize = 42;
                const iconX = x + colWidth - iconSize - 14;
                const iconY = y + (rowH - iconSize) / 2;
                try {
                    const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                    if (fs.existsSync(iconPath)) {
                        const icon = await loadCachedImage(iconPath);
                        if (icon) {
                            ctx.shadowColor = lvlInfo.color;
                            ctx.shadowBlur = 6;
                            ctx.drawImage(icon, iconX, iconY, iconSize, iconSize);
                            ctx.shadowBlur = 0;
                        }
                    }
                } catch (e) { }

                // Avatar (before icon)
                const avSize = 52;
                const avX = iconX - avSize - 10;
                const avY = y + (rowH - avSize) / 2;
                ctx.beginPath();
                ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 3, 0, Math.PI * 2);
                ctx.fillStyle = lvlInfo.color;
                ctx.globalAlpha = 0.5;
                ctx.fill();
                ctx.globalAlpha = 1;

                if (user.avatarURL) {
                    try {
                        const av = await loadImage(user.avatarURL);
                        ctx.save();
                        ctx.beginPath();
                        ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
                        ctx.clip();
                        ctx.drawImage(av, avX, avY, avSize, avSize);
                        ctx.restore();
                    } catch (e) { }
                }

                // Name (right aligned, before avatar)
                ctx.textAlign = 'right';
                ctx.font = 'bold 24px Arial, sans-serif';
                ctx.fillStyle = '#ffffff';
                let name = (user.username || 'Unknown').toUpperCase();
                if (name.length > 13) name = name.substring(0, 13) + '..';
                const nameX = avX - 15;
                ctx.fillText(name, nameX, y + rowH / 2 - 2);

                // MVP Star
                if (isMvp) {
                    const nameW = ctx.measureText(name).width;
                    drawStar(ctx, nameX - nameW - 15, y + rowH / 2 - 6, 5, 10, 5, '#fbbf24');
                    ctx.font = 'bold 14px Arial, sans-serif';
                    ctx.fillStyle = '#fbbf24';
                    ctx.textAlign = 'right';
                    ctx.fillText('MVP', nameX - nameW - 28, y + rowH / 2 - 1);
                }

                // ELO info
                ctx.textAlign = 'right';
                ctx.font = '15px Arial, sans-serif';
                ctx.fillStyle = '#52525b';
                ctx.fillText(`LVL ${lvlInfo.lv}  •  ${eloLog.newElo} ELO`, nameX, y + rowH / 2 + 18);
            }
        };

        // Draw Team A (Left)
        let curY = startY + 30;
        const teamAVector = match.teamA || match.teams?.A || [];
        for (const userId of teamAVector) {
            await drawPlayerRow(userId, teamAX, curY, false, colorA);
            curY += rowH + rowGap;
        }

        // Draw Team B (Right)
        curY = startY + 30;
        const teamBVector = match.teamB || match.teams?.B || [];
        for (const userId of teamBVector) {
            await drawPlayerRow(userId, teamBX, curY, true, colorB);
            curY += rowH + rowGap;
        }

        // Center divider line
        const centerDivGrad = ctx.createLinearGradient(0, startY + 30, 0, height - 80);
        centerDivGrad.addColorStop(0, 'transparent');
        centerDivGrad.addColorStop(0.3, '#27272a');
        centerDivGrad.addColorStop(0.7, '#27272a');
        centerDivGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = centerDivGrad;
        ctx.fillRect(width / 2 - 1, startY + 30, 2, height - startY - 110);

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ FOOTER ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
        ctx.fillRect(0, height - 55, width, 55);

        // Footer divider
        const footDiv = ctx.createLinearGradient(0, 0, width, 0);
        footDiv.addColorStop(0, '#3b82f640');
        footDiv.addColorStop(0.5, '#27272a');
        footDiv.addColorStop(1, '#ef444440');
        ctx.fillStyle = footDiv;
        ctx.fillRect(0, height - 55, width, 1);

        ctx.font = '16px Arial, sans-serif';
        ctx.fillStyle = '#3f3f46';
        ctx.textAlign = 'left';
        ctx.fillText(`MATCH #${match.matchId || match.matchNumber || 'N/A'}`, 30, height - 22);

        ctx.textAlign = 'center';
        ctx.fillStyle = '#27272a';
        ctx.fillText('NEXORA RANKED', width / 2, height - 22);

        ctx.textAlign = 'right';
        ctx.fillStyle = '#3f3f46';
        ctx.fillText(new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }), width - 30, height - 22);

        return canvas.toBuffer('image/png');
    },

    async createEloCard(user, stats, rank) {
        const width = 1200;
        const height = 450;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        const elo = stats.elo !== undefined ? stats.elo : 100;
        const levelData = getLevelInfo(elo);
        const rankColor = levelData.color;

        const currentBg = user.backgroundImage || 'Default';
        let bgImg = null;
        if (currentBg !== 'Default') {
            try {
                const themeConfig = eloService.ELO_CONFIG.BACKGROUND_THEMES[currentBg];
                const fileName = themeConfig ? themeConfig.path : `${currentBg}.png`;
                const mapPath = path.join(__dirname, '..', '..', 'assets', 'maps', fileName);
                if (fs.existsSync(mapPath)) bgImg = await loadCachedImage(mapPath);
            } catch (e) { }
        }

        if (bgImg) {
            const scale = Math.max(width / bgImg.width, height / bgImg.height);
            const w = bgImg.width * scale;
            const h = bgImg.height * scale;
            ctx.drawImage(bgImg, (width - w) / 2, (height - h) / 2, w, h);
            ctx.fillStyle = 'rgba(9, 9, 11, 0.85)'; // Overlay for readability
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGradient = ctx.createLinearGradient(0, 0, width, height);
            bgGradient.addColorStop(0, '#18181b');
            bgGradient.addColorStop(1, '#09090b');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);
        }

        const r = parseInt(rankColor.slice(1, 3), 16);
        const g = parseInt(rankColor.slice(3, 5), 16);
        const b = parseInt(rankColor.slice(5, 7), 16);

        const glow = ctx.createRadialGradient(width * 0.9, height * 0.5, 0, width * 0.9, height * 0.5, 500);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = rankColor;
        ctx.fillRect(0, 0, 10, height);

        // â”€â”€â”€ AVATAR (CENTERED) â”€â”€â”€
        const avatarSize = 100;
        const avatarX = 200;
        const avatarY = 50;
        if (user.avatar) {
            try {
                const av = await loadImage(user.avatar);
                // Level-colored glow ring
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 5, 0, Math.PI * 2);
                ctx.strokeStyle = rankColor;
                ctx.lineWidth = 3;
                ctx.shadowColor = rankColor;
                ctx.shadowBlur = 12;
                ctx.stroke();
                ctx.shadowBlur = 0;
                // Circular avatar clip
                ctx.save();
                ctx.beginPath();
                ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(av, avatarX, avatarY, avatarSize, avatarSize);
                ctx.restore();
            } catch (e) { }
        }

        // â”€â”€â”€ LEVEL ICON (overlapping avatar bottom-right) â”€â”€â”€
        const lvlIconSize = 44;
        const lvlIconX = avatarX + avatarSize - lvlIconSize / 2 + 4;
        const lvlIconY = avatarY + avatarSize - lvlIconSize / 2 + 4;
        try {
            const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${levelData.lv}.png`);
            if (fs.existsSync(iconPath)) {
                const icon = await loadImage(iconPath);
                ctx.beginPath();
                ctx.arc(lvlIconX + lvlIconSize / 2, lvlIconY + lvlIconSize / 2, lvlIconSize / 2 + 3, 0, Math.PI * 2);
                ctx.fillStyle = '#18181b';
                ctx.fill();
                ctx.drawImage(icon, lvlIconX, lvlIconY, lvlIconSize, lvlIconSize);
            }
        } catch (e) { }

        // â”€â”€â”€ NAME (lowercase, smooth font) â”€â”€â”€
        const textX = 340;
        ctx.font = '600 52px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
        const nameX = textX;
        ctx.fillStyle = '#ffffff';
        let name = user.username || 'Unknown';
        if (name.length > 15) name = name.substring(0, 15) + '...';
        ctx.fillText(name, nameX, 85);

        // â”€â”€â”€ TITLE PILL BADGE â”€â”€â”€
        if (stats.activeTitle) {
            const titleColor = eloService.getTitleColor(stats.activeTitle);
            const titleText = stats.activeTitle.toUpperCase();
            ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
            const titleW = ctx.measureText(titleText).width;
            const pillW = titleW + 24;
            const pillH = 26;
            const pillX = nameX;
            const pillY = 96;
            // Parse title color for rgba
            const tr = parseInt(titleColor.slice(1, 3), 16);
            const tg = parseInt(titleColor.slice(3, 5), 16);
            const tb = parseInt(titleColor.slice(5, 7), 16);
            // Badge background
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, 13);
            ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.15)`;
            ctx.fill();
            // Badge border
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, 13);
            ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.4)`;
            ctx.lineWidth = 1;
            ctx.stroke();
            // Badge text
            ctx.fillStyle = titleColor;
            ctx.fillText(titleText, pillX + 12, pillY + 18);
        }

        // â”€â”€â”€ PROGRESS BAR â”€â”€â”€
        const progressY = 145;
        const barWidth = 750;
        const barHeight = 12;
        let progress = 0;
        if (levelData.lv < 10) {
            const range = levelData.max - levelData.min;
            const current = elo - levelData.min;
            progress = range > 0 ? current / range : 0;
            progress = Math.min(1, Math.max(0, progress));
        } else { progress = 1; }

        // Bar track (rounded)
        ctx.beginPath();
        ctx.roundRect(textX, progressY, barWidth, barHeight, 6);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
        ctx.fill();

        // Bar fill
        if (progress > 0) {
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(textX, progressY, barWidth, barHeight, 6);
            ctx.clip();
            ctx.fillStyle = rankColor;
            ctx.shadowColor = rankColor;
            ctx.shadowBlur = 10;
            ctx.fillRect(textX, progressY, barWidth * progress, barHeight);
            ctx.shadowBlur = 0;
            ctx.restore();
        }

        // ELO text
        ctx.font = '600 28px "Segoe UI", Arial, sans-serif';
        ctx.fillStyle = '#cccccc';
        const eloText = `${elo} ELO (#${rank || 'Unranked'})`;
        ctx.fillText(eloText, textX, progressY + 45);

        if (levelData.lv < 10) {
            ctx.textAlign = 'right';
            ctx.font = '24px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#555';
            ctx.fillText(`NEXT: ${levelData.max}`, textX + barWidth, progressY + 45);
            ctx.textAlign = 'left';
        } else {
            ctx.textAlign = 'right';
            ctx.font = 'bold 24px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = rankColor;
            ctx.fillText('MAX LEVEL', textX + barWidth, progressY + 45);
            ctx.textAlign = 'left';
        }

        // â”€â”€â”€ STAT BOXES (centered, rounded) â”€â”€â”€
        const statsY = 250;
        const boxWidth = 175;
        const boxHeight = 120;
        const gap = 14;
        const totalBoxesWidth = 4 * boxWidth + 3 * gap;
        const boxStartX = textX;
        const drawStatBox = (idx, label, value, color = '#fff') => {
            const x = boxStartX + (idx * (boxWidth + gap));
            // Rounded box bg
            ctx.beginPath();
            ctx.roundRect(x, statsY, boxWidth, boxHeight, 12);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.fill();
            ctx.beginPath();
            ctx.roundRect(x, statsY, boxWidth, boxHeight, 12);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.lineWidth = 1;
            ctx.stroke();
            // Value
            ctx.font = 'bold 42px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.fillText(String(value), x + boxWidth / 2, statsY + 60);
            // Label
            ctx.font = '18px "Segoe UI", Arial, sans-serif';
            ctx.fillStyle = '#666';
            ctx.fillText(label.toUpperCase(), x + boxWidth / 2, statsY + 95);
            ctx.textAlign = 'left';
        };

        const total = stats.totalMatches || 0;
        const wins = stats.totalWins || 0;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0;
        const streak = Number(stats.winStreak) || 0;
        drawStatBox(0, 'Matches', total);
        drawStatBox(1, 'Wins', wins, '#2ecc71');
        drawStatBox(2, 'Win Rate', `%${winRate}`, winRate >= 50 ? '#2ecc71' : '#e74c3c');
        drawStatBox(3, 'Streak', Math.abs(streak), streak >= 0 ? '#2ecc71' : '#e74c3c');

        return canvas.toBuffer('image/png');
    },

    async createDetailedStatsImage(user, stats, matchHistory, bestMap, favoriteTeammate, rank, nemesisData) {
        const width = 1200;
        const height = 1000; // Increased height for nemesis row

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const currentBg = user.backgroundImage || 'Default';
        let bgImgPrimary = null;
        if (currentBg !== 'Default') {
            try {
                // Config'den dosya yolunu al (örn: Vyse.jpg veya Raze.png)
                const themeConfig = eloService.ELO_CONFIG.BACKGROUND_THEMES[currentBg];
                const fileName = themeConfig ? themeConfig.path : `${currentBg}.png`;

                const mapPath = path.join(__dirname, '..', '..', 'assets', 'maps', fileName);
                if (fs.existsSync(mapPath)) bgImgPrimary = await loadCachedImage(mapPath); // loadCachedImage kullanalÃƒâ€Ã‚Â±m
            } catch (e) { }
        }

        if (bgImgPrimary) {
            const scale = Math.max(width / bgImgPrimary.width, height / bgImgPrimary.height);
            const w = bgImgPrimary.width * scale;
            const h = bgImgPrimary.height * scale;
            ctx.drawImage(bgImgPrimary, (width - w) / 2, (height - h) / 2, w, h);
            ctx.fillStyle = 'rgba(9, 9, 11, 0.9)'; // Darker overlay for detailed stats
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGradient = ctx.createLinearGradient(0, 0, width, height);
            bgGradient.addColorStop(0, '#18181b');
            bgGradient.addColorStop(1, '#09090b');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);
        }

        const lvlInfo = getLevelInfo(stats.elo !== undefined ? stats.elo : 100);
        const rankColor = lvlInfo.color;

        const r = parseInt(rankColor.slice(1, 3), 16);
        const g = parseInt(rankColor.slice(3, 5), 16);
        const b = parseInt(rankColor.slice(5, 7), 16);

        const glow = ctx.createRadialGradient(width, height / 2, 0, width, height / 2, 900);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.2)`);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        ctx.font = 'bold 30px Arial, sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('LAST MATCHES (5)', 50, 70);

        let matchY = 100;
        for (const match of matchHistory) {
            let mapBg = null;
            try {
                const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
                let p = path.join(assetsPath, `${match.map}.png`);
                if (!fs.existsSync(p)) p = path.join(assetsPath, `${match.map.toLowerCase()}.png`);
                if (!fs.existsSync(p)) p = path.join(assetsPath, `${match.map.trim()}.png`);
                if (fs.existsSync(p)) mapBg = await loadImage(p);
            } catch (e) { }

            const boxW = 500; // Harita resmini biraz küçültüyoruz ki yanÃƒâ€Ã‚Â±na yazÃƒâ€Ã‚Â± sÃƒâ€Ã‚Â±Ãƒâ€Ã…Â¸sÃƒâ€Ã‚Â±n
            const boxH = 80;
            const boxX = 50;

            if (mapBg) {
                const scale = Math.max(boxW / mapBg.width, boxH / mapBg.height);
                const w = mapBg.width * scale;
                const h = mapBg.height * scale;
                const imgX = boxX + (boxW - w) / 2;
                const imgY = matchY + (boxH - h) / 2;
                ctx.save();
                ctx.beginPath();
                ctx.rect(boxX, matchY, boxW, boxH);
                ctx.clip();

                ctx.drawImage(mapBg, imgX, imgY, w, h);

                const fade = ctx.createLinearGradient(boxX, matchY, boxX + boxW, matchY);
                fade.addColorStop(0, '#18181b');
                fade.addColorStop(0.5, '#18181b');
                fade.addColorStop(0.8, 'rgba(24, 24, 27, 0.4)');
                fade.addColorStop(1, 'rgba(24, 24, 27, 0)');
                ctx.fillStyle = fade;
                ctx.fillRect(boxX, matchY, boxW, boxH);
                ctx.restore();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.05)';
                ctx.fillRect(boxX, matchY, boxW, boxH);
            }

            const isWin = match.result === 'WIN';
            const color = isWin ? '#2ecc71' : '#e74c3c';
            const symbol = isWin ? 'W' : 'L';

            ctx.fillStyle = color;
            ctx.fillRect(50, matchY, 5, 80);

            ctx.font = 'bold 35px Arial, sans-serif';
            ctx.fillStyle = color;
            ctx.fillText(symbol, 80, matchY + 52);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 30px Arial, sans-serif';
            ctx.fillText(match.map.toUpperCase(), 140, matchY + 50);

            let detailText = match.score;

            ctx.fillStyle = '#ccc';
            ctx.font = 'bold 30px Arial, sans-serif';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
            ctx.textAlign = 'center';
            ctx.fillText(detailText, 340, matchY + 50); // Skoru map üzerinde merkeze çektik
            ctx.shadowBlur = 0;

            // ELO Change logic update: Check id as string to avoid type mismatch
            const infoX = boxX + boxW + 20;
            if (match.eloChange !== null && match.eloChange !== undefined) {
                const sign = match.eloChange > 0 ? '+' : '';
                const eloChangeText = `${sign}${match.eloChange}`;
                ctx.fillStyle = match.eloChange >= 0 ? '#2ecc71' : '#e74c3c';
                ctx.font = 'bold 32px Arial, sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(eloChangeText, infoX, matchY + 35);

                // MVP Badge (if applicable)
                if (match.isMvp) {
                    const eloWidth = ctx.measureText(eloChangeText).width;
                    ctx.fillStyle = '#fbbf24';
                    ctx.font = 'bold 18px Arial, sans-serif';
                    ctx.fillText('MVP', infoX + eloWidth + 15, matchY + 33);
                    drawStar(ctx, infoX + eloWidth + 75, matchY + 28, 5, 8, 4, '#fbbf24');
                }
            }

            // Tarih (ELO deÃƒâ€Ã…Â¸işiminin altÃƒâ€Ã‚Â±)
            ctx.font = 'italic 18px Arial, sans-serif';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'left';
            ctx.fillText(match.date, infoX, matchY + 65);
            ctx.textAlign = 'left';

            matchY += 105;
        }

        const rightX = 720;

        // --- RIGHT SIDE BOXES (Reorganized to avoid overlap) ---

        // Box 1: Best Map (Stat-based)
        if (bestMap) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 100, 430, 120);
            ctx.font = 'bold 20px Arial, sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('BEST MAP', rightX + 20, 140);
            ctx.font = 'bold 45px Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(bestMap.name.toUpperCase(), rightX + 20, 190);
            ctx.font = '30px Arial, sans-serif'; ctx.fillStyle = '#2ecc71'; ctx.textAlign = 'right'; ctx.fillText(`%${bestMap.wr} WR`, rightX + 410, 190); ctx.textAlign = 'left';
        } else {
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 100, 430, 120);
            ctx.font = 'bold 20px Arial, sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('BEST MAP', rightX + 20, 140);
            ctx.font = 'bold 35px Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText('NO DATA', rightX + 20, 190);
        }

        // Box 2: Favorite Duo
        if (favoriteTeammate) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 240, 430, 120);
            ctx.font = 'bold 20px Arial, sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('PLAYED MOST TEAMMATE', rightX + 20, 280);
            if (favoriteTeammate.avatarURL) {
                try {
                    const avatar = await loadImage(favoriteTeammate.avatarURL);
                    ctx.save(); ctx.beginPath(); ctx.arc(rightX + 60, 320, 35, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(avatar, rightX + 25, 285, 70, 70); ctx.restore();
                } catch (e) { }
            }
            ctx.fillStyle = '#fff';
            let duoName = favoriteTeammate.username.toUpperCase();
            if (duoName.length > 15) ctx.font = 'bold 25px Arial, sans-serif';
            else if (duoName.length > 10) ctx.font = 'bold 30px Arial, sans-serif';
            else ctx.font = 'bold 35px Arial, sans-serif';
            ctx.fillText(duoName, rightX + 110, 330);
        }

        // Box 3: Win Rate
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 380, 430, 120);
        const w = stats.totalWins || 0; const l = stats.totalLosses || 0; const mtotal = w + l;
        const wr_val = mtotal > 0 ? Math.round((w / mtotal) * 100) : 0;
        ctx.font = 'bold 20px Arial, sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('WIN RATE (SEASON)', rightX + 20, 420);
        ctx.font = 'bold 50px Arial, sans-serif'; ctx.fillStyle = wr_val >= 50 ? '#2ecc71' : '#e74c3c'; ctx.fillText(`%${wr_val}`, rightX + 20, 470);
        ctx.font = '30px Arial, sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(`${w}W / ${l}L`, rightX + 410, 470); ctx.textAlign = 'left';

        // Total MVPs
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 520, 430, 120);
        ctx.font = 'bold 20px Arial, sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('TOTAL MVPs', rightX + 20, 560);
        ctx.font = 'bold 55px Arial, sans-serif'; ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = 'rgba(251, 191, 36, 0.3)'; ctx.shadowBlur = 15;
        ctx.fillText(String(stats.totalMVPs || 0), rightX + 20, 615);
        ctx.shadowBlur = 0;
        // Icon
        drawStar(ctx, rightX + 380, 580, 5, 25, 12, '#fbbf24');

        // Ezeli Rakip (Nemesis)
        if (nemesisData) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 660, 430, 120);
            ctx.font = 'bold 20px Arial, sans-serif'; ctx.fillStyle = '#ef4444'; ctx.fillText('EZELİ RAKİP', rightX + 20, 700);
            if (nemesisData.avatarURL) {
                try {
                    const av = await loadImage(nemesisData.avatarURL);
                    ctx.save(); ctx.beginPath(); ctx.arc(rightX + 60, 740, 35, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(av, rightX + 25, 705, 70, 70); ctx.restore();
                } catch (e) { }
            }
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 30px Arial, sans-serif';
            let nName = nemesisData.username.toUpperCase();
            if (nName.length > 12) nName = nName.substring(0, 10) + '..';
            ctx.fillText(nName, rightX + 110, 750);
            ctx.font = 'bold 24px Arial, sans-serif'; ctx.fillStyle = '#ef4444'; ctx.textAlign = 'right';
            ctx.fillText(`${nemesisData.count} KEZ YENDİ`, rightX + 410, 750); ctx.textAlign = 'left';
        }

        // --- FOOTER (User Info & Rank) ---
        const footerY = 880; // Adjusted for new height
        const footerBgStart = footerY - 20;
        const footerHeight = height - footerBgStart;
        const footerMid = footerBgStart + (footerHeight / 2);

        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(0, footerBgStart, width, footerHeight);
        ctx.textBaseline = 'middle';

        if (user.avatar) {
            try {
                const avatar = await loadImage(user.avatar);
                ctx.save(); ctx.beginPath(); ctx.arc(80, footerMid, 40, 0, Math.PI * 2); ctx.clip();
                ctx.drawImage(avatar, 40, footerMid - 40, 80, 80); ctx.restore();
            } catch (e) { }
        }
        ctx.font = '600 52px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
        let nameX = 140;
        if (rank) {
            ctx.fillStyle = '#666'; ctx.fillText(`#${rank}`, nameX, footerMid - (stats.activeTitle ? 15 : 0));
            const rankWidth = ctx.measureText(`#${rank}`).width; nameX += rankWidth + 15;
        }
        ctx.fillStyle = '#fff';
        let mainName = user.username ? user.username.toLowerCase() : 'unknown';
        if (mainName.length > 15) mainName = mainName.substring(0, 15) + '...';
        ctx.fillText(mainName, nameX, footerMid - (stats.activeTitle ? 15 : 0));

        // Active title pill badge (same style as /elo & top10)
        let footerTitlePillW = 0;
        if (stats.activeTitle) {
            const titleColor = eloService.getTitleColor(stats.activeTitle);
            const titleText = stats.activeTitle.toUpperCase();
            ctx.font = 'bold 18px Arial, sans-serif';
            const titleW = ctx.measureText(titleText).width;
            const pillW = titleW + 24;
            const pillH = 26;
            const pillX = 140;
            const pillY = footerMid + 12;
            footerTitlePillW = pillW;

            const tr = parseInt(titleColor.slice(1, 3), 16);
            const tg = parseInt(titleColor.slice(3, 5), 16);
            const tb = parseInt(titleColor.slice(5, 7), 16);

            // Badge background
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, 13);
            ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.15)`;
            ctx.fill();

            // Badge border
            ctx.beginPath();
            ctx.roundRect(pillX, pillY, pillW, pillH, 13);
            ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.4)`;
            ctx.lineWidth = 1;
            ctx.stroke();

            // Badge text (centered)
            ctx.fillStyle = titleColor;
            const textY = pillY + (pillH / 2) + 6;
            ctx.fillText(titleText, pillX + 12, textY);
        }

        // ÃƒÂ¢Ã‚ÂÃ‚Â³ Ãƒâ€Ã‚Â°NAKTÃƒâ€Ã‚Â°F BADGE
        if (stats.isInactive) {
            const badgeText = '⏳ İNAKTİF';
            ctx.font = 'bold 18px Arial, sans-serif';
            const badgeWidth = ctx.measureText(badgeText).width + 20;
            const baseX = 140 + (footerTitlePillW > 0 ? footerTitlePillW + 16 : 0);
            const badgeX = baseX;
            const badgeY = footerMid + 12;

            // Badge background (pill shape)
            ctx.fillStyle = 'rgba(255, 107, 53, 0.2)';
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeWidth, 26, 13);
            ctx.fill();

            // Badge border
            ctx.strokeStyle = '#FF6B35';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.roundRect(badgeX, badgeY, badgeWidth, 26, 13);
            ctx.stroke();

            // Badge text
            ctx.fillStyle = '#FF6B35';
            ctx.shadowColor = '#FF6B35';
            ctx.shadowBlur = 8;
            ctx.fillText(badgeText, badgeX + 10, badgeY + 19);
            ctx.shadowBlur = 0;
        }

        ctx.textAlign = 'right';
        ctx.font = 'bold 50px Arial, sans-serif';
        const eloText = `${stats.elo !== undefined ? stats.elo : 100} ELO`;
        const eloX = width - 50;
        const eloWidth = ctx.measureText(eloText).width;
        const iconSize = 80;
        const iconX = eloX - eloWidth - iconSize - 30;

        ctx.shadowBlur = 0;
        ctx.fillStyle = '#fff';
        ctx.fillText(eloText, eloX, footerMid);

        try {
            const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
            if (fs.existsSync(iconPath)) {
                const icon = await loadImage(iconPath);
                ctx.drawImage(icon, iconX, footerMid - (iconSize / 2), iconSize, iconSize);
            }
        } catch (e) { }
        return canvas.toBuffer('image/png');
    },

    async createTitlesGuideImage() {
        // --- PREMIUM TITLES GUIDE v2 (Modern & Turkish) ---
        const width = 1100;
        const titlesArr = Object.entries(eloService.ELO_CONFIG.TITLES);
        const rowHeight = 100;
        const height = 250 + (titlesArr.length * rowHeight);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background (Deep Dark)
        const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
        bgGrad.addColorStop(0, '#0c0c0e');
        bgGrad.addColorStop(0.5, '#121214');
        bgGrad.addColorStop(1, '#0c0c0e');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Grid Pattern
        ctx.save();
        ctx.globalAlpha = 0.05;
        ctx.strokeStyle = '#ffffff';
        for (let i = 0; i < width; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke(); }
        for (let j = 0; j < height; j += 50) { ctx.beginPath(); ctx.moveTo(0, j); ctx.lineTo(width, j); ctx.stroke(); }
        ctx.restore();

        // Header
        ctx.font = 'bold 70px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 30;
        ctx.fillText('NEXORA TITLE\'S', width / 2, 100);
        ctx.shadowBlur = 0;

        ctx.font = '24px Arial, sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText('Maçlardaki performansına göre nadir ünvanlar kazan!', width / 2, 150);

        // Accent Bar
        ctx.fillStyle = '#fbbf24';
        ctx.fillRect(width / 2 - 100, 180, 200, 4);

        // Rows
        let y = 260;
        for (const [name, data] of titlesArr) {
            const rowX = 80;
            const rowW = width - 160;

            // Box
            ctx.fillStyle = 'rgba(255,255,255,0.02)';
            ctx.beginPath();
            ctx.roundRect(rowX, y - 50, rowW, 80, 10);
            ctx.fill();

            // Glow & Indicator
            ctx.shadowColor = data.color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = data.color;
            ctx.fillRect(rowX, y - 50, 6, 80);
            ctx.shadowBlur = 0;

            // Title Name
            ctx.textAlign = 'left';
            ctx.font = 'bold 32px Arial, sans-serif';
            ctx.fillStyle = data.color;
            ctx.fillText(name.toUpperCase(), rowX + 40, y);

            // Description
            ctx.textAlign = 'right';
            ctx.font = 'italic 22px Arial, sans-serif';
            ctx.fillStyle = '#d4d4d8';
            ctx.fillText(data.description, rowX + rowW - 40, y);

            y += rowHeight;
            ctx.fillStyle = '#fff';
        }

        return canvas.toBuffer('image/png');
    },

    async createMatchImage(data) {
        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        // 1. Background
        let bgImg = null;
        if (data.map) {
            try {
                const mapPath = path.join(__dirname, '..', '..', 'assets', 'maps', `${data.map}.png`);
                if (fs.existsSync(mapPath)) bgImg = await loadImage(mapPath);
            } catch (e) { }
        }

        if (bgImg) {
            const scale = Math.max(width / bgImg.width, height / bgImg.height);
            const w = bgImg.width * scale;
            const h = bgImg.height * scale;
            ctx.drawImage(bgImg, (width - w) / 2, (height - h) / 2, w, h);
            ctx.fillStyle = 'rgba(9, 9, 11, 0.85)'; // Dark overlay
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, '#0c0c0e');
            bgGrad.addColorStop(1, '#18181b');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }

        // 2. Center Text (Map & VS)
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(255,255,255,0.3)';
        ctx.shadowBlur = 20;

        ctx.font = 'bold 150px Arial, sans-serif';
        ctx.fillText((data.map || 'UNKNOWN').toUpperCase(), width / 2, 250);

        ctx.font = 'bold 60px Arial, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('FRANKFURT', width / 2, 330);

        // Center Diamond & VS
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-100, -100, 200, 200);
        ctx.restore();

        ctx.font = 'bold 120px Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('VS', width / 2, height / 2 + 40);
        ctx.shadowBlur = 0; // Reset shadow after VS

        // 3. Side Headers
        ctx.font = 'bold 40px Arial, sans-serif';
        ctx.letterSpacing = '10px';

        ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'left';
        ctx.fillText('SALDIRI', 150, 150);
        ctx.fillRect(150, 170, 300, 2);

        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'right';
        ctx.fillText('SAVUNMA', width - 150, 150);
        ctx.fillRect(width - 450, 170, 300, 2);

        // 4. Player Cards
        const drawPlayerCard = async (player, x, y, isRight) => {
            const cardW = 500;
            const cardH = 120;
            const drawX = isRight ? x - cardW : x;

            // Simple Sleek Background
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.beginPath();
            ctx.roundRect(drawX, y, cardW, cardH, 5);
            ctx.fill();

            // Custom Level Icon from faceitsekli
            const lvlInfo = getLevelInfo(player.elo || 200);
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    const iSize = 85;
                    const iX = isRight ? drawX + 15 : drawX + cardW - 15 - iSize;
                    const iY = y + (cardH - iSize) / 2;
                    ctx.drawImage(icon, iX, iY, iSize, iSize);
                }
            } catch (e) { }

            // Name & Title (Arial Bold)
            ctx.textAlign = isRight ? 'right' : 'left';
            const textX = isRight ? drawX + cardW - 30 : drawX + 30;

            // Dynamic Font Scaling for Long Names
            let fontSize = 34;
            const maxNameWidth = 350;
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            let nameWidth = ctx.measureText(player.name.toUpperCase()).width;

            while (nameWidth > maxNameWidth && fontSize > 18) {
                fontSize -= 2;
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                nameWidth = ctx.measureText(player.name.toUpperCase()).width;
            }

            ctx.fillStyle = '#fff';
            ctx.fillText(player.name.toUpperCase(), textX, y + 55);

            // Connect to Title System (activeTitle)
            const playerTitle = (player.activeTitle || player.title || 'OYUNCU').toUpperCase();
            ctx.font = '20px Arial, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.globalAlpha = 0.7;
            ctx.fillText(playerTitle, textX, y + 90);
            ctx.globalAlpha = 1;
        };

        let playerY = 200;
        for (const p of data.teamA) {
            await drawPlayerCard(p, 50, playerY, false);
            playerY += 140;
        }

        playerY = 200;
        for (const p of data.teamB) {
            await drawPlayerCard(p, width - 50, playerY, true);
            playerY += 140;
        }

        return canvas.toBuffer('image/png');
    },

    async createCompareImage(user1, stats1, user2, stats2, currentBg = 'Default') {
        const width = 1200;
        const height = 700;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Arkaplan
        let bgImg = null;
        if (currentBg !== 'Default') {
            try {
                const themeConfig = eloService.ELO_CONFIG.BACKGROUND_THEMES[currentBg];
                const fileName = themeConfig ? themeConfig.path : `${currentBg}.png`;
                const mapPath = path.join(__dirname, '..', '..', 'assets', 'maps', fileName);
                if (fs.existsSync(mapPath)) bgImg = await loadCachedImage(mapPath);
            } catch (e) { }
        }

        if (bgImg) {
            const scale = Math.max(width / bgImg.width, height / bgImg.height);
            const w = bgImg.width * scale;
            const h = bgImg.height * scale;
            ctx.drawImage(bgImg, (width - w) / 2, (height - h) / 2, w, h);
            ctx.fillStyle = 'rgba(9, 9, 11, 0.85)'; // Dark overlay
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
            bgGrad.addColorStop(0, '#0c0c0e');
            bgGrad.addColorStop(1, '#18181b');
            ctx.fillStyle = bgGrad;
            ctx.fillRect(0, 0, width, height);
        }

        ctx.font = '50px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.fillText('VS', width / 2, height / 2 + 20);

        const drawUserSide = async (user, stats, x, isRight) => {
            const sideWidth = 450;
            const startX = isRight ? width - sideWidth - 50 : 50;
            const avatarSize = 130;
            const midX = startX + sideWidth / 2;
            const lvlInfo = getLevelInfo(stats.elo !== undefined ? stats.elo : 100);
            const rankColor = lvlInfo.color;
            const rc = parseInt(rankColor.slice(1, 3), 16);
            const gc = parseInt(rankColor.slice(3, 5), 16);
            const bc = parseInt(rankColor.slice(5, 7), 16);

            // Avatar with glow ring
            if (user.avatar) {
                try {
                    const av = await loadImage(user.avatar);
                    // Glow ring
                    ctx.beginPath();
                    ctx.arc(midX, 190, avatarSize / 2 + 5, 0, Math.PI * 2);
                    ctx.strokeStyle = rankColor;
                    ctx.lineWidth = 3;
                    ctx.shadowColor = rankColor;
                    ctx.shadowBlur = 15;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                    // Circular clip
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(midX, 190, avatarSize / 2, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(av, midX - avatarSize / 2, 190 - avatarSize / 2, avatarSize, avatarSize);
                    ctx.restore();
                } catch (e) { }
            }

            // Level icon (overlapping avatar bottom-right)
            const lvlIconSize = 40;
            const lvlIconX = midX + avatarSize / 2 - lvlIconSize / 2 - 5;
            const lvlIconY = 190 + avatarSize / 2 - lvlIconSize / 2 - 5;
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    ctx.beginPath();
                    ctx.arc(lvlIconX + lvlIconSize / 2, lvlIconY + lvlIconSize / 2, lvlIconSize / 2 + 3, 0, Math.PI * 2);
                    ctx.fillStyle = '#18181b';
                    ctx.fill();
                    ctx.drawImage(icon, lvlIconX, lvlIconY, lvlIconSize, lvlIconSize);
                }
            } catch (e) { }

            // Name
            ctx.font = '600 52px "Segoe UI", "Helvetica Neue", Arial, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.textAlign = 'center';
            let name = user.username ? user.username.toLowerCase() : 'unknown';
            if (name.length > 15) name = name.substring(0, 15) + '...';
            ctx.fillText(name, midX, 300);

            // Title pill badge
            if (stats.activeTitle) {
                const titleColor = eloService.getTitleColor(stats.activeTitle);
                const titleText = stats.activeTitle.toUpperCase();
                ctx.font = 'bold 14px "Segoe UI", Arial, sans-serif';
                const titleW = ctx.measureText(titleText).width;
                const pillW = titleW + 24;
                const pillH = 26;
                const pillX = midX - pillW / 2;
                const pillY = 310;
                const tr = parseInt(titleColor.slice(1, 3), 16);
                const tg = parseInt(titleColor.slice(3, 5), 16);
                const tb = parseInt(titleColor.slice(5, 7), 16);
                // Badge bg
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, 13);
                ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.15)`;
                ctx.fill();
                // Badge border
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, 13);
                ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.4)`;
                ctx.lineWidth = 1;
                ctx.stroke();
                // Badge text
                ctx.textAlign = 'center';
                ctx.fillStyle = titleColor;
                ctx.fillText(titleText, midX, pillY + 18);
            }

            const statsY = 400;
            const statRow = (label, value, idx, isWinner) => {
                const y = statsY + (idx * 60);
                const rectW = 350;
                const rectX = midX - rectW / 2;

                ctx.fillStyle = isWinner ? 'rgba(46, 204, 113, 0.1)' : 'rgba(255,255,255,0.02)';
                ctx.beginPath(); ctx.roundRect(rectX, y - 40, rectW, 50, 8); ctx.fill();

                if (isWinner) {
                    ctx.strokeStyle = '#2ecc71'; ctx.lineWidth = 1; ctx.stroke();
                }

                ctx.font = 'bold 18px "Segoe UI", Arial, sans-serif';
                ctx.fillStyle = '#666';
                ctx.textAlign = isRight ? 'right' : 'left';
                ctx.fillText(label.toUpperCase(), isRight ? rectX + rectW - 20 : rectX + 20, y - 7);

                ctx.font = 'bold 26px "Segoe UI", Arial, sans-serif';
                ctx.fillStyle = isWinner ? '#2ecc71' : '#fff';
                ctx.textAlign = isRight ? 'left' : 'right';
                ctx.fillText(String(value), isRight ? rectX + 20 : rectX + rectW - 20, y - 7);
            };

            const wr1 = stats.totalMatches > 0 ? (stats.totalWins / stats.totalMatches) * 100 : 0;
            const wr2 = stats2.totalMatches > 0 ? (stats2.totalWins / stats2.totalMatches) * 100 : 0;

            statRow('ELO', stats.elo, 0, stats.elo >= stats2.elo);
            statRow('Ma\u00e7', stats.totalMatches, 1, stats.totalMatches >= stats2.totalMatches);
            statRow('WR', `%${Math.round(wr1)}`, 2, wr1 >= wr2);
            statRow('MVP', stats.totalMVPs || 0, 3, (stats.totalMVPs || 0) >= (stats2.totalMVPs || 0));
        };

        await drawUserSide(user1, stats1, 0, false);
        await drawUserSide(user2, stats2, 0, true);

        return canvas.toBuffer('image/png');
    },

    async createLeaderboardImage(users) {
        // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
        //  NEXORA PREMIUM LEADERBOARD v3.0
        //  Wider layout, prominent level icons, ELO progress bars
        // ÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚ÂÃƒÂ¢Ã¢â‚¬Â¢Ã‚Â
        const width = 2800;
        const rowHeight = 220;
        const gap = 25;
        const headerHeight = 360;
        const footerHeight = 100;

        const height = headerHeight + (users.length * (rowHeight + gap)) + footerHeight + 20;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ BACKGROUND ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
        bgGradient.addColorStop(0, '#06060a');
        bgGradient.addColorStop(0.3, '#0c0c12');
        bgGradient.addColorStop(0.7, '#0a0a0f');
        bgGradient.addColorStop(1, '#06060a');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Subtle diagonal lines pattern
        ctx.save();
        ctx.globalAlpha = 0.02;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        for (let i = -height; i < width + height; i += 80) {
            ctx.beginPath();
            ctx.moveTo(i, 0);
            ctx.lineTo(i + height, height);
            ctx.stroke();
        }
        ctx.restore();

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ HEADER ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        // Top accent line
        const accentGrad = ctx.createLinearGradient(0, 0, width, 0);
        accentGrad.addColorStop(0, 'transparent');
        accentGrad.addColorStop(0.3, '#ef4444');
        accentGrad.addColorStop(0.5, '#ff6b6b');
        accentGrad.addColorStop(0.7, '#ef4444');
        accentGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = accentGrad;
        ctx.fillRect(0, 0, width, 4);

        // Header glow
        const headerGlow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, 600);
        headerGlow.addColorStop(0, 'rgba(239, 68, 68, 0.08)');
        headerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = headerGlow;
        ctx.fillRect(0, 0, width, headerHeight);

        // Title
        ctx.textAlign = 'center';
        ctx.font = 'bold 130px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
        ctx.shadowBlur = 40;
        ctx.fillText('LEADERBOARD', width / 2, 170);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = '42px Arial, sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.fillText(`SEASON 1  ·  TOP ${users.length} PLAYERS`, width / 2, 235);

        // Accent bar
        const barGrad = ctx.createLinearGradient(width / 2 - 120, 0, width / 2 + 120, 0);
        barGrad.addColorStop(0, 'transparent');
        barGrad.addColorStop(0.2, '#ef4444');
        barGrad.addColorStop(0.8, '#ef4444');
        barGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = barGrad;
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 15;
        ctx.fillRect(width / 2 - 120, 270, 240, 5);
        ctx.shadowBlur = 0;

        // Column headers
        ctx.font = 'bold 22px Arial, sans-serif';
        ctx.fillStyle = '#52525b';
        ctx.textAlign = 'left';
        ctx.fillText('RANK', 120, 330);
        ctx.fillText('LEVEL', 280, 330);
        ctx.fillText('PLAYER', 530, 330);
        ctx.textAlign = 'center';
        ctx.fillText('WINS', width - 820, 330);
        ctx.fillText('LOSSES', width - 620, 330);
        ctx.fillText('WIN RATE', width - 420, 330);
        ctx.textAlign = 'right';
        ctx.fillText('ELO POINTS', width - 100, 330);
        ctx.textAlign = 'left';

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ ROWS ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        let y = headerHeight;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const rank = i + 1;
            const stats = user.matchStats || { elo: 100, totalWins: 0, totalLosses: 0 };
            const lvlInfo = getLevelInfo(stats.elo);

            const cardX = 60;
            const cardW = width - 120;

            // Theme colors
            let isTop3 = false;
            let themeColor = '#3f3f46';
            let glowColor = 'transparent';
            let rankFontColor = '#52525b';

            if (rank === 1) {
                isTop3 = true;
                themeColor = '#fbbf24';
                glowColor = 'rgba(251, 191, 36, 0.15)';
                rankFontColor = '#fbbf24';
            } else if (rank === 2) {
                isTop3 = true;
                themeColor = '#d1d5db';
                glowColor = 'rgba(209, 213, 219, 0.1)';
                rankFontColor = '#d1d5db';
            } else if (rank === 3) {
                isTop3 = true;
                themeColor = '#d97706';
                glowColor = 'rgba(217, 119, 6, 0.12)';
                rankFontColor = '#d97706';
            }

            // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ Card Background ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
            ctx.beginPath();
            ctx.roundRect(cardX, y, cardW, rowHeight, 16);

            if (isTop3) {
                // Colored gradient bg for top 3
                const cardGrad = ctx.createLinearGradient(cardX, y, cardX + cardW, y);
                cardGrad.addColorStop(0, 'rgba(18, 18, 22, 0.95)');
                cardGrad.addColorStop(0.5, 'rgba(14, 14, 18, 0.98)');
                cardGrad.addColorStop(1, 'rgba(18, 18, 22, 0.95)');
                ctx.fillStyle = cardGrad;
                ctx.fill();

                // Left side color glow
                const sideGlow = ctx.createRadialGradient(cardX, y + rowHeight / 2, 0, cardX, y + rowHeight / 2, 400);
                sideGlow.addColorStop(0, glowColor);
                sideGlow.addColorStop(1, 'transparent');
                ctx.save();
                ctx.beginPath();
                ctx.roundRect(cardX, y, cardW, rowHeight, 16);
                ctx.clip();
                ctx.fillStyle = sideGlow;
                ctx.fillRect(cardX, y, cardW, rowHeight);
                ctx.restore();

                // Border
                ctx.beginPath();
                ctx.roundRect(cardX, y, cardW, rowHeight, 16);
                ctx.lineWidth = 2;
                ctx.strokeStyle = themeColor;
                ctx.globalAlpha = 0.5;
                ctx.stroke();
                ctx.globalAlpha = 1;

                // Left accent bar
                ctx.fillStyle = themeColor;
                ctx.shadowColor = themeColor;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.roundRect(cardX, y + 15, 8, rowHeight - 30, 4);
                ctx.fill();
                ctx.shadowBlur = 0;
            } else {
                // Normal card
                const cardGrad = ctx.createLinearGradient(cardX, y, cardX + cardW, y);
                cardGrad.addColorStop(0, '#111114');
                cardGrad.addColorStop(1, '#0d0d10');
                ctx.fillStyle = cardGrad;
                ctx.fill();

                // Subtle left bar (level color)
                ctx.fillStyle = lvlInfo.color;
                ctx.globalAlpha = 0.4;
                ctx.beginPath();
                ctx.roundRect(cardX, y + 20, 6, rowHeight - 40, 3);
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 1. Rank Number ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
            ctx.textAlign = 'center';
            ctx.font = 'bold 80px Arial, sans-serif';
            ctx.fillStyle = rankFontColor;
            if (isTop3) {
                ctx.shadowColor = themeColor;
                ctx.shadowBlur = 15;
            }
            ctx.fillText(`#${rank}`, cardX + 110, y + rowHeight / 2 + 28);
            ctx.shadowBlur = 0;

            // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 2. Level Icon (PROMINENT) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
            const lvlIconSize = 120;
            const lvlIconX = cardX + 200;
            const lvlIconY = y + (rowHeight - lvlIconSize) / 2;

            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadCachedImage(iconPath);
                    if (icon) {
                        // Icon glow
                        ctx.shadowColor = lvlInfo.color;
                        ctx.shadowBlur = 25;
                        ctx.drawImage(icon, lvlIconX, lvlIconY, lvlIconSize, lvlIconSize);
                        ctx.shadowBlur = 0;
                    }
                }
            } catch (e) { }

            // Level number label under the icon
            ctx.font = 'bold 20px Arial, sans-serif';
            ctx.fillStyle = lvlInfo.color;
            ctx.textAlign = 'center';
            ctx.fillText(`LVL ${lvlInfo.lv}`, lvlIconX + lvlIconSize / 2, lvlIconY + lvlIconSize + 22);

            // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 3. Avatar ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
            const avSize = 100;
            const avX = cardX + 370;
            const avY = y + (rowHeight - avSize) / 2 - 5;

            // Avatar ring
            ctx.beginPath();
            ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 4, 0, Math.PI * 2);
            ctx.fillStyle = isTop3 ? themeColor : lvlInfo.color;
            ctx.globalAlpha = isTop3 ? 0.8 : 0.4;
            ctx.fill();
            ctx.globalAlpha = 1;

            if (user.avatarURL) {
                try {
                    const av = await loadImage(user.avatarURL);
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(av, avX, avY, avSize, avSize);
                    ctx.restore();
                } catch (e) { }
            }

            // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 4. Username ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
            const nameX = avX + avSize + 35;
            ctx.textAlign = 'left';
            ctx.font = 'bold 52px Arial, sans-serif';
            ctx.fillStyle = '#ffffff';
            let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
            if (name.length > 14) name = name.substring(0, 14) + '..';
            ctx.fillText(name, nameX, y + rowHeight / 2 + 5);

            // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 5. ELO Progress Bar (under name) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
            const barX = nameX;
            const barY = y + rowHeight / 2 + 22;
            const barW = 280;
            const barH = 8;
            let progress = 0;

            if (lvlInfo.lv < 10) {
                const range = lvlInfo.max - lvlInfo.min;
                const current = stats.elo - lvlInfo.min;
                progress = range > 0 ? Math.min(1, Math.max(0, current / range)) : 0;
            } else {
                progress = 1;
            }

            // Bar background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
            ctx.beginPath();
            ctx.roundRect(barX, barY, barW, barH, 4);
            ctx.fill();

            // Bar fill
            if (progress > 0) {
                const fillGrad = ctx.createLinearGradient(barX, barY, barX + barW * progress, barY);
                fillGrad.addColorStop(0, lvlInfo.color);
                fillGrad.addColorStop(1, hexToRgba(lvlInfo.color, 0.6));
                ctx.fillStyle = fillGrad;
                ctx.beginPath();
                ctx.roundRect(barX, barY, barW * progress, barH, 4);
                ctx.fill();
            }

            // Progress text
            ctx.font = '18px Arial, sans-serif';
            ctx.fillStyle = '#52525b';
            ctx.fillText(`${stats.elo} / ${lvlInfo.lv < 10 ? lvlInfo.max : 'MAX'}`, barX + barW + 12, barY + 8);

            // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 6. Stats Boxes ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
            const w = stats.totalWins || 0;
            const l = stats.totalLosses || 0;
            const t = w + l;
            const wr = t > 0 ? Math.round((w / t) * 100) : 0;

            const statBoxW = 140;
            const statBoxH = 80;
            const statsAreaX = width - 900;
            const statBoxY = y + (rowHeight - statBoxH) / 2;

            // Wins Box
            ctx.fillStyle = 'rgba(46, 204, 113, 0.06)';
            ctx.beginPath();
            ctx.roundRect(statsAreaX, statBoxY, statBoxW, statBoxH, 10);
            ctx.fill();
            ctx.font = 'bold 42px Arial, sans-serif';
            ctx.fillStyle = '#2ecc71';
            ctx.textAlign = 'center';
            ctx.fillText(`${w}`, statsAreaX + statBoxW / 2, statBoxY + 45);
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillStyle = '#2ecc7180';
            ctx.fillText('WINS', statsAreaX + statBoxW / 2, statBoxY + 70);

            // Losses Box
            const lossBoxX = statsAreaX + statBoxW + 30;
            ctx.fillStyle = 'rgba(239, 68, 68, 0.06)';
            ctx.beginPath();
            ctx.roundRect(lossBoxX, statBoxY, statBoxW, statBoxH, 10);
            ctx.fill();
            ctx.font = 'bold 42px Arial, sans-serif';
            ctx.fillStyle = '#ef4444';
            ctx.fillText(`${l}`, lossBoxX + statBoxW / 2, statBoxY + 45);
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillStyle = '#ef444480';
            ctx.fillText('LOSSES', lossBoxX + statBoxW / 2, statBoxY + 70);

            // Win Rate Box
            const wrBoxX = lossBoxX + statBoxW + 30;
            const wrColor = wr >= 50 ? '#2ecc71' : '#e74c3c';
            ctx.fillStyle = wr >= 50 ? 'rgba(46, 204, 113, 0.06)' : 'rgba(231, 76, 60, 0.06)';
            ctx.beginPath();
            ctx.roundRect(wrBoxX, statBoxY, statBoxW + 20, statBoxH, 10);
            ctx.fill();
            ctx.font = 'bold 42px Arial, sans-serif';
            ctx.fillStyle = wrColor;
            ctx.fillText(`${wr}%`, wrBoxX + (statBoxW + 20) / 2, statBoxY + 45);
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillStyle = `${wrColor}80`;
            ctx.fillText('WIN RATE', wrBoxX + (statBoxW + 20) / 2, statBoxY + 70);

            // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ 7. ELO (Far Right) ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
            const eloX = width - 110;
            ctx.textAlign = 'right';
            ctx.font = 'bold 72px Arial, sans-serif';
            ctx.fillStyle = isTop3 ? themeColor : '#ffffff';
            if (isTop3) {
                ctx.shadowColor = themeColor;
                ctx.shadowBlur = 20;
            }
            ctx.fillText(`${stats.elo}`, eloX, y + rowHeight / 2 + 10);
            ctx.shadowBlur = 0;

            ctx.font = 'bold 22px Arial, sans-serif';
            ctx.fillStyle = isTop3 ? `${themeColor}90` : '#52525b';
            ctx.fillText('ELO', eloX, y + rowHeight / 2 + 40);

            y += rowHeight + gap;
        }

        // ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ FOOTER ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬ÃƒÂ¢Ã¢â‚¬ÂÃ¢â€šÂ¬
        // Divider line
        const footerDivGrad = ctx.createLinearGradient(0, y + 10, width, y + 10);
        footerDivGrad.addColorStop(0, 'transparent');
        footerDivGrad.addColorStop(0.3, '#27272a');
        footerDivGrad.addColorStop(0.7, '#27272a');
        footerDivGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = footerDivGrad;
        ctx.fillRect(0, y + 10, width, 1);

        ctx.textAlign = 'center';
        ctx.font = '28px Arial, sans-serif';
        ctx.fillStyle = '#3f3f46';
        ctx.fillText('NEXORA RANKED SYSTEM  •  DEVELOPED BY SWAFF', width / 2, height - 30);

        return canvas.toBuffer('image/png');
    },

    async createLobbySetupImage(data) {
        // data: { matchNumber, lobbyName, captainA: { name, avatar, elo }, captainB: { name, avatar, elo } }
        const width = 1200;
        const height = 450;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Dark Modern Background
        ctx.fillStyle = '#0a0a0c';
        ctx.fillRect(0, 0, width, height);

        // Subtle Grid
        ctx.strokeStyle = '#ffffff05';
        ctx.lineWidth = 1;
        for (let i = 0; i < width; i += 50) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke(); }
        for (let i = 0; i < height; i += 50) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke(); }

        // Center Split Line
        const gradSplit = ctx.createLinearGradient(0, 0, 0, height);
        gradSplit.addColorStop(0, 'transparent');
        gradSplit.addColorStop(0.5, '#ffffff20');
        gradSplit.addColorStop(1, 'transparent');
        ctx.strokeStyle = gradSplit;
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(width / 2, 50); ctx.lineTo(width / 2, height - 50); ctx.stroke();

        // Header Info
        ctx.textAlign = 'center';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 50px Arial, sans-serif';
        ctx.fillText(`MATCH #${data.matchNumber}`, width / 2, 80);
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.fillText(data.lobbyName.toUpperCase(), width / 2, 110);

        // Draw Captain Helper
        const drawCap = async (cap, isLeft) => {
            const x = isLeft ? width * 0.25 : width * 0.75;
            const y = height / 2 + 30;
            const color = isLeft ? '#3b82f6' : '#ef4444';

            ctx.shadowBlur = 20;
            ctx.shadowColor = cap ? color : 'rgba(0,0,0,0)';

            ctx.fillStyle = '#18181b';
            ctx.beginPath(); ctx.arc(x, y - 50, 85, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            if (cap) {
                if (cap.avatar) {
                    try {
                        const avatarImg = await loadImage(cap.avatar);
                        ctx.save();
                        ctx.beginPath(); ctx.arc(x, y - 50, 80, 0, Math.PI * 2); ctx.clip();
                        ctx.drawImage(avatarImg, x - 80, y - 50 - 80, 160, 160);
                        ctx.restore();
                    } catch (e) { }
                }

                ctx.strokeStyle = color;
                ctx.lineWidth = 5;
                ctx.beginPath(); ctx.arc(x, y - 50, 82, 0, Math.PI * 2); ctx.stroke();

                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 30px Arial, sans-serif';
                ctx.fillText(cap.name.toUpperCase().substring(0, 15), x, y + 80);

                const lvInfo = getLevelInfo(cap.elo || 200);
                ctx.font = 'bold 24px Arial, sans-serif';
                ctx.fillStyle = lvInfo.color;
                ctx.fillText(`LV.${lvInfo.lv} • ${cap.elo} ELO`, x, y + 115);
            } else {
                ctx.strokeStyle = '#27272a';
                ctx.setLineDash([8, 6]);
                ctx.beginPath(); ctx.arc(x, y - 50, 82, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#3f3f46';
                ctx.font = 'bold 26px Arial, sans-serif';
                ctx.fillText(isLeft ? "TEAM A CAPTAIN" : "TEAM B CAPTAIN", x, y + 80);
                ctx.font = 'bold 22px Arial, sans-serif';
                ctx.fillText("WAITING...", x, y + 110);
            }
        };

        await drawCap(data.captainA, true);
        await drawCap(data.captainB, false);

        return canvas.toBuffer('image/png');
    },

    // --- ADVANCED MATCH VISUALIZATIONS ---

    async createVersusImage(captainA, captainB, mapName) {
        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Map Background
        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            let p = path.join(assetsPath, `${mapName}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (fs.existsSync(p)) {
                const bg = await loadImage(p);
                ctx.drawImage(bg, 0, 0, width, height);
            } else {
                ctx.fillStyle = '#1e1e2e'; ctx.fillRect(0, 0, width, height);
            }
        } catch (e) {
            ctx.fillStyle = '#1e1e2e'; ctx.fillRect(0, 0, width, height);
        }

        // 2. Overlays (Diagonal Split)
        // Global Darken
        ctx.fillStyle = 'rgba(0,0,0,0.4)'; ctx.fillRect(0, 0, width, height);

        // Team A Side (Left - Blueish)
        const gradA = ctx.createLinearGradient(0, 0, width / 2, height);
        gradA.addColorStop(0, 'rgba(56, 189, 248, 0.4)'); // Sky Blue
        gradA.addColorStop(1, 'rgba(30, 58, 138, 0.6)'); // Dark Blue

        ctx.beginPath();
        ctx.moveTo(0, 0); ctx.lineTo(width / 2 + 100, 0);
        ctx.lineTo(width / 2 - 100, height); ctx.lineTo(0, height);
        ctx.fillStyle = gradA; ctx.fill();

        // Team B Side (Right - Reddish)
        const gradB = ctx.createLinearGradient(width / 2, 0, width, height);
        gradB.addColorStop(0, 'rgba(248, 113, 113, 0.4)'); // Red
        gradB.addColorStop(1, 'rgba(153, 27, 27, 0.6)'); // Dark Red

        ctx.beginPath();
        ctx.moveTo(width / 2 + 100, 0); ctx.lineTo(width, 0);
        ctx.lineTo(width, height); ctx.lineTo(width / 2 - 100, height);
        ctx.fillStyle = gradB; ctx.fill();

        // VS Separator Line
        ctx.lineWidth = 15;
        ctx.strokeStyle = '#fff';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.moveTo(width / 2 + 100, -10);
        ctx.lineTo(width / 2 - 100, height + 10);
        ctx.stroke();
        ctx.shadowBlur = 0;

        // VS Text
        ctx.textAlign = 'center';
        ctx.font = 'bold italic 150px Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 30;
        ctx.fillText("VS", width / 2, height / 2 + 50);
        ctx.shadowBlur = 0;

        // --- DRAW CAPTAINS ---
        const drawCaptain = async (captain, isLeft) => {
            const cx = isLeft ? width * 0.25 : width * 0.75;
            const cy = height / 2;
            const align = isLeft ? 'left' : 'right';

            // Avatar Glow
            const glowColor = isLeft ? '#38bdf8' : '#f87171';

            // Avatar
            const avatarSize = 300;
            const user = captain.user || {};
            const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 512 }) :
                (user.avatarURL ? user.avatarURL : user.avatar);

            if (avatarUrl) {
                try {
                    const avatar = await loadImage(avatarUrl);
                    ctx.save();
                    ctx.beginPath(); ctx.arc(cx, cy - 50, avatarSize / 2, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(avatar, cx - avatarSize / 2, cy - 50 - avatarSize / 2, avatarSize, avatarSize);
                    ctx.restore();

                    // Ring
                    ctx.beginPath(); ctx.arc(cx, cy - 50, avatarSize / 2, 0, Math.PI * 2);
                    ctx.lineWidth = 10; ctx.strokeStyle = glowColor;
                    ctx.shadowColor = glowColor; ctx.shadowBlur = 30;
                    ctx.stroke();
                    ctx.shadowBlur = 0;
                } catch (e) { }
            }

            // Name
            const name = captain.name ? captain.name.toUpperCase() : (user.username ? user.username.toUpperCase() : 'UNKNOWN');
            ctx.textAlign = 'center';
            ctx.font = 'bold 80px Arial, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
            ctx.fillText(name, cx, cy + 160);

            // ELO & Level
            const stats = captain.stats || { elo: 100 };
            const lvlInfo = getLevelInfo(stats.elo);

            ctx.font = 'bold 50px Arial, sans-serif';
            ctx.fillStyle = '#ddd';
            ctx.fillText(`${stats.elo} ELO`, cx, cy + 220);

            // Level Icon
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    const iSize = 80;
                    ctx.drawImage(icon, cx - iSize / 2, cy + 240, iSize, iSize);
                }
            } catch (e) { }
        };

        if (captainA) await drawCaptain(captainA, true);
        if (captainB) await drawCaptain(captainB, false);

        return canvas.toBuffer('image/png');
    },

    async createMapVetoImage(mapStates, selectedMap, statusText) {
        const maps = Object.keys(mapStates);
        const cardW = 220;
        const cardH = 320;
        const gap = 30;

        const totalWidth = maps.length * (cardW + gap) + 100;
        const width = Math.max(1200, totalWidth);
        const height = 600;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        const grad = ctx.createLinearGradient(0, 0, 0, height);
        grad.addColorStop(0, '#0f172a');
        grad.addColorStop(1, '#020617');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.textAlign = 'center';
        ctx.font = 'bold 60px Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText(statusText || "MAP VETO RESULTS", width / 2, 80);

        const startX = (width - (maps.length * (cardW + gap) - gap)) / 2;

        for (let i = 0; i < maps.length; i++) {
            const mapName = maps[i];
            const state = mapStates[mapName];
            const isSelected = mapName === selectedMap;
            const x = startX + i * (cardW + gap);
            const y = 180;

            // Map Image
            try {
                const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
                let p = path.join(assetsPath, `${mapName}.png`);
                if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

                if (fs.existsSync(p)) {
                    const img = await loadImage(p);
                    ctx.save();
                    ctx.beginPath();
                    ctx.roundRect(x, y, cardW, cardH, 20);
                    ctx.clip();

                    if (state.banned && !isSelected) {
                        ctx.filter = 'grayscale(100%) brightness(0.3)';
                    }

                    ctx.drawImage(img, x, y, cardW, cardH);
                    ctx.restore();
                }
            } catch (e) { }

            // Border
            ctx.strokeStyle = isSelected ? '#3b82f6' : (state.banned ? '#ef4444' : '#52525b');
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.roundRect(x, y, cardW, cardH, 20);
            ctx.stroke();

            // Status Text
            ctx.font = 'bold 24px Arial, sans-serif';
            ctx.textAlign = 'center';
            if (isSelected) {
                ctx.fillStyle = '#3b82f6';
                ctx.fillText("SELECTED", x + cardW / 2, y + cardH + 40);
            } else if (state.banned) {
                ctx.fillStyle = '#ef4444';
                ctx.fillText("BANNED", x + cardW / 2, y + cardH + 40);
            }

            // Map Name Overlay
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(x, y + cardH - 60, cardW, 60);
            ctx.fillStyle = '#fff';
            ctx.font = 'bold 28px Arial, sans-serif';
            ctx.fillText(mapName.toUpperCase(), x + cardW / 2, y + cardH - 20);
        }

        return canvas.toBuffer('image/png');
    },

    async createWheelResult(winner, loser) {
        const { createCanvas, loadImage } = require('@napi-rs/canvas');
        const width = 800;
        const height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Arka Plan (Dark)
        ctx.fillStyle = '#2B2D31';
        ctx.fillRect(0, 0, width, height);

        // Kazanan Efekti (Gradient)
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        const winColor = winner.team === 'A' ? 'rgba(52, 152, 219, ' : 'rgba(231, 76, 60, '; // Blue or Red
        gradient.addColorStop(0, winColor + '0.2)');
        gradient.addColorStop(0.5, 'rgba(0,0,0,0)');
        gradient.addColorStop(1, winColor + '0.1)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 30px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('KURA SONUCU', width / 2, 50);

        // WINNER Avatar
        const avSize = 120;
        const avX = (width / 2) - (avSize / 2);
        const avY = 100;

        ctx.save();
        ctx.beginPath();
        ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();

        // Avatar Load
        try {
            const avatarUrl = winner.user.displayAvatarURL ? winner.user.displayAvatarURL({ extension: 'png', forceStatic: true }) : null;
            if (avatarUrl) {
                const avatar = await loadImage(avatarUrl);
                ctx.drawImage(avatar, avX, avY, avSize, avSize);
            }
        } catch (e) { }
        ctx.restore();

        // Border Colors
        ctx.beginPath();
        ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2);
        ctx.lineWidth = 5;
        ctx.strokeStyle = winner.team === 'A' ? '#3498DB' : '#E74C3C';
        ctx.stroke();

        // Winner Text
        ctx.fillStyle = winner.team === 'A' ? '#3498DB' : '#E74C3C'; // Team Color
        ctx.font = 'bold 50px Arial, sans-serif';
        ctx.fillText(winner.name.toUpperCase(), width / 2, 280);

        // Subtext
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '30px Arial, sans-serif';
        ctx.fillText('SEÇİM HAKKINI KAZANDI', width / 2, 330);

        return canvas.toBuffer('image/png');
    },

    async createDuelImage(captainA, captainB, winnerId) {
        const width = 1200;
        const height = 600;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Dark Gradient Background
        const bg = ctx.createLinearGradient(0, 0, width, height);
        bg.addColorStop(0, '#0a0a0c');
        bg.addColorStop(1, '#18181b');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // VS Pattern
        ctx.globalAlpha = 0.05;
        ctx.textAlign = 'center';
        ctx.font = 'bold 300px Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText("VS", width / 2, height / 2 + 100);
        ctx.globalAlpha = 1.0;

        const drawDuelist = async (cap, isLeft) => {
            const isWinner = cap.id === winnerId;
            const x = isLeft ? 300 : 900;
            const y = height / 2;
            const teamColor = isLeft ? '#3b82f6' : '#ef4444';

            if (isWinner) {
                const glow = ctx.createRadialGradient(x, y, 0, x, y, 400);
                glow.addColorStop(0, hexToRgba(teamColor, 0.2));
                glow.addColorStop(1, 'transparent');
                ctx.fillStyle = glow;
                ctx.fillRect(isLeft ? 0 : 600, 0, 600, height);
            }

            // Avatar
            const avSize = 250;
            ctx.save();
            ctx.beginPath(); ctx.arc(x, y - 50, avSize / 2, 0, Math.PI * 2); ctx.clip();
            if (cap.avatar) {
                try {
                    const img = await loadImage(cap.avatar);
                    ctx.drawImage(img, x - avSize / 2, y - 50 - avSize / 2, avSize, avSize);
                } catch (e) { }
            }
            ctx.restore();

            // Ring
            ctx.beginPath(); ctx.arc(x, y - 50, avSize / 2 + 5, 0, Math.PI * 2);
            ctx.lineWidth = 8;
            ctx.strokeStyle = isWinner ? teamColor : '#27272a';
            if (isWinner) { ctx.shadowColor = teamColor; ctx.shadowBlur = 20; }
            ctx.stroke();
            ctx.shadowBlur = 0;

            // Name
            ctx.textAlign = 'center';
            ctx.font = 'bold 50px Arial, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(cap.name.toUpperCase(), x, y + 150);

            if (isWinner) {
                ctx.font = 'bold 40px Arial, sans-serif';
                ctx.fillStyle = '#f1c40f'; // Gold
                ctx.fillText("WINNER", x, y - 190);
                // Mini Crown Emoji or similar would be nice but let's stick to text
            }
        };

        await drawDuelist(captainA, true);
        await drawDuelist(captainB, false);

        // Center Text
        ctx.textAlign = 'center';
        ctx.font = 'bold italic 60px Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 20;
        ctx.fillText("DUEL", width / 2, height / 2 + 30);

        return canvas.toBuffer('image/png');
    },

    async createSideSelectionImage(captainA, captainB, selectorId, mapName) {
        const width = 1280;
        const height = 720;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Full Map Background
        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            let p = path.join(assetsPath, `${mapName}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (fs.existsSync(p)) {
                const img = await loadImage(p);
                const scale = Math.max(width / img.width, height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
            } else {
                ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, width, height);
            }
        } catch (e) { ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, width, height); }

        // 2. Dark Cinematic Overlay
        ctx.fillStyle = 'rgba(0,0,0,0.75)';
        ctx.fillRect(0, 0, width, height);

        // 3. Team Color Gradients (Subtle side glow)
        const gradL = ctx.createRadialGradient(0, height / 2, 0, 0, height / 2, 500);
        gradL.addColorStop(0, 'rgba(239, 68, 68, 0.25)');
        gradL.addColorStop(1, 'transparent');
        ctx.fillStyle = gradL; ctx.fillRect(0, 0, width / 2, height);

        const gradR = ctx.createRadialGradient(width, height / 2, 0, width, height / 2, 500);
        gradR.addColorStop(0, 'rgba(59, 130, 246, 0.25)');
        gradR.addColorStop(1, 'transparent');
        ctx.fillStyle = gradR; ctx.fillRect(width / 2, 0, width / 2, height);

        // 4. Header Section
        ctx.textAlign = 'center';

        // Map name (smaller, above)
        ctx.font = 'bold 28px Arial, sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.letterSpacing = '8px';
        ctx.fillText(mapName.toUpperCase(), width / 2, 60);

        // Main Title with glow
        ctx.font = 'bold 72px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255,255,255,0.3)'; ctx.shadowBlur = 30;
        ctx.fillText("CHOOSE YOUR SIDE", width / 2, 140);
        ctx.shadowBlur = 0;

        // 5. Modern Choice Cards
        const cardW = 380;
        const cardH = 320;
        const cardY = 200;
        const attackX = 100;
        const defendX = width - 100 - cardW;

        const drawModernCard = (label, x, primaryColor, secondaryColor, icon) => {
            // Outer Glow
            ctx.shadowColor = primaryColor;
            ctx.shadowBlur = 40;

            // Glassmorphism Background
            const cardGrad = ctx.createLinearGradient(x, cardY, x + cardW, cardY + cardH);
            cardGrad.addColorStop(0, 'rgba(20, 20, 30, 0.9)');
            cardGrad.addColorStop(1, 'rgba(30, 30, 45, 0.8)');

            ctx.fillStyle = cardGrad;
            ctx.beginPath(); ctx.roundRect(x, cardY, cardW, cardH, 24); ctx.fill();
            ctx.shadowBlur = 0;

            // Gradient Border
            ctx.lineWidth = 4;
            const borderGrad = ctx.createLinearGradient(x, cardY, x + cardW, cardY + cardH);
            borderGrad.addColorStop(0, primaryColor);
            borderGrad.addColorStop(1, secondaryColor);
            ctx.strokeStyle = borderGrad;
            ctx.stroke();

            // Icon Circle
            const iconRadius = 50;
            const iconX = x + cardW / 2;
            const iconY = cardY + 90;

            // Icon glow
            ctx.shadowColor = primaryColor; ctx.shadowBlur = 20;
            ctx.fillStyle = 'rgba(0,0,0,0.5)';
            ctx.beginPath(); ctx.arc(iconX, iconY, iconRadius, 0, Math.PI * 2); ctx.fill();
            ctx.shadowBlur = 0;

            ctx.strokeStyle = primaryColor;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Icon Symbol (Sword for Attack, Shield for Defend)
            ctx.font = 'bold 48px Arial, sans-serif';
            ctx.fillStyle = primaryColor;
            ctx.textAlign = 'center';
            ctx.fillText(icon, iconX, iconY + 16);

            // Label
            ctx.font = 'bold 52px Arial, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = primaryColor; ctx.shadowBlur = 15;
            ctx.fillText(label, x + cardW / 2, cardY + 200);
            ctx.shadowBlur = 0;

            // Subtitle
            ctx.font = '20px Arial, sans-serif';
            ctx.fillStyle = '#a1a1aa';
            ctx.fillText(label === 'ATTACK' ? 'First Half Attackers' : 'First Half Defenders', x + cardW / 2, cardY + 240);

            // Hover hint
            ctx.font = 'bold 16px Arial, sans-serif';
            ctx.fillStyle = primaryColor;
            ctx.globalAlpha = 0.7;
            ctx.fillText('CLICK TO SELECT', x + cardW / 2, cardY + cardH - 30);
            ctx.globalAlpha = 1;
        };

        drawModernCard('ATTACK', attackX, '#ef4444', '#dc2626', 'ATK');
        drawModernCard('DEFEND', defendX, '#3b82f6', '#2563eb', 'DEF');

        // 6. Center "VS" Divider
        ctx.textAlign = 'center';
        ctx.font = 'bold italic 80px Arial, sans-serif';
        ctx.fillStyle = '#27272a';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
        ctx.fillText('VS', width / 2, cardY + cardH / 2 + 20);
        ctx.shadowBlur = 0;

        // 7. Selector Info (Bottom)
        const selectorName = (selectorId === captainA.id) ? captainA.name : captainB.name;
        const selectorColor = (selectorId === captainA.id) ? '#3b82f6' : '#ef4444';

        // Background bar
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(0, height - 100, width, 100);

        // Accent line
        ctx.fillStyle = selectorColor;
        ctx.fillRect(0, height - 100, width, 3);

        // Selector text
        ctx.font = 'bold 32px Arial, sans-serif';
        ctx.fillStyle = selectorColor;
        ctx.shadowColor = selectorColor; ctx.shadowBlur = 15;
        ctx.fillText(`${selectorName.toUpperCase()}'S TURN TO CHOOSE`, width / 2, height - 45);
        ctx.shadowBlur = 0;

        return canvas.toBuffer('image/png');
    },

    async createMatchLiveImage(match, teamAData, teamBData) {
        // teamAData: { captain: { name, avatar, elo }, players: [{ name, avatar, elo }] }
        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Background (Map)
        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            const mapName = match.selectedMap || 'Unknown';
            let p = path.join(assetsPath, `${mapName}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (fs.existsSync(p)) {
                const img = await loadImage(p);
                const scale = Math.max(width / img.width, height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
            }
        } catch (e) { }

        // 2. Dark Overlay & Cinematic Bars
        ctx.fillStyle = 'rgba(9, 9, 11, 0.75)';
        ctx.fillRect(0, 0, width, height);

        // 3. Center Info Circle
        const centerX = width / 2;
        const centerY = height / 2;

        const gradCenter = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, 400);
        gradCenter.addColorStop(0, 'rgba(0,0,0,0.8)');
        gradCenter.addColorStop(1, 'transparent');
        ctx.fillStyle = gradCenter;
        ctx.beginPath(); ctx.arc(centerX, centerY, 400, 0, Math.PI * 2); ctx.fill();

        // VS Logo/Text
        ctx.textAlign = 'center';
        ctx.font = 'bold italic 200px Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
        ctx.fillText("VS", centerX, centerY + 70);
        ctx.shadowBlur = 0;

        // Map Info
        ctx.font = 'bold 36px Arial, sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.letterSpacing = "5px";
        ctx.fillText((match.selectedMap || 'UNKNOWN').toUpperCase(), centerX, centerY - 120);


        // 4. Team Columns
        const drawTeamColumn = async (teamData, isLeft) => {
            const alignX = isLeft ? 100 : width - 100;
            const textAlign = isLeft ? 'left' : 'right';
            const color = isLeft ? '#3b82f6' : '#ef4444';

            // Top Header: TEAM [CAPTAIN]
            ctx.textAlign = textAlign;
            ctx.font = 'bold 60px Arial, sans-serif';
            ctx.fillStyle = color;
            ctx.shadowColor = color; ctx.shadowBlur = 10;
            ctx.fillText(`TEAM ${(teamData.captain.name || 'Unknown').toUpperCase()}`, alignX, 150);
            ctx.shadowBlur = 0;

            const playerList = teamData.players;
            let playerY = 250;

            for (const player of playerList) {
                // Row BG
                const rowW = 550;
                const rowH = 100;
                const rowX = isLeft ? alignX : alignX - rowW;

                const gradRow = ctx.createLinearGradient(rowX, 0, rowX + rowW, 0);
                if (isLeft) {
                    gradRow.addColorStop(0, hexToRgba(color, 0.2));
                    gradRow.addColorStop(1, 'transparent');
                } else {
                    gradRow.addColorStop(0, 'transparent');
                    gradRow.addColorStop(1, hexToRgba(color, 0.2));
                }
                ctx.fillStyle = gradRow;
                ctx.beginPath(); ctx.roundRect(rowX, playerY, rowW, rowH, 10); ctx.fill();

                // Avatar
                const avSize = 70;
                const avX = isLeft ? rowX + 15 : rowX + rowW - 15 - avSize;
                const avY = playerY + 15;

                ctx.save();
                ctx.beginPath(); ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2); ctx.clip();
                if (player.avatar) {
                    try {
                        const avatarImg = await loadImage(player.avatar);
                        ctx.drawImage(avatarImg, avX, avY, avSize, avSize);
                    } catch (e) { }
                }
                ctx.restore();

                // Border Ring
                ctx.strokeStyle = color;
                ctx.lineWidth = 3;
                ctx.beginPath(); ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 2, 0, Math.PI * 2); ctx.stroke();

                // Name & Rank Info
                ctx.textAlign = textAlign;

                // Name Scaling for Live Match
                let fontSize = 32;
                const maxNameWidth = 350;
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                let name = (player.name || 'Unknown').toUpperCase();
                let nameWidth = ctx.measureText(name).width;
                while (nameWidth > maxNameWidth && fontSize > 16) {
                    fontSize -= 2;
                    ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                    nameWidth = ctx.measureText(name).width;
                }

                ctx.fillStyle = '#fff';
                const textStartX = isLeft ? avX + avSize + 25 : avX - 25;
                ctx.fillText(name, textStartX, playerY + 45);

                const lvInfo = getLevelInfo(player.elo || 200);
                ctx.font = 'bold 24px Arial, sans-serif';
                ctx.fillStyle = lvInfo.color;
                ctx.fillText(`LV.${lvInfo.lv} • ${player.elo} ELO`, textStartX, playerY + 80);

                playerY += 120;
            }
        };

        await drawTeamColumn(teamAData, true);
        await drawTeamColumn(teamBData, false);

        return canvas.toBuffer('image/png');
    },

    async createMapVotingImage(votedMaps, allPlayersData, match) {
        const fullMaps = require('../handlers/match/constants').MAPS;
        const width = 1200;
        const sidebarWidth = 300;
        const gridX = 50;
        const gridY = 150;
        const itemW = 250;
        const itemH = 150;
        const gap = 30;
        const cols = 3;

        const rows = Math.ceil(fullMaps.length / cols);
        const height = Math.max(600, gridY + rows * (itemH + gap) + 50);

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Dark Gradient Background
        const bg = ctx.createLinearGradient(0, 0, 0, height);
        bg.addColorStop(0, '#0a0a0c');
        bg.addColorStop(1, '#18181b');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.textAlign = 'center';
        ctx.font = 'bold 50px Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText("MAP VOTING", (width - sidebarWidth) / 2, 80);

        // Sidebar: Voters Info
        const sidebarX = width - sidebarWidth;
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(sidebarX, 0, sidebarWidth, height);

        ctx.textAlign = 'left';
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.fillText("PARTICIPANTS", sidebarX + 20, 50);

        let pY = 100;
        for (const p of allPlayersData) {
            const avSize = 40;
            ctx.save();
            ctx.beginPath(); ctx.arc(sidebarX + 40, pY - 8, avSize / 2, 0, Math.PI * 2); ctx.clip();
            if (p.avatar) {
                try {
                    const img = await loadImage(p.avatar);
                    ctx.drawImage(img, sidebarX + 40 - avSize / 2, pY - 8 - avSize / 2, avSize, avSize);
                } catch (e) { }
            }
            ctx.restore();

            ctx.font = '20px Arial, sans-serif';
            ctx.fillStyle = p.hasVoted ? '#2ecc71' : '#52525b';
            ctx.fillText(p.hasVoted ? '✓' : '-', sidebarX + 70, pY);

            ctx.fillStyle = p.hasVoted ? '#fff' : '#52525b';
            ctx.font = '18px Arial, sans-serif';
            ctx.fillText((p.name || 'Unknown').toUpperCase().substring(0, 15), sidebarX + 95, pY);

            pY += 50;
        }

        // Map Grid
        ctx.textAlign = 'center';
        for (let i = 0; i < fullMaps.length; i++) {
            const m = fullMaps[i];
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = gridX + col * (itemW + gap);
            const y = gridY + row * (itemH + gap);

            try {
                const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
                let p = path.join(assetsPath, `${m.name}.png`);
                if (!fs.existsSync(p)) p = path.join(assetsPath, `${m.name.toLowerCase()}.png`);
                if (fs.existsSync(p)) {
                    const img = await loadImage(p);
                    ctx.save();
                    ctx.beginPath(); ctx.roundRect(x, y, itemW, itemH, 15); ctx.clip();
                    ctx.drawImage(img, x, y, itemW, itemH);
                    ctx.fillStyle = 'rgba(0,0,0,0.4)';
                    ctx.fillRect(x, y, itemW, itemH);
                    ctx.restore();
                }
            } catch (e) { }

            ctx.strokeStyle = (votedMaps[m.name] > 0) ? '#f1c40f' : '#27272a';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect(x, y, itemW, itemH, 15); ctx.stroke();

            ctx.font = 'bold 22px Arial, sans-serif';
            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
            ctx.fillText(m.name.toUpperCase(), x + itemW / 2, y + itemH / 2 + 10);
            ctx.shadowBlur = 0;

            if (votedMaps[m.name] > 0) {
                const badgeR = 25;
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath(); ctx.arc(x + itemW, y, badgeR, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 20px Arial, sans-serif';
                ctx.fillText(votedMaps[m.name], x + itemW, y + 7);
            }
        }

        return canvas.toBuffer('image/png');
    },

    async createVersusFullImage(data) {
        // data: { map, teamA: [{name, elo, title, activeTitle}], teamB: [{name, elo, title, activeTitle}] }
        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Background (Map)
        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            const mapName = data.map || 'Unknown';
            let p = path.join(assetsPath, `${mapName}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (fs.existsSync(p)) {
                const img = await loadImage(p);
                const scale = Math.max(width / img.width, height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
            }
        } catch (e) { }

        // Dark Overlay
        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.fillRect(0, 0, width, height);

        // Gradient Overlays for sides
        const gradLeft = ctx.createLinearGradient(0, 0, width / 2, 0);
        gradLeft.addColorStop(0, 'rgba(30, 64, 175, 0.4)');
        gradLeft.addColorStop(1, 'transparent');
        ctx.fillStyle = gradLeft;
        ctx.fillRect(0, 0, width / 2, height);

        const gradRight = ctx.createLinearGradient(width, 0, width / 2, 0);
        gradRight.addColorStop(0, 'rgba(185, 28, 28, 0.4)');
        gradRight.addColorStop(1, 'transparent');
        ctx.fillStyle = gradRight;
        ctx.fillRect(width / 2, 0, width / 2, height);

        // 2. Center Text (Map & VS)
        ctx.textAlign = 'center';
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 150px Arial, sans-serif';
        ctx.fillText((data.map || 'UNKNOWN').toUpperCase(), width / 2, 250);

        ctx.font = 'bold 60px Arial, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText('FRANKFURT', width / 2, 330);

        // Center Diamond & VS
        ctx.save();
        ctx.translate(width / 2, height / 2);
        ctx.rotate(Math.PI / 4);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 2;
        ctx.strokeRect(-100, -100, 200, 200);
        ctx.restore();

        ctx.font = 'bold 120px Arial, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText('VS', width / 2, height / 2 + 40);

        // 3. Side Headers
        ctx.font = 'bold 40px Arial, sans-serif';
        ctx.letterSpacing = '10px';

        ctx.fillStyle = '#4ade80';
        ctx.textAlign = 'left';
        ctx.fillText('SALDIRI', 150, 150);
        ctx.fillRect(150, 170, 300, 2);

        ctx.fillStyle = '#f87171';
        ctx.textAlign = 'right';
        ctx.fillText('SAVUNMA', width - 150, 150);
        ctx.fillRect(width - 450, 170, 300, 2);

        // 4. Player Cards
        const drawPlayerCard = async (player, x, y, isRight) => {
            const cardW = 500;
            const cardH = 120;
            const drawX = isRight ? x - cardW : x;

            // Simple Sleek Background
            ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
            ctx.beginPath();
            ctx.roundRect(drawX, y, cardW, cardH, 5);
            ctx.fill();

            // Custom Level Icon from faceitsekli
            const lvlInfo = getLevelInfo(player.elo || 200);
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    const iSize = 85;
                    const iX = isRight ? drawX + 15 : drawX + cardW - 15 - iSize;
                    const iY = y + (cardH - iSize) / 2;
                    ctx.drawImage(icon, iX, iY, iSize, iSize);
                }
            } catch (e) { }

            // Name & Title (Arial Bold)
            ctx.textAlign = isRight ? 'right' : 'left';
            const textX = isRight ? drawX + cardW - 30 : drawX + 30;

            // Dynamic Font Scaling for Long Names
            let fontSize = 34;
            const maxNameWidth = 350;
            ctx.font = `bold ${fontSize}px Arial, sans-serif`;
            let name = (player.name || 'Unknown').toUpperCase();
            let nameWidth = ctx.measureText(name).width;

            while (nameWidth > maxNameWidth && fontSize > 18) {
                fontSize -= 2;
                ctx.font = `bold ${fontSize}px Arial, sans-serif`;
                nameWidth = ctx.measureText(name).width;
            }

            ctx.fillStyle = '#fff';
            ctx.fillText(name, textX, y + 55);

            // Connect to Title System (activeTitle)
            const playerTitle = (player.activeTitle || player.title || 'OYUNCU').toUpperCase();
            ctx.font = '20px Arial, sans-serif';
            ctx.fillStyle = '#94a3b8';
            ctx.globalAlpha = 0.7;
            ctx.fillText(playerTitle, textX, y + 90);
            ctx.globalAlpha = 1;
        };

        let playerY = 200;
        for (const p of data.teamA) {
            await drawPlayerCard(p, 50, playerY, false);
            playerY += 140;
        }

        playerY = 200;
        for (const p of data.teamB) {
            await drawPlayerCard(p, width - 50, playerY, true);
            playerY += 140;
        }

        return canvas.toBuffer('image/png');
    },

    async createPanelBanner() {
        const width = 1200;
        const height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background - Dark sleek gradient
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#09090b');
        bgGrad.addColorStop(1, '#18181b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Subtle Grid Pattern
        ctx.strokeStyle = 'rgba(251, 191, 36, 0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // Decorative Shapes
        ctx.fillStyle = 'rgba(251, 191, 36, 0.05)';
        ctx.beginPath();
        ctx.arc(width - 100, 100, 200, 0, Math.PI * 2);
        ctx.fill();

        // Main Text - "NEXORA"
        ctx.shadowColor = '#fbbf24';
        ctx.shadowBlur = 20;
        ctx.fillStyle = '#fbbf24';
        ctx.font = 'bold 120px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NEXORA', width / 2, height / 2 - 20);
        ctx.shadowBlur = 0;

        // Sub Text - "CONTROL PANEL"
        ctx.font = '36px Arial, sans-serif';
        ctx.letterSpacing = '15px';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.8;
        ctx.fillText('CONTROL PANEL', width / 2, height / 2 + 50);

        // Bottom Glow Line
        const lineGrad = ctx.createLinearGradient(width * 0.2, 0, width * 0.8, 0);
        lineGrad.addColorStop(0, 'transparent');
        lineGrad.addColorStop(0.5, '#fbbf24');
        lineGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lineGrad;
        ctx.fillRect(width * 0.2, height - 80, width * 0.6, 2);

        // Simple sleek bottom glow instead of emoji boxes
        ctx.globalAlpha = 0.5;
        ctx.font = 'bold 20px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.letterSpacing = '5px';
        ctx.fillText('• STATS • RANK • TITLES • STYLE •', width / 2, height - 40);
        ctx.globalAlpha = 1;

        return canvas.toBuffer('image/png');
    },

    // Setup Match Panel Görseli (Modern - Control Panel Tarzı)
    async createMatchPanelImage() {
        const width = 1200;
        const height = 400;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background (removed remote GIF to avoid 404 errors)
        const bgGrad = ctx.createLinearGradient(0, 0, width, height);
        bgGrad.addColorStop(0, '#09090b');
        bgGrad.addColorStop(1, '#18181b');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, width, height);

        // Subtle Grid Pattern
        ctx.strokeStyle = 'rgba(239, 68, 68, 0.03)';
        ctx.lineWidth = 1;
        for (let x = 0; x < width; x += 40) {
            ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
        }
        for (let y = 0; y < height; y += 40) {
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(width, y); ctx.stroke();
        }

        // Decorative Shape (Kırmızı)
        ctx.fillStyle = 'rgba(239, 68, 68, 0.08)';
        ctx.beginPath();
        ctx.arc(width - 100, 100, 200, 0, Math.PI * 2);
        ctx.fill();

        // Main Text - "NEXORA"
        ctx.shadowColor = '#ef4444';
        ctx.shadowBlur = 12;
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 110px Arial, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('NEXORA', width / 2, height / 2 - 30);
        ctx.shadowBlur = 0;

        // Sub Text - "COMPETITIVE"
        ctx.font = 'bold 38px Arial, sans-serif';
        ctx.letterSpacing = '12px';
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = 0.9;
        ctx.fillText('COMPETITIVE', width / 2, height / 2 + 30);
        ctx.globalAlpha = 1;

        // Bottom Glow Line
        const lineGrad = ctx.createLinearGradient(width * 0.2, 0, width * 0.8, 0);
        lineGrad.addColorStop(0, 'transparent');
        lineGrad.addColorStop(0.5, '#ef4444');
        lineGrad.addColorStop(1, 'transparent');
        ctx.fillStyle = lineGrad;
        ctx.fillRect(width * 0.2, height - 100, width * 0.6, 3);

        // Bottom Info Text
        ctx.globalAlpha = 0.7;
        ctx.font = 'bold 18px Arial, sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.letterSpacing = '4px';
        ctx.fillText('• LOBI BEKLEME KANALINA GİRİŞ YAPIN •', width / 2, height - 60);
        ctx.globalAlpha = 1;

        // Extra Bottom Text
        ctx.globalAlpha = 0.5;
        ctx.font = 'bold 16px Arial, sans-serif';
        ctx.fillStyle = '#d1d5db';
        ctx.letterSpacing = '3px';
        ctx.fillText('TAKIMINI TOPLA • STRATEJİNİ BELİRLE • MÜCADELEYE BAŞLA', width / 2, height - 30);
        ctx.globalAlpha = 1;

        return canvas.toBuffer('image/png');
    }
};

function drawStar(ctx, cx, cy, spikes, outerRadius, innerRadius, color) {
    let rot = Math.PI / 2 * 3;
    let x = cx;
    let y = cy;
    let step = Math.PI / spikes;

    ctx.beginPath();
    ctx.moveTo(cx, cy - outerRadius);
    for (let i = 0; i < spikes; i++) {
        x = cx + Math.cos(rot) * outerRadius;
        y = cy + Math.sin(rot) * outerRadius;
        ctx.lineTo(x, y);
        rot += step;

        x = cx + Math.cos(rot) * innerRadius;
        y = cy + Math.sin(rot) * innerRadius;
        ctx.lineTo(x, y);
        rot += step;
    }
    ctx.lineTo(cx, cy - outerRadius);
    ctx.closePath();
    ctx.fillStyle = color;
    ctx.fill();
}
