const { createCanvas, loadImage } = require('canvas');
const path = require('path');
// Match System Visuals v2.0 - Updated Leaderboard, Versus, Turn, Pick, Roster
const fs = require('fs');
const eloService = require('../services/eloService');

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

// Yıldız Çizim Fonksiyonu (MVP için)
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
        // match: Match model object
        // eloChanges: Array of { userId, change, newElo }
        // playersData: Map or Object of { userId: { username, avatarURL } }

        const width = 1200;
        const height = 800;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // 1. Arkaplan (Harita Resmi)
        let mapBg = null;
        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            // Try explicit filename first, then variations
            let p = path.join(assetsPath, `${match.map}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${match.map.toLowerCase()}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${match.map.trim()}.png`);

            if (fs.existsSync(p)) {
                mapBg = await loadImage(p);
            }
        } catch (e) { console.log('Map load error', e); }

        if (mapBg) {
            // Cover fit
            const scale = Math.max(width / mapBg.width, height / mapBg.height);
            const w = mapBg.width * scale;
            const h = mapBg.height * scale;
            ctx.drawImage(mapBg, (width - w) / 2, (height - h) / 2, w, h);

            // Dark Overlay
            ctx.fillStyle = 'rgba(9, 9, 11, 0.85)'; // Koyu filtre
            ctx.fillRect(0, 0, width, height);
        } else {
            // Fallback bg
            const bgGradient = ctx.createLinearGradient(0, 0, width, height);
            bgGradient.addColorStop(0, '#18181b');
            bgGradient.addColorStop(1, '#09090b');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);
        }

        // 2. Header (Skor)
        ctx.textAlign = 'center';

        // Map Name
        ctx.font = 'bold 30px "Segoe UI", sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(match.map.toUpperCase(), width / 2, 60);

        // Score
        ctx.font = 'bold 120px "DIN Alternate", sans-serif';

        let scoreA = match.score.A;
        let scoreB = match.score.B;
        // Kazanan rengi
        const colorA = scoreA > scoreB ? '#3b82f6' : (scoreA < scoreB ? '#ef4444' : '#fff');
        const colorB = scoreB > scoreA ? '#3b82f6' : (scoreB < scoreA ? '#ef4444' : '#fff');

        // Ortaya "-"
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 15;
        ctx.fillText('-', width / 2, 160);
        ctx.shadowBlur = 0;

        // Score A (Left)
        ctx.textAlign = 'right';
        ctx.fillStyle = colorA;
        ctx.shadowColor = colorA; ctx.shadowBlur = 30;
        ctx.fillText(scoreA, width / 2 - 50, 160);
        ctx.shadowBlur = 0;

        // Score B (Right)
        ctx.textAlign = 'left';
        ctx.fillStyle = colorB;
        ctx.shadowColor = colorB; ctx.shadowBlur = 30;
        ctx.fillText(scoreB, width / 2 + 50, 160);
        ctx.shadowBlur = 0;

        // 3. Team Lists
        const startY = 250;
        const rowHeight = 80;
        const colWidth = 500;
        const teamAX = 80;
        const teamBX = width - 80 - colWidth; // 1200 - 80 - 500 = 620

        // Team Headers
        ctx.textAlign = 'left';
        ctx.font = 'bold 35px "VALORANT", sans-serif';

        // Team A Header
        ctx.fillStyle = '#3b82f6'; // Blue for Team A usually
        ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 10;
        ctx.fillText('TEAM A', teamAX, startY - 20);
        ctx.shadowBlur = 0;

        // Team B Header
        ctx.textAlign = 'right';
        ctx.fillStyle = '#ef4444'; // Red for Team B
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10;
        ctx.fillText('TEAM B', teamBX + colWidth, startY - 20);
        ctx.shadowBlur = 0;

        // Function to draw player row
        const drawPlayerRow = async (userId, x, y, isRightAlign, teamColor) => {
            const user = playersData[userId] || { username: 'Unknown' };
            const eloLog = eloChanges.find(l => l.userId === userId) || { change: 0, newElo: 100 };
            const level = eloService.getLevelFromElo(eloLog.newElo);
            const isMvp = (match.mvp === userId) || (match.loserMvp === userId);

            // Arkaplan
            const grad = ctx.createLinearGradient(x, y, x + colWidth, y);
            if (isRightAlign) {
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, `rgba(${parseInt(teamColor.slice(1, 3), 16)}, ${parseInt(teamColor.slice(3, 5), 16)}, ${parseInt(teamColor.slice(5, 7), 16)}, 0.15)`);
            } else {
                grad.addColorStop(0, `rgba(${parseInt(teamColor.slice(1, 3), 16)}, ${parseInt(teamColor.slice(3, 5), 16)}, ${parseInt(teamColor.slice(5, 7), 16)}, 0.15)`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, colWidth, 60);

            // MVP Border/Effect
            if (isMvp) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, colWidth, 60);
                // Star Icon
                const iconX = isRightAlign ? x + colWidth + 20 : x - 25;
                drawStar(ctx, iconX, y + 30, 5, 12, 6, '#fbbf24');
            }

            // Avatar
            const avatarSize = 46;
            const avatarX = isRightAlign ? x + colWidth - 55 : x + 10;
            const avatarY = y + 7;

            if (user.avatarURL) {
                try {
                    const avatar = await loadImage(user.avatarURL);
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
                    ctx.restore();
                } catch (e) { }
            }

            // Name
            ctx.font = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillStyle = '#fff';

            const nameX = isRightAlign ? avatarX - 15 : avatarX + avatarSize + 15;
            ctx.textAlign = isRightAlign ? 'right' : 'left';

            let name = user.username.toUpperCase();
            if (name.length > 12) name = name.substring(0, 12) + '..';

            ctx.fillText(name, nameX, y + 38);

            // Level Icon Draw
            const levelSize = 30; // Icon boyutu
            const nameWidth = ctx.measureText(name).width;
            // İkon konumu: İsmin birim sağına (veya sol hizalıysa ona göre)
            const levelIconX = isRightAlign
                ? nameX - nameWidth - levelSize - 5
                : nameX + nameWidth + 10;
            const levelIconY = y + 15;

            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${level}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    ctx.drawImage(icon, levelIconX, levelIconY, levelSize, levelSize);
                }
            } catch (e) { }

            // Elo Change
            const changeText = eloLog.change > 0 ? `+${eloLog.change}` : `${eloLog.change}`;
            const changeColor = eloLog.change > 0 ? '#2ecc71' : '#ef4444';

            ctx.font = 'bold 22px "DIN Alternate", sans-serif';
            ctx.fillStyle = changeColor;

            // Sağdaysa ismin soluna, soldaysa ismin sağına (veya en uca)
            // En uca koyalım daha düzenli olur.
            const eloX = isRightAlign ? x + 20 : x + colWidth - 20;
            ctx.textAlign = isRightAlign ? 'left' : 'right';
            ctx.fillText(changeText, eloX, y + 38);
        };

        // Draw Team A (Left)
        let curY = startY;
        for (const userId of match.teams.A) {
            await drawPlayerRow(userId, teamAX, curY, false, '#3b82f6');
            curY += 70;
        }

        // Draw Team B (Right)
        curY = startY;
        for (const userId of match.teams.B) {
            await drawPlayerRow(userId, teamBX, curY, true, '#ef4444');
            curY += 70;
        }

        // Footer Info
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(0, height - 60, width, 60);

        ctx.font = '18px "Segoe UI", sans-serif';
        ctx.fillStyle = '#52525b';
        ctx.textAlign = 'left';
        ctx.fillText(`MATCH ID: ${match.matchId}`, 30, height - 23);

        ctx.textAlign = 'right';
        ctx.fillText(new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }), width - 30, height - 23);

        return canvas.toBuffer();
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

        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#18181b');
        bgGradient.addColorStop(1, '#09090b');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

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

        try {
            const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${levelData.lv}.png`);
            if (fs.existsSync(iconPath)) {
                const icon = await loadImage(iconPath);
                ctx.shadowColor = 'rgba(0,0,0,0.5)';
                ctx.shadowBlur = 20;
                ctx.drawImage(icon, 50, 75, 300, 300);
                ctx.shadowBlur = 0;
            }
        } catch (e) { }

        const textX = 380;
        ctx.font = 'bold 70px "Segoe UI", sans-serif';

        let nameX = textX;
        if (rank) {
            ctx.fillStyle = '#666';
            ctx.fillText(`#${rank}`, nameX, 100);
            const rankWidth = ctx.measureText(`#${rank}`).width;
            nameX += rankWidth + 20;
        }

        ctx.fillStyle = '#ffffff';
        let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
        if (name.length > 15) name = name.substring(0, 15) + '...';
        ctx.fillText(name, nameX, 100);

        const progressY = 160;
        const barWidth = 750;
        const barHeight = 15;
        let progress = 0;
        if (levelData.lv < 10) {
            const range = levelData.max - levelData.min;
            const current = elo - levelData.min;
            progress = range > 0 ? current / range : 0;
            progress = Math.min(1, Math.max(0, progress));
        } else { progress = 1; }

        ctx.fillStyle = '#333';
        ctx.fillRect(textX, progressY, barWidth, barHeight);
        if (progress > 0) {
            ctx.fillStyle = rankColor;
            ctx.shadowColor = rankColor;
            ctx.shadowBlur = 15;
            ctx.fillRect(textX, progressY, barWidth * progress, barHeight);
            ctx.shadowBlur = 0;
        }

        ctx.font = 'bold 35px "Segoe UI", sans-serif';
        ctx.fillStyle = '#cccccc';
        const eloText = `${elo} ELO`;
        ctx.fillText(eloText, textX, progressY + 55);

        if (levelData.lv < 10) {
            ctx.textAlign = 'right';
            ctx.fillStyle = '#666';
            ctx.fillText(`NEXT: ${levelData.max}`, textX + barWidth, progressY + 55);
            ctx.textAlign = 'left';
        } else {
            ctx.textAlign = 'right';
            ctx.fillStyle = rankColor;
            ctx.fillText(`MAX LEVEL`, textX + barWidth, progressY + 55);
            ctx.textAlign = 'left';
        }

        const statsY = 280;
        const boxWidth = 175;
        const boxHeight = 120;
        const gap = 15;
        const drawStatBox = (idx, label, value, color = '#fff') => {
            const x = textX + (idx * (boxWidth + gap));
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.fillRect(x, statsY, boxWidth, boxHeight);
            ctx.font = 'bold 45px "Segoe UI", sans-serif';
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.fillText(String(value), x + boxWidth / 2, statsY + 60);
            ctx.font = '20px "Segoe UI", sans-serif';
            ctx.fillStyle = '#888';
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
        return canvas.toBuffer();
    },

    async createDetailedStatsImage(user, stats, matchHistory, bestMap, favoriteTeammate, rank) {
        const width = 1200;
        const height = 700;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#18181b');
        bgGradient.addColorStop(1, '#09090b');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

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

        ctx.font = 'bold 30px "Segoe UI", sans-serif';
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

            const boxW = 600;
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

            ctx.font = 'bold 35px "DIN Alternate", sans-serif';
            ctx.fillStyle = color;
            ctx.fillText(symbol, 80, matchY + 52);

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 30px "Segoe UI", sans-serif';
            ctx.fillText(match.map.toUpperCase(), 140, matchY + 50);

            let detailText = match.score;
            if (match.eloChange !== null && match.eloChange !== undefined) {
                const sign = match.eloChange > 0 ? '+' : '';
                detailText += ` • ${sign}${match.eloChange}`;
                if (match.newElo) detailText += ` • ${match.newElo} ELO`;
            }

            ctx.fillStyle = '#ccc';
            ctx.font = '30px "DIN Alternate", sans-serif';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 5;
            ctx.fillText(detailText, 400, matchY + 50);
            ctx.shadowBlur = 0;

            ctx.font = 'italic 20px "Segoe UI", sans-serif';
            ctx.fillStyle = '#ddd'; ctx.textAlign = 'right'; ctx.shadowColor = '#000'; ctx.shadowBlur = 3;
            ctx.fillText(match.date, 630, matchY + 48);
            ctx.textAlign = 'left'; ctx.shadowBlur = 0;

            matchY += 95;
        }

        const rightX = 720;

        // Best Map
        if (bestMap) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 100, 430, 120);
            ctx.font = 'bold 20px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('BEST MAP', rightX + 20, 140);
            ctx.font = 'bold 45px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(bestMap.name.toUpperCase(), rightX + 20, 190);
            ctx.font = '30px "DIN Alternate", sans-serif'; ctx.fillStyle = '#2ecc71'; ctx.textAlign = 'right'; ctx.fillText(`%${bestMap.wr} WR`, rightX + 410, 190); ctx.textAlign = 'left';
        }

        // Fav Duo
        if (favoriteTeammate) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 240, 430, 120);
            ctx.font = 'bold 20px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('FAVORITE DUO', rightX + 20, 280);
            if (favoriteTeammate.avatarURL) {
                try {
                    const avatar = await loadImage(favoriteTeammate.avatarURL);
                    ctx.save(); ctx.beginPath(); ctx.arc(rightX + 60, 320, 35, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(avatar, rightX + 25, 285, 70, 70); ctx.restore();
                } catch (e) { }
            }
            ctx.fillStyle = '#fff';
            let duoName = favoriteTeammate.username.toUpperCase();
            if (duoName.length > 15) ctx.font = 'bold 25px "Segoe UI", sans-serif';
            else if (duoName.length > 10) ctx.font = 'bold 30px "Segoe UI", sans-serif';
            else ctx.font = 'bold 40px "Segoe UI", sans-serif';
            ctx.fillText(duoName, rightX + 110, 330);
        }

        // Win Rate
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 380, 430, 120);
        const w = stats.totalWins || 0; const l = stats.totalLosses || 0; const total = w + l;
        const wr = total > 0 ? Math.round((w / total) * 100) : 0;
        ctx.font = 'bold 20px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('WIN RATE (SEASON)', rightX + 20, 420);
        ctx.font = 'bold 50px "DIN Alternate", sans-serif'; ctx.fillStyle = wr >= 50 ? '#2ecc71' : '#e74c3c'; ctx.fillText(`%${wr}`, rightX + 20, 470);
        ctx.font = '30px "DIN Alternate", sans-serif'; ctx.fillStyle = '#fff'; ctx.textAlign = 'right'; ctx.fillText(`${w}W / ${l}L`, rightX + 410, 470); ctx.textAlign = 'left';

        // --- FOOTER (User Info & Rank) ---
        const footerY = 560;
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
        ctx.font = 'bold 50px "Segoe UI", sans-serif';
        let nameX = 140;
        if (rank) {
            ctx.fillStyle = '#666'; ctx.fillText(`#${rank}`, nameX, footerMid);
            const rankWidth = ctx.measureText(`#${rank}`).width; nameX += rankWidth + 15;
        }
        ctx.fillStyle = '#fff';
        let mainName = user.username.toUpperCase();
        if (mainName.length > 15) mainName = mainName.substring(0, 15);
        ctx.fillText(mainName, nameX, footerMid);

        ctx.textAlign = 'right';
        ctx.font = 'bold 50px "DIN Alternate", sans-serif';
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
        return canvas.toBuffer();
    },

    async createLeaderboardImage(users) {
        // REVISED MODERN WIDE LEADERBOARD
        const width = 2000; // Genişletildi
        const rowHeight = 150; // Biraz daha yüksek
        const gap = 25;
        const headerHeight = 300;
        const footerHeight = 80;

        const height = headerHeight + (users.length * (rowHeight + gap)) + footerHeight;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        // 1. Background (Dark Tech Gradient)
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#09090b'); // Zinc-950
        bgGradient.addColorStop(1, '#000000');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Subtle Grid Overlay
        ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
        for (let i = 0; i < height; i += 50) ctx.fillRect(0, i, width, 1);
        for (let i = 0; i < width; i += 50) ctx.fillRect(i, 0, 1, height);

        // 2. Header Content
        // Top Glow
        const topGlow = ctx.createRadialGradient(width / 2, 0, 0, width / 2, 0, 800);
        topGlow.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        topGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = topGlow;
        ctx.fillRect(0, 0, width, headerHeight);

        // Accent Line
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 15;
        ctx.fillRect(0, headerHeight - 5, width, 5);
        ctx.shadowBlur = 0;

        // Title
        ctx.textAlign = 'center';
        ctx.font = 'bold 110px "VALORANT", sans-serif'; // Bigger Title
        ctx.fillStyle = '#fff';
        ctx.shadowColor = 'rgba(255,255,255,0.5)'; ctx.shadowBlur = 30;
        ctx.fillText("LEADERBOARD", width / 2, 140);
        ctx.shadowBlur = 0;

        ctx.font = '35px "Segoe UI", sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText(`SEASON 1  •  TOP ${users.length} PLAYERS`, width / 2, 200);

        ctx.font = 'italic 22px "Segoe UI", sans-serif';
        ctx.fillStyle = '#52525b';
        ctx.fillText(`UPDATED: ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}`, width / 2, 240);

        // 3. Render List
        let y = headerHeight + 20;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const rank = i + 1;
            const stats = user.matchStats || { elo: 100, totalWins: 0, totalLosses: 0, winStreak: 0 };
            const lvlInfo = getLevelInfo(stats.elo);

            // Card Layout
            const cardX = 50;
            const cardW = width - 100; // Full width card

            // Themes
            let themeColor = '#52525b'; // Default Gray
            let textColor = '#e4e4e7';
            let bgColor = '#18181b';
            let isTop3 = false;

            if (rank === 1) {
                themeColor = '#fbbf24'; textColor = '#fbbf24'; bgColor = '#282010'; isTop3 = true; // Gold
            } else if (rank === 2) {
                themeColor = '#e5e7eb'; textColor = '#f3f4f6'; bgColor = '#202022'; isTop3 = true; // Silver
            } else if (rank === 3) {
                themeColor = '#d97706'; textColor = '#fcd34d'; bgColor = '#2a1e10'; isTop3 = true; // Bronze
            }

            // Draw Card Background
            ctx.beginPath();
            ctx.roundRect(cardX, y, cardW, rowHeight, 10);
            const cardGrad = ctx.createLinearGradient(cardX, y, cardX + cardW, y);
            if (isTop3) {
                cardGrad.addColorStop(0, bgColor);
                cardGrad.addColorStop(1, '#0c0c0e');
            } else {
                cardGrad.addColorStop(0, '#18181b');
                cardGrad.addColorStop(1, '#101012');
            }
            ctx.fillStyle = cardGrad;
            ctx.fill();

            // Border/Glow for Top 3
            if (isTop3) {
                ctx.lineWidth = 2;
                ctx.strokeStyle = themeColor;
                ctx.shadowColor = themeColor; ctx.shadowBlur = 10;
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Left Accent Bar
                ctx.fillStyle = themeColor;
                ctx.beginPath(); ctx.roundRect(cardX, y, 10, rowHeight, [10, 0, 0, 10]); ctx.fill();
            } else {
                // Default Left Bar
                ctx.fillStyle = '#27272a';
                ctx.beginPath(); ctx.roundRect(cardX, y, 8, rowHeight, [10, 0, 0, 10]); ctx.fill();
            }

            // --- DATA ---

            // 1. Rank (#1)
            ctx.textAlign = 'center';
            ctx.font = 'bold 80px "DIN Alternate", sans-serif';
            ctx.fillStyle = isTop3 ? textColor : '#71717a';
            if (isTop3) { ctx.shadowColor = themeColor; ctx.shadowBlur = 15; }
            ctx.fillText(`#${rank}`, cardX + 90, y + 105);
            ctx.shadowBlur = 0;

            // 2. Avatar
            const avatarSize = 100;
            const avatarX = cardX + 200;
            const avatarY = y + (rowHeight - avatarSize) / 2;

            // Hexagon/Circle Frame
            ctx.beginPath(); ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 4, 0, Math.PI * 2);
            ctx.fillStyle = isTop3 ? themeColor : '#27272a'; ctx.fill();

            if (user.avatarURL) {
                try {
                    const avatar = await loadImage(user.avatarURL);
                    ctx.save();
                    ctx.beginPath(); ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
                    ctx.restore();
                } catch (e) { }
            }

            // 3. Username
            ctx.textAlign = 'left';
            ctx.font = 'bold 60px "Segoe UI", sans-serif';
            ctx.fillStyle = '#fff';
            let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
            // Daha az truncate, yerimiz var
            if (name.length > 15) name = name.substring(0, 15) + '..';

            const nameX = avatarX + avatarSize + 40;
            ctx.fillText(name, nameX, y + 95);

            // 4. Level Icon (Next to Name)
            const nameWidth = ctx.measureText(name).width;
            const iconX = nameX + nameWidth + 25;
            const iconSize = 70;
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    ctx.drawImage(icon, iconX, y + (rowHeight - iconSize) / 2, iconSize, iconSize);
                }
            } catch (e) { }

            // 5. Stats (W - L - WR) - Align Right-Center
            // Total area width for stats ~600px
            const statsEndX = width - 400; // ELO starts at width-350

            const wins = stats.totalWins || 0;
            const losses = stats.totalLosses || 0;
            const total = wins + losses;
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;

            ctx.textAlign = 'center';
            ctx.font = 'bold 45px "DIN Alternate", sans-serif';

            // Wins
            ctx.fillStyle = '#2ecc71';
            ctx.fillText(`${wins}W`, statsEndX - 350, y + 90);

            // Loss
            ctx.fillStyle = '#ef4444';
            ctx.fillText(`${losses}L`, statsEndX - 230, y + 90);

            // WR
            ctx.textAlign = 'right';
            ctx.fillStyle = wr >= 50 ? '#2ecc71' : '#e74c3c';
            ctx.fillText(`%${wr}`, statsEndX - 50, y + 90);
            ctx.font = 'bold 20px "Segoe UI", sans-serif';
            ctx.fillStyle = '#71717a';
            ctx.fillText("WIN RATE", statsEndX - 50, y + 120);

            // 6. ELO Points (Far Right)
            // Fixed Position to avoid overlap
            const eloAreaX = width - 80;
            const eloCenterY = y + rowHeight / 2;

            ctx.textAlign = 'right';
            ctx.font = 'bold 75px "DIN Alternate", sans-serif';
            ctx.fillStyle = '#fff';
            // ELO Number
            ctx.fillText(`${stats.elo}`, eloAreaX, eloCenterY + 15);

            // Label (Below or Side?) -> Below is risky for height. Side is better if space.
            // But user said "overlap". Let's put label cleanly below with smaller font.
            ctx.font = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillStyle = isTop3 ? themeColor : '#71717a';
            ctx.fillText("ELO", eloAreaX, eloCenterY + 45);

            y += rowHeight + gap;
        }

        // Footer
        ctx.textAlign = 'center';
        ctx.font = '22px "Segoe UI", sans-serif';
        ctx.fillStyle = '#52525b';
        ctx.fillText("NEXORA RANKED SYSTEM  •  SEASON 1  •  DEVELOPED BY SWAFF", width / 2, height - 30);

        return canvas.toBuffer();
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
        ctx.font = 'bold italic 150px "VALORANT", sans-serif';
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
            ctx.font = 'bold 80px "VALORANT", sans-serif';
            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
            ctx.fillText(name, cx, cy + 160);

            // ELO & Level
            const stats = captain.stats || { elo: 100 };
            const lvlInfo = getLevelInfo(stats.elo);

            ctx.font = 'bold 50px "DIN Alternate", sans-serif';
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

        return canvas.toBuffer();
    },

    async createMapVetoImage(mapStates, selectedMap, statusText) {
        const width = 1920;
        const height = 600;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, width, height);

        // Header
        ctx.font = 'bold 60px "VALORANT", sans-serif';
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(statusText || "MAP SELECTION", width / 2, 80);

        const maps = Object.keys(mapStates);
        const cardW = 220;
        const cardH = 350;
        const gap = 30;
        const startX = (width - (maps.length * (cardW + gap) - gap)) / 2;
        const startY = 150;

        for (let i = 0; i < maps.length; i++) {
            const mapName = maps[i];
            const state = mapStates[mapName];
            const x = startX + i * (cardW + gap);
            const y = startY;

            // Card Shape
            ctx.save();
            ctx.beginPath();
            ctx.roundRect(x, y, cardW, cardH, 15);
            ctx.clip();

            // Map Image
            try {
                const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
                let p = path.join(assetsPath, `${mapName}.png`);
                if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

                if (fs.existsSync(p)) {
                    const img = await loadImage(p);
                    ctx.drawImage(img, x, y, cardW, cardH);
                } else {
                    ctx.fillStyle = '#333'; ctx.fillRect(x, y, cardW, cardH);
                }
            } catch (e) {
                ctx.fillStyle = '#333'; ctx.fillRect(x, y, cardW, cardH);
            }

            // Overlay based on state
            if (mapName === selectedMap) {
                // Selected (Winner)
                ctx.strokeStyle = '#2ecc71';
                ctx.lineWidth = 10;
                ctx.strokeRect(x, y, cardW, cardH);

                ctx.fillStyle = 'rgba(46, 204, 113, 0.2)';
                ctx.fillRect(x, y, cardW, cardH);
            } else if (state.banned) {
                // Banned
                ctx.fillStyle = 'rgba(0, 0, 0, 0.8)'; // Darken
                ctx.fillRect(x, y, cardW, cardH);

                // Red Stripe
                ctx.fillStyle = 'rgba(239, 68, 68, 0.8)';
                ctx.translate(x + cardW / 2, y + cardH / 2);
                ctx.rotate(-Math.PI / 4);
                ctx.fillRect(-cardW, -20, cardW * 2, 40);

                // Text
                ctx.font = 'bold 40px sans-serif';
                ctx.fillStyle = '#fff';
                ctx.textAlign = 'center';
                ctx.fillText("BANNED", 0, 15);

                ctx.rotate(Math.PI / 4);
                ctx.translate(-(x + cardW / 2), -(y + cardH / 2));
            }

            ctx.restore();

            // Map Name
            ctx.font = 'bold 30px "DIN Alternate", sans-serif';
            ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
            ctx.fillText(mapName.toUpperCase(), x + cardW / 2, y + cardH + 40);
        }

        return canvas.toBuffer();
    },

    async createRosterImage(teamA, teamB) {
        const width = 1920;
        const height = 900;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Layout Constants
        const centerY = height / 2;
        const startY = 200;
        const rowH = 120;

        // Background
        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#0f172a'); grad.addColorStop(1, '#1e293b');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

        // Center Divider
        ctx.strokeStyle = 'rgba(255,255,255,0.1)';
        ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(width / 2, 50); ctx.lineTo(width / 2, height - 50); ctx.stroke();

        // Headers
        ctx.textAlign = 'center';
        ctx.font = 'bold 80px "VALORANT", sans-serif';

        ctx.fillStyle = '#38bdf8'; // Team A Blue
        ctx.fillText("TEAM A", width * 0.25, 120);

        ctx.fillStyle = '#f87171'; // Team B Red
        ctx.fillText("TEAM B", width * 0.75, 120);

        const drawPlayer = async (player, index, isLeft) => {
            const x = isLeft ? 100 : width - 100;
            const y = startY + (index * (rowH + 20));
            const w = (width / 2) - 200;
            const align = isLeft ? 'left' : 'right';

            // Card
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath(); ctx.roundRect(isLeft ? x : width / 2 + 100, y, w, rowH, 10); ctx.fill();

            const pX = isLeft ? x : width / 2 + 100;

            // Avatar
            const avSize = 90;
            const avX = isLeft ? pX + 20 : pX + w - avSize - 20;
            const avY = y + (rowH - avSize) / 2;

            if (player.avatarURL) {
                try {
                    const av = await loadImage(player.avatarURL);
                    ctx.save();
                    ctx.beginPath(); ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(av, avX, avY, avSize, avSize);
                    ctx.restore();
                } catch (e) { }
            }

            // Name
            const name = player.username ? player.username.toUpperCase() : 'UNKNOWN';
            ctx.font = 'bold 45px "Segoe UI", sans-serif';
            ctx.fillStyle = '#fff';
            ctx.textAlign = isLeft ? 'left' : 'right';
            const textX = isLeft ? avX + avSize + 30 : avX - 30;
            ctx.fillText(name, textX, y + 80);

            // Level Icon
            const lvlInfo = getLevelInfo(player.stats ? player.stats.elo : 100);
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    const iSize = 50;
                    const iX = isLeft ? textX + ctx.measureText(name).width + 20 : textX - ctx.measureText(name).width - iSize - 20;
                    ctx.drawImage(icon, iX, y + 35, iSize, iSize);
                }
            } catch (e) { }
        };

        for (let i = 0; i < 5; i++) {
            if (teamA[i]) await drawPlayer(teamA[i], i, true);
            if (teamB[i]) await drawPlayer(teamB[i], i, false);
        }

        return canvas.toBuffer();
    }
};
