const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
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
        // ... (Reverted logic for MatchResult) ...
        const width = 1200;
        const height = 800;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        let mapBg = null;
        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            let p = path.join(assetsPath, `${match.map}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${match.map.toLowerCase()}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${match.map.trim()}.png`);
            if (fs.existsSync(p)) { mapBg = await loadImage(p); }
        } catch (e) { }

        if (mapBg) {
            const scale = Math.max(width / mapBg.width, height / mapBg.height);
            const w = mapBg.width * scale;
            const h = mapBg.height * scale;
            ctx.drawImage(mapBg, (width - w) / 2, (height - h) / 2, w, h);
            ctx.fillStyle = 'rgba(9, 9, 11, 0.85)'; ctx.fillRect(0, 0, width, height);
        } else {
            const bgGradient = ctx.createLinearGradient(0, 0, width, height);
            bgGradient.addColorStop(0, '#18181b'); bgGradient.addColorStop(1, '#09090b');
            ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, width, height);
        }

        ctx.textAlign = 'center';
        ctx.font = 'bold 30px "Segoe UI", sans-serif'; ctx.fillStyle = '#a1a1aa';
        ctx.fillText(match.map.toUpperCase(), width / 2, 60);

        ctx.font = 'bold 120px "DIN Alternate", sans-serif';
        let scoreA = match.score.A; let scoreB = match.score.B;
        const colorA = scoreA > scoreB ? '#3b82f6' : (scoreA < scoreB ? '#ef4444' : '#fff');
        const colorB = scoreB > scoreA ? '#3b82f6' : (scoreB < scoreA ? '#ef4444' : '#fff');

        ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 15;
        ctx.fillText('-', width / 2, 160); ctx.shadowBlur = 0;

        ctx.textAlign = 'right'; ctx.fillStyle = colorA; ctx.shadowColor = colorA; ctx.shadowBlur = 30;
        ctx.fillText(scoreA, width / 2 - 50, 160); ctx.shadowBlur = 0;

        ctx.textAlign = 'left'; ctx.fillStyle = colorB; ctx.shadowColor = colorB; ctx.shadowBlur = 30;
        ctx.fillText(scoreB, width / 2 + 50, 160); ctx.shadowBlur = 0;

        const startY = 250; const colWidth = 500; const teamAX = 80; const teamBX = width - 80 - colWidth;
        ctx.textAlign = 'left'; ctx.font = 'bold 35px "VALORANT", sans-serif';
        ctx.fillStyle = '#3b82f6'; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 10; ctx.fillText('TEAM A', teamAX, startY - 20); ctx.shadowBlur = 0;
        ctx.textAlign = 'right'; ctx.fillStyle = '#ef4444'; ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10; ctx.fillText('TEAM B', teamBX + colWidth, startY - 20); ctx.shadowBlur = 0;

        const drawPlayerRow = async (userId, x, y, isRightAlign, teamColor) => {
            const user = playersData[userId] || { username: 'Unknown' };
            const eloLog = eloChanges.find(l => l.userId === userId) || { change: 0, newElo: 100 };
            const level = eloService.getLevelFromElo(eloLog.newElo);
            const isMvp = (match.mvp === userId) || (match.loserMvp === userId);

            const grad = ctx.createLinearGradient(x, y, x + colWidth, y);
            if (isRightAlign) {
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, `rgba(${parseInt(teamColor.slice(1, 3), 16)}, ${parseInt(teamColor.slice(3, 5), 16)}, ${parseInt(teamColor.slice(5, 7), 16)}, 0.15)`);
            } else {
                grad.addColorStop(0, `rgba(${parseInt(teamColor.slice(1, 3), 16)}, ${parseInt(teamColor.slice(3, 5), 16)}, ${parseInt(teamColor.slice(5, 7), 16)}, 0.15)`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
            }
            ctx.fillStyle = grad; ctx.fillRect(x, y, colWidth, 60);

            if (isMvp) {
                ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.strokeRect(x, y, colWidth, 60);
                const iconX = isRightAlign ? x + colWidth + 20 : x - 25;
                drawStar(ctx, iconX, y + 30, 5, 12, 6, '#fbbf24');
            }

            const avatarSize = 46; const avatarX = isRightAlign ? x + colWidth - 55 : x + 10; const avatarY = y + 7;
            if (user.avatarURL) {
                try {
                    const avatar = await loadImage(user.avatarURL); ctx.save(); ctx.beginPath();
                    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize); ctx.restore();
                } catch (e) { }
            }

            ctx.font = 'bold 22px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff';
            const nameX = isRightAlign ? avatarX - 15 : avatarX + avatarSize + 15;
            ctx.textAlign = isRightAlign ? 'right' : 'left';
            let name = user.username.toUpperCase();
            if (name.length > 12) name = name.substring(0, 12) + '..';
            ctx.fillText(name, nameX, y + 38);

            const levelSize = 30; const nameWidth = ctx.measureText(name).width;
            const levelIconX = isRightAlign ? nameX - nameWidth - levelSize - 5 : nameX + nameWidth + 10;
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${level}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    ctx.drawImage(icon, levelIconX, y + 15, levelSize, levelSize);
                }
            } catch (e) { }

            const changeText = eloLog.change > 0 ? `+${eloLog.change}` : `${eloLog.change}`;
            const changeColor = eloLog.change > 0 ? '#2ecc71' : '#ef4444';
            ctx.font = 'bold 22px "DIN Alternate", sans-serif'; ctx.fillStyle = changeColor;
            const eloX = isRightAlign ? x + 20 : x + colWidth - 20;
            ctx.textAlign = isRightAlign ? 'left' : 'right';
            ctx.fillText(changeText, eloX, y + 38);
        };

        let curY = startY;
        for (const userId of match.teams.A) { await drawPlayerRow(userId, teamAX, curY, false, '#3b82f6'); curY += 70; }
        curY = startY;
        for (const userId of match.teams.B) { await drawPlayerRow(userId, teamBX, curY, true, '#ef4444'); curY += 70; }

        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(0, height - 60, width, 60);
        ctx.font = '18px "Segoe UI", sans-serif'; ctx.fillStyle = '#52525b';
        ctx.textAlign = 'left'; ctx.fillText(`MATCH ID: ${match.matchId}`, 30, height - 23);
        ctx.textAlign = 'right'; ctx.fillText(new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' }), width - 30, height - 23);

        return canvas.toBuffer('image/png');
    },

    async createEloCard(user, stats, rank) {
        const width = 1200; const height = 450;
        const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d'); ctx.imageSmoothingEnabled = true;

        const elo = stats.elo !== undefined ? stats.elo : 100;
        const levelData = getLevelInfo(elo);
        const rankColor = levelData.color;

        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#18181b'); bgGradient.addColorStop(1, '#09090b');
        ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, width, height);
        const r = parseInt(rankColor.slice(1, 3), 16); const g = parseInt(rankColor.slice(3, 5), 16); const b = parseInt(rankColor.slice(5, 7), 16);
        const glow = ctx.createRadialGradient(width * 0.9, height * 0.5, 0, width * 0.9, height * 0.5, 500);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.15)`); glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);
        ctx.fillStyle = rankColor; ctx.fillRect(0, 0, 10, height);

        try {
            const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${levelData.lv}.png`);
            if (fs.existsSync(iconPath)) {
                const icon = await loadImage(iconPath);
                ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
                ctx.drawImage(icon, 50, 75, 300, 300); ctx.shadowBlur = 0;
            }
        } catch (e) { }

        const textX = 380; ctx.font = 'bold 70px "Segoe UI", sans-serif';
        let nameX = textX;
        if (rank) {
            ctx.fillStyle = '#666'; ctx.fillText(`#${rank}`, nameX, 100);
            const rankWidth = ctx.measureText(`#${rank}`).width; nameX += rankWidth + 20;
        }

        ctx.fillStyle = '#ffffff';
        let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
        if (name.length > 15) name = name.substring(0, 15) + '...';
        ctx.fillText(name, nameX, 100);

        const progressY = 160; const barWidth = 750; const barHeight = 15;
        let progress = 0;
        if (levelData.lv < 10) {
            const range = levelData.max - levelData.min; const current = elo - levelData.min;
            progress = range > 0 ? current / range : 0; progress = Math.min(1, Math.max(0, progress));
        } else { progress = 1; }

        ctx.fillStyle = '#333'; ctx.fillRect(textX, progressY, barWidth, barHeight);
        if (progress > 0) {
            ctx.fillStyle = rankColor; ctx.shadowColor = rankColor; ctx.shadowBlur = 15;
            ctx.fillRect(textX, progressY, barWidth * progress, barHeight); ctx.shadowBlur = 0;
        }

        ctx.font = 'bold 35px "Segoe UI", sans-serif'; ctx.fillStyle = '#cccccc';
        ctx.fillText(`${elo} ELO`, textX, progressY + 55);

        ctx.textAlign = 'right';
        if (levelData.lv < 10) {
            ctx.fillStyle = '#666'; ctx.fillText(`NEXT: ${levelData.max}`, textX + barWidth, progressY + 55);
        } else {
            ctx.fillStyle = rankColor; ctx.fillText(`MAX LEVEL`, textX + barWidth, progressY + 55);
        }
        ctx.textAlign = 'left';

        const statsY = 280; const boxWidth = 175; const boxHeight = 120; const gap = 15;
        const drawStatBox = (idx, label, value, color = '#fff') => {
            const x = textX + (idx * (boxWidth + gap));
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)'; ctx.fillRect(x, statsY, boxWidth, boxHeight);
            ctx.font = 'bold 45px "Segoe UI", sans-serif'; ctx.fillStyle = color; ctx.textAlign = 'center';
            ctx.fillText(String(value), x + boxWidth / 2, statsY + 60);
            ctx.font = '20px "Segoe UI", sans-serif'; ctx.fillStyle = '#888';
            ctx.fillText(label.toUpperCase(), x + boxWidth / 2, statsY + 95); ctx.textAlign = 'left';
        };

        const total = stats.totalMatches || 0; const wins = stats.totalWins || 0;
        const winRate = total > 0 ? Math.round((wins / total) * 100) : 0; const streak = Number(stats.winStreak) || 0;
        drawStatBox(0, 'Matches', total); drawStatBox(1, 'Wins', wins, '#2ecc71');
        drawStatBox(2, 'Win Rate', `%${winRate}`, winRate >= 50 ? '#2ecc71' : '#e74c3c');
        drawStatBox(3, 'Streak', Math.abs(streak), streak >= 0 ? '#2ecc71' : '#e74c3c');
        return canvas.toBuffer('image/png');
    },

    async createDetailedStatsImage(user, stats, matchHistory, bestMap, favoriteTeammate, rank) {
        const width = 1200; const height = 700;
        const canvas = createCanvas(width, height); const ctx = canvas.getContext('2d');
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#18181b'); bgGradient.addColorStop(1, '#09090b');
        ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, width, height);

        const lvlInfo = getLevelInfo(stats.elo !== undefined ? stats.elo : 100);
        const rankColor = lvlInfo.color;
        const r = parseInt(rankColor.slice(1, 3), 16); const g = parseInt(rankColor.slice(3, 5), 16); const b = parseInt(rankColor.slice(5, 7), 16);
        const glow = ctx.createRadialGradient(width, height / 2, 0, width, height / 2, 900);
        glow.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.2)`); glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow; ctx.fillRect(0, 0, width, height);

        ctx.font = 'bold 30px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('LAST MATCHES (5)', 50, 70);

        let matchY = 100;
        for (const match of matchHistory) {
            const boxW = 600; const boxH = 80; const boxX = 50;
            ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(boxX, matchY, boxW, boxH);
            const isWin = match.result === 'WIN'; const color = isWin ? '#2ecc71' : '#e74c3c';
            ctx.fillStyle = color; ctx.fillRect(50, matchY, 5, 80);
            ctx.font = 'bold 35px "DIN Alternate", sans-serif'; ctx.fillStyle = color; ctx.fillText(isWin ? 'W' : 'L', 80, matchY + 52);
            ctx.fillStyle = '#fff'; ctx.font = 'bold 30px "Segoe UI", sans-serif'; ctx.fillText(match.map.toUpperCase(), 140, matchY + 50);
            let detailText = match.score;
            if (match.eloChange !== null && match.eloChange !== undefined) {
                const sign = match.eloChange > 0 ? '+' : ''; detailText += ` • ${sign}${match.eloChange}`;
            }
            ctx.fillStyle = '#ccc'; ctx.font = '30px "DIN Alternate", sans-serif'; ctx.fillText(detailText, 400, matchY + 50);
            matchY += 95;
        }

        const rightX = 720;
        if (bestMap) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 100, 430, 120);
            ctx.font = 'bold 20px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('BEST MAP', rightX + 20, 140);
            ctx.font = 'bold 45px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff'; ctx.fillText(bestMap.name.toUpperCase(), rightX + 20, 190);
        }
        return canvas.toBuffer('image/png');
    },

    // --- REVERTED LEADERBOARD (Original/Correct Design) ---
    async createLeaderboardImage(users) {
        const rowHeight = 140;
        const width = 2000;
        const height = 300 + (users.length * (rowHeight + 20));
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#18181b'); bgGradient.addColorStop(1, '#09090b');
        ctx.fillStyle = bgGradient; ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ffffff'; ctx.font = 'bold 80px "Segoe UI", sans-serif';
        ctx.textAlign = 'center'; ctx.fillText('LEADERBOARD', width / 2, 120);
        ctx.font = '30px "Segoe UI", sans-serif'; ctx.fillStyle = '#666';
        ctx.fillText(`TOP ${users.length} PLAYERS • UPDATED: ${new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul', hour: '2-digit', minute: '2-digit' })}`, width / 2, 170);

        let y = 250;
        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const stats = user.matchStats || { elo: 100 };
            const lvlInfo = getLevelInfo(stats.elo);
            const rankColor = lvlInfo.color;

            ctx.fillStyle = '#27272a';
            if (i === 0) { ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 25; ctx.fillStyle = '#3f2c0e'; }
            else if (i === 1) { ctx.shadowColor = '#9ca3af'; ctx.shadowBlur = 15; ctx.fillStyle = '#2d3036'; }
            else if (i === 2) { ctx.shadowColor = '#b45309'; ctx.shadowBlur = 10; ctx.fillStyle = '#2e1f13'; }
            else { ctx.shadowBlur = 0; }
            ctx.fillRect(50, y, width - 100, rowHeight);
            ctx.shadowBlur = 0;

            ctx.fillStyle = rankColor; ctx.fillRect(50, y, 10, rowHeight);

            ctx.fillStyle = '#ffffff'; ctx.font = 'bold 60px "DIN Alternate", sans-serif'; ctx.textAlign = 'center';
            ctx.fillText(`#${i + 1}`, 130, y + 95);

            ctx.textAlign = 'left'; ctx.font = 'bold 50px "Segoe UI", sans-serif';
            let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
            if (name.length > 15) name = name.substring(0, 15) + '...';

            const streak = Number(stats.winStreak) || 0;
            if (streak >= 3) ctx.fillStyle = '#fbbf24';
            else if (streak <= -3) ctx.fillStyle = '#ef4444';
            else ctx.fillStyle = '#fff';
            ctx.fillText(name, 350, y + 90);

            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    ctx.drawImage(icon, 220, y + 20, 100, 100);
                }
            } catch (e) { }

            const wins = stats.totalWins || 0; const losses = stats.totalLosses || 0; const total = wins + losses;
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
            ctx.textAlign = 'center'; ctx.font = 'bold 45px "DIN Alternate", sans-serif';
            ctx.fillStyle = '#2ecc71'; ctx.fillText(`${wins} W`, 1150, y + 90);
            ctx.fillStyle = '#ef4444'; ctx.fillText(`${losses} L`, 1350, y + 90);
            ctx.fillStyle = wr >= 50 ? '#2ecc71' : '#e74c3c'; ctx.fillText(`%${wr}`, 1550, y + 85);
            ctx.font = 'bold 22px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('WIN RATE', 1550, y + 125);

            ctx.font = 'bold 80px "DIN Alternate", sans-serif'; ctx.fillStyle = '#ffffff'; ctx.fillText(`${stats.elo}`, 1800, y + 90);
            ctx.font = 'bold 22px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('ELO POINTS', 1800, y + 125);
            y += rowHeight + 20;
        }
        return canvas.toBuffer('image/png');
    },

    // --- ADDED MISSING FUNCTIONS (From recent work) to prevent crashes ---

    async createVersusImage(captainA, captainB, mapName) {
        // ULTRA-PREMIUM 1v1 CLASH
        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const mapStr = String(mapName || 'Map');
        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            let p = path.join(assetsPath, `${mapStr}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapStr.toLowerCase()}.png`);
            if (fs.existsSync(p)) {
                const bg = await loadImage(p);
                ctx.drawImage(bg, 0, 0, width, height);
                ctx.fillStyle = 'rgba(10, 10, 15, 0.85)'; ctx.fillRect(0, 0, width, height);
            } else { ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, width, height); }
        } catch (e) { ctx.fillStyle = '#0a0a0f'; ctx.fillRect(0, 0, width, height); }

        const gradient = ctx.createLinearGradient(0, 0, width, height);
        gradient.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
        gradient.addColorStop(0.5, 'transparent');
        gradient.addColorStop(1, 'rgba(244, 63, 94, 0.1)');
        ctx.fillStyle = gradient; ctx.fillRect(0, 0, width, height);

        ctx.shadowColor = 'rgba(0,0,0,0.8)'; ctx.shadowBlur = 50;
        ctx.font = 'bold italic 200px "VALORANT", sans-serif';
        ctx.textAlign = 'center'; ctx.fillStyle = '#ffffff';
        ctx.fillText("VS", width / 2, height / 2 + 70);
        ctx.shadowBlur = 0;

        const drawCaptain = async (captain, isLeft) => {
            const cap = captain || {};
            const stats = cap.stats || { elo: 100 };
            const lvlInfo = getLevelInfo(stats.elo || 100);
            const cx = isLeft ? width * 0.25 : width * 0.75;
            const cy = height / 2;
            const color = isLeft ? '#38bdf8' : '#f43f5e';

            const radius = 180;
            ctx.shadowColor = color; ctx.shadowBlur = 40;
            ctx.beginPath(); ctx.arc(cx, cy - 80, radius, 0, Math.PI * 2);
            ctx.lineWidth = 8; ctx.strokeStyle = color; ctx.stroke();
            ctx.shadowBlur = 0;

            const user = cap.user || {};
            const avatarUrl = user.displayAvatarURL ? user.displayAvatarURL({ extension: 'png', size: 512 }) :
                (user.avatarURL ? user.avatarURL : user.avatar);
            if (avatarUrl) {
                try {
                    const av = await loadImage(avatarUrl);
                    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy - 80, radius - 4, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(av, cx - radius, cy - 80 - radius, radius * 2, radius * 2); ctx.restore();
                } catch (e) { }
            }

            const name = String(cap.name || user.username || 'UNKNOWN').toUpperCase();
            ctx.font = 'bold 70px "VALORANT", sans-serif'; ctx.fillStyle = '#fff';
            ctx.shadowColor = 'rgba(0,0,0,0.5)'; ctx.shadowBlur = 20;
            ctx.fillText(name, cx, cy + 180); ctx.shadowBlur = 0;

            ctx.font = 'bold 45px "DIN Alternate", sans-serif'; ctx.fillStyle = '#cbd5e1';
            ctx.fillText(`${stats.elo || 100} ELO`, cx, cy + 240);
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    ctx.drawImage(icon, cx - 40, cy + 260, 80, 80);
                }
            } catch (e) { }
        };

        if (captainA) await drawCaptain(captainA, true);
        if (captainB) await drawCaptain(captainB, false);
        return canvas.toBuffer('image/png');
    },

    async createMapVetoImage(mapStates, selectedMap, statusText) {
        // ULTRA WIDE MAP GRID (12 MAPS)
        const width = 2200;
        const height = 1200;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#0f0f12'; ctx.fillRect(0, 0, width, height);

        ctx.font = 'bold 90px "VALORANT", sans-serif';
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255,255,255,0.3)'; ctx.shadowBlur = 20;
        ctx.fillText(String(statusText || "MAP SELECTION"), width / 2, 120);
        ctx.shadowBlur = 0;

        const maps = mapStates ? Object.keys(mapStates) : [];
        const cols = 6; const cardW = 320; const cardH = 420; const gapX = 40; const gapY = 60;
        const gridW = (cols * cardW) + ((cols - 1) * gapX);
        const startX = (width - gridW) / 2; const startY = 200;

        for (let i = 0; i < maps.length; i++) {
            const mapName = String(maps[i]);
            const state = mapStates[mapName] || {};
            const col = i % cols; const row = Math.floor(i / cols);
            const x = startX + (col * (cardW + gapX));
            const y = startY + (row * (cardH + gapY));

            ctx.save(); ctx.beginPath(); ctx.roundRect(x, y, cardW, cardH, 15); ctx.clip();
            try {
                const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
                let p = path.join(assetsPath, `${mapName}.png`);
                if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);
                if (fs.existsSync(p)) {
                    const img = await loadImage(p);
                    ctx.drawImage(img, x, y, cardW, cardH);
                } else { ctx.fillStyle = '#27272a'; ctx.fillRect(x, y, cardW, cardH); }
            } catch (e) { ctx.fillStyle = '#27272a'; ctx.fillRect(x, y, cardW, cardH); }

            if (mapName === selectedMap) {
                ctx.strokeStyle = '#22c55e'; ctx.lineWidth = 12; ctx.strokeRect(x, y, cardW, cardH);
                ctx.fillStyle = 'rgba(34, 197, 94, 0.2)'; ctx.fillRect(x, y, cardW, cardH);
            } else if (state.banned) {
                ctx.fillStyle = 'rgba(0,0,0,0.85)'; ctx.fillRect(x, y, cardW, cardH);
                ctx.strokeStyle = '#ef4444'; ctx.lineWidth = 8;
                ctx.beginPath(); ctx.moveTo(x + 50, y + 50); ctx.lineTo(x + cardW - 50, y + cardH - 50);
                ctx.moveTo(x + cardW - 50, y + 50); ctx.lineTo(x + 50, y + cardH - 50); ctx.stroke();
            }
            ctx.restore();
            ctx.font = 'bold 32px "DIN Alternate", sans-serif';
            ctx.fillStyle = (mapName === selectedMap) ? '#22c55e' : (state.banned ? '#ef4444' : '#fff');
            ctx.fillText(mapName.toUpperCase(), x + cardW / 2, y + cardH + 40);
        }
        return canvas.toBuffer('image/png');
    },

    async createRosterImage(teamA, teamB) {
        // ULTRA WIDE ROSTER (5v5 with Numbers)
        const width = 2400; const height = 1100;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        const grad = ctx.createLinearGradient(0, 0, width, height);
        grad.addColorStop(0, '#020617'); grad.addColorStop(1, '#0f172a');
        ctx.fillStyle = grad; ctx.fillRect(0, 0, width, height);

        ctx.shadowColor = '#fff'; ctx.shadowBlur = 20; ctx.strokeStyle = 'rgba(255,255,255,0.2)';
        ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(width / 2, 50); ctx.lineTo(width / 2, height - 50); ctx.stroke();
        ctx.shadowBlur = 0;

        ctx.font = 'bold 100px "VALORANT", sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = '#38bdf8'; ctx.fillText("TEAM A", width * 0.25, 130);
        ctx.fillStyle = '#f87171'; ctx.fillText("TEAM B", width * 0.75, 130);

        const renderSide = async (team, isLeft) => {
            const startX = isLeft ? 80 : width / 2 + 80;
            const startY = 220; const gap = 20; const cardH = 140; const cardW = (width / 2) - 160;
            const safeTeam = team || [];

            for (let i = 0; i < 5; i++) {
                const player = safeTeam[i] || {};
                const y = startY + (i * (cardH + gap));

                ctx.fillStyle = isLeft ? 'rgba(56, 189, 248, 0.05)' : 'rgba(248, 113, 113, 0.05)';
                ctx.strokeStyle = isLeft ? 'rgba(56, 189, 248, 0.3)' : 'rgba(248, 113, 113, 0.3)';
                ctx.lineWidth = 2;
                ctx.beginPath(); ctx.roundRect(startX, y, cardW, cardH, 10); ctx.fill(); ctx.stroke();

                ctx.font = 'bold 40px "DIN Alternate", sans-serif'; ctx.fillStyle = 'rgba(255,255,255,0.3)';
                const numX = isLeft ? startX + 40 : startX + cardW - 40;
                ctx.textAlign = 'center'; ctx.fillText(String(i + 1), numX, y + 85);

                const avSize = 100;
                const avX = isLeft ? startX + 100 : startX + cardW - 100 - avSize;
                const avY = y + (cardH - avSize) / 2;

                ctx.save(); ctx.beginPath(); ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2); ctx.clip();
                if (player.avatarURL) {
                    try {
                        const img = await loadImage(player.avatarURL);
                        ctx.drawImage(img, avX, avY, avSize, avSize);
                    } catch (e) { ctx.fillStyle = '#333'; ctx.fillRect(avX, avY, avSize, avSize); }
                } else { ctx.fillStyle = '#333'; ctx.fillRect(avX, avY, avSize, avSize); }
                ctx.restore();

                const name = String(player.username || 'EMPTY SLOT').toUpperCase();
                ctx.font = 'bold 50px "Segoe UI", sans-serif'; ctx.fillStyle = '#fff';
                const nameX = isLeft ? avX + avSize + 40 : avX - 40;
                ctx.textAlign = isLeft ? 'left' : 'right';
                ctx.fillText(name, nameX, y + 90);

                const stats = player.stats || { elo: 100 };
                const lvlInfo = getLevelInfo(stats.elo);
                try {
                    const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                    if (fs.existsSync(iconPath)) {
                        const icon = await loadImage(iconPath);
                        const iSize = 50;
                        const iX = isLeft ? nameX + ctx.measureText(name).width + 20 : nameX - ctx.measureText(name).width - iSize - 20;
                        ctx.drawImage(icon, iX, y + 45, iSize, iSize);
                    }
                } catch (e) { }
            }
        };
        await renderSide(teamA, true);
        await renderSide(teamB, false);
        return canvas.toBuffer('image/png');
    },

    async createWheelResult(w, l) { return createCanvas(600, 400).toBuffer(); },
    async createSideSelectionImage(ca, cb, s, m) { return createCanvas(800, 400).toBuffer(); }
};
