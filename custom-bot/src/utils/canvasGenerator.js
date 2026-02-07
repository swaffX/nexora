const { createCanvas, loadImage } = require('@napi-rs/canvas');
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
            const mapName = match.selectedMap || 'Unknown';
            let p = path.join(assetsPath, `${mapName}.png`);
            if (!fs.existsSync(p)) p = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (fs.existsSync(p)) {
                mapBg = await loadImage(p);
            }
        } catch (e) { console.log('Map load error', e); }

        if (mapBg) {
            const scale = Math.max(width / mapBg.width, height / mapBg.height);
            const w = mapBg.width * scale;
            const h = mapBg.height * scale;
            ctx.drawImage(mapBg, (width - w) / 2, (height - h) / 2, w, h);
            ctx.fillStyle = 'rgba(9, 9, 11, 0.85)';
            ctx.fillRect(0, 0, width, height);
        } else {
            const bgGradient = ctx.createLinearGradient(0, 0, width, height);
            bgGradient.addColorStop(0, '#18181b');
            bgGradient.addColorStop(1, '#09090b');
            ctx.fillStyle = bgGradient;
            ctx.fillRect(0, 0, width, height);
        }

        // 2. Header (Skor)
        ctx.textAlign = 'center';
        ctx.font = 'bold 30px "Segoe UI", sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.fillText((match.selectedMap || 'MAP').toUpperCase(), width / 2, 60);

        ctx.font = 'bold 120px "DIN Alternate", sans-serif';
        const scoreA = match.scoreA || 0;
        const scoreB = match.scoreB || 0;
        const colorA = scoreA > scoreB ? '#3b82f6' : (scoreA < scoreB ? '#ef4444' : '#fff');
        const colorB = scoreB > scoreA ? '#3b82f6' : (scoreB < scoreA ? '#ef4444' : '#fff');

        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 15;
        ctx.fillText('-', width / 2, 160);
        ctx.shadowBlur = 0;

        ctx.textAlign = 'right';
        ctx.fillStyle = colorA;
        ctx.shadowColor = colorA; ctx.shadowBlur = 30;
        ctx.fillText(scoreA, width / 2 - 50, 160);
        ctx.shadowBlur = 0;

        ctx.textAlign = 'left';
        ctx.fillStyle = colorB;
        ctx.shadowColor = colorB; ctx.shadowBlur = 30;
        ctx.fillText(scoreB, width / 2 + 50, 160);
        ctx.shadowBlur = 0;

        // 3. Team Lists
        const startY = 250;
        const colWidth = 500;
        const teamAX = 80;
        const teamBX = width - 80 - colWidth;

        ctx.textAlign = 'left';
        ctx.font = 'bold 35px "VALORANT", sans-serif';
        ctx.fillStyle = '#3b82f6';
        ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 10;
        ctx.fillText('TEAM A', teamAX, startY - 20);
        ctx.shadowBlur = 0;

        ctx.textAlign = 'right';
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 10;
        ctx.fillText('TEAM B', teamBX + colWidth, startY - 20);
        ctx.shadowBlur = 0;

        const drawPlayerRow = async (userId, x, y, isRightAlign, teamColor) => {
            const user = playersData[userId] || { username: 'Unknown' };
            const eloLog = eloChanges.find(l => l.userId === userId) || { change: 0, newElo: 100 };
            const level = eloService.getLevelFromElo(eloLog.newElo);
            const isMvp = (match.mvpPlayerId === userId) || (match.mvpLoserId === userId);

            const grad = ctx.createLinearGradient(x, y, x + colWidth, y);
            if (isRightAlign) {
                grad.addColorStop(0, 'rgba(0,0,0,0)');
                grad.addColorStop(1, `rgba(50, 50, 50, 0.15)`);
            } else {
                grad.addColorStop(0, `rgba(50, 50, 50, 0.15)`);
                grad.addColorStop(1, 'rgba(0,0,0,0)');
            }
            ctx.fillStyle = grad;
            ctx.fillRect(x, y, colWidth, 60);

            if (isMvp) {
                ctx.strokeStyle = '#fbbf24';
                ctx.lineWidth = 2;
                ctx.strokeRect(x, y, colWidth, 60);
                const iconX = isRightAlign ? x + colWidth + 20 : x - 25;
                drawStar(ctx, iconX, y + 30, 5, 12, 6, '#fbbf24');
            }

            const avatarSize = 46;
            const avatarX = isRightAlign ? x + colWidth - 55 : x + 10;
            const avatarY = y + 7;

            if (user.avatarURL) {
                try {
                    const avatar = await loadImage(user.avatarURL);
                    ctx.save();
                    ctx.beginPath(); ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
                    ctx.restore();
                } catch (e) { }
            }

            ctx.font = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillStyle = '#fff';
            const nameX = isRightAlign ? avatarX - 15 : avatarX + avatarSize + 15;
            ctx.textAlign = isRightAlign ? 'right' : 'left';
            let name = user.username.toUpperCase();
            if (name.length > 12) name = name.substring(0, 12) + '..';
            ctx.fillText(name, nameX, y + 38);

            const changeText = eloLog.change > 0 ? `+${eloLog.change}` : `${eloLog.change}`;
            const changeColor = eloLog.change >= 0 ? '#2ecc71' : '#ef4444';
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
        const nameX = textX;

        ctx.fillStyle = '#ffffff';
        let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
        if (name.length > 15) name = name.substring(0, 15) + '...';
        ctx.fillText(name, nameX, 90);

        // Title
        if (stats.activeTitle) {
            ctx.font = 'bold 24px "Segoe UI", sans-serif';
            ctx.fillStyle = eloService.getTitleColor(stats.activeTitle);
            ctx.fillText(stats.activeTitle.toUpperCase(), nameX, 125);
        }

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

        ctx.font = 'bold 32px "Segoe UI", sans-serif';
        ctx.fillStyle = '#cccccc';
        const eloText = `${elo} ELO (#${rank || 'Unranked'})`;
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
        return canvas.toBuffer('image/png');
    },

    async createDetailedStatsImage(user, stats, matchHistory, bestMap, favoriteTeammate, rank) {
        const width = 1200;
        const height = 850;

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

            const boxW = 500; // Harita resmini biraz küçültüyoruz ki yanına yazı sığsın
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

            ctx.fillStyle = '#ccc';
            ctx.font = 'bold 30px "DIN Alternate", sans-serif';
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
                ctx.font = 'bold 32px "DIN Alternate", sans-serif';
                ctx.textAlign = 'left';
                ctx.fillText(eloChangeText, infoX, matchY + 35);

                // MVP Badge (if applicable)
                if (match.isMvp) {
                    const eloWidth = ctx.measureText(eloChangeText).width;
                    ctx.fillStyle = '#fbbf24';
                    ctx.font = 'bold 18px "VALORANT", sans-serif';
                    ctx.fillText('MVP', infoX + eloWidth + 15, matchY + 33);
                    drawStar(ctx, infoX + eloWidth + 75, matchY + 28, 5, 8, 4, '#fbbf24');
                }
            }

            // Tarih (ELO değişiminin altı)
            ctx.font = 'italic 18px "Segoe UI", sans-serif';
            ctx.fillStyle = '#888';
            ctx.textAlign = 'left';
            ctx.fillText(match.date, infoX, matchY + 65);
            ctx.textAlign = 'left';

            matchY += 105;
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
            ctx.font = 'bold 20px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('PLAYED MOST TEAMMATE', rightX + 20, 280);
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

        // Total MVPs
        ctx.fillStyle = 'rgba(255,255,255,0.03)'; ctx.fillRect(rightX, 520, 430, 120);
        ctx.font = 'bold 20px "Segoe UI", sans-serif'; ctx.fillStyle = '#666'; ctx.fillText('TOTAL MVPs', rightX + 20, 560);
        ctx.font = 'bold 55px "DIN Alternate", sans-serif'; ctx.fillStyle = '#fbbf24';
        ctx.shadowColor = 'rgba(251, 191, 36, 0.3)'; ctx.shadowBlur = 15;
        ctx.fillText(String(stats.totalMVPs || 0), rightX + 20, 615);
        ctx.shadowBlur = 0;
        // Icon
        drawStar(ctx, rightX + 380, 580, 5, 25, 12, '#fbbf24');

        // --- FOOTER (User Info & Rank) ---
        const footerY = 730;
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
            ctx.fillStyle = '#666'; ctx.fillText(`#${rank}`, nameX, footerMid - (stats.activeTitle ? 15 : 0));
            const rankWidth = ctx.measureText(`#${rank}`).width; nameX += rankWidth + 15;
        }
        ctx.fillStyle = '#fff';
        let mainName = user.username.toUpperCase();
        if (mainName.length > 15) mainName = mainName.substring(0, 15);
        ctx.fillText(mainName, nameX, footerMid - (stats.activeTitle ? 15 : 0));

        if (stats.activeTitle) {
            ctx.font = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillStyle = eloService.getTitleColor(stats.activeTitle);
            ctx.fillText(stats.activeTitle.toUpperCase(), 140, footerMid + 25);
        }

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
        ctx.font = 'bold 70px "VALORANT", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.shadowColor = 'rgba(255,255,255,0.4)'; ctx.shadowBlur = 30;
        ctx.fillText('NEXORA BAŞARILARI', width / 2, 100);
        ctx.shadowBlur = 0;

        ctx.font = '24px "Segoe UI", sans-serif';
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
            ctx.font = 'bold 32px "Segoe UI", sans-serif';
            ctx.fillStyle = data.color;
            ctx.fillText(name.toUpperCase(), rowX + 40, y);

            // Description
            ctx.textAlign = 'right';
            ctx.font = 'italic 22px "Segoe UI", sans-serif';
            ctx.fillStyle = '#d4d4d8';
            ctx.fillText(data.description, rowX + rowW - 40, y);

            y += rowHeight;
        }

        return canvas.toBuffer('image/png');
    },

    async createLeaderboardImage(users) {
        // ULTRA-WIDE PREMIUM LEADERBOARD (Stats Aesthetic)
        const width = 2500;
        const rowHeight = 200;
        const gap = 35;
        const headerHeight = 400;
        const footerHeight = 100;

        const height = headerHeight + (users.length * (rowHeight + gap)) + footerHeight;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        // 1. Background (Deep Premium Dark)
        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#050505');
        bgGradient.addColorStop(0.5, '#0a0a0c');
        bgGradient.addColorStop(1, '#050505');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        // Hexagon Pattern Overlay (Subtle Tech Feel)
        ctx.save();
        ctx.globalAlpha = 0.03;
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < width; i += 100) {
            for (let j = 0; j < height; j += 100) {
                if ((i + j) % 200 === 0) ctx.fillRect(i, j, 5, 5);
            }
        }
        ctx.restore();

        // 2. Header (Cinematic)
        // Glow
        const headerGlow = ctx.createLinearGradient(0, 0, 0, headerHeight);
        headerGlow.addColorStop(0, 'rgba(255, 255, 255, 0.05)');
        headerGlow.addColorStop(1, 'transparent');
        ctx.fillStyle = headerGlow;
        ctx.fillRect(0, 0, width, headerHeight);

        // Title
        ctx.textAlign = 'center';
        ctx.font = 'bold 150px "VALORANT", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.shadowColor = 'rgba(255, 255, 255, 0.4)'; ctx.shadowBlur = 40;
        ctx.fillText("LEADERBOARD", width / 2, 200);
        ctx.shadowBlur = 0;

        // Subtitle
        ctx.font = '50px "DIN Alternate", sans-serif';
        ctx.fillStyle = '#a1a1aa';
        ctx.letterSpacing = "10px";
        ctx.fillText(`SEASON 1  //  TOP ${users.length} PLAYERS`, width / 2, 280);

        // Accent Bar
        ctx.fillStyle = '#ef4444';
        ctx.shadowColor = '#ef4444'; ctx.shadowBlur = 20;
        ctx.fillRect(width / 2 - 150, 330, 300, 8);
        ctx.shadowBlur = 0;

        // 3. Render Rows
        let y = headerHeight + 20;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const rank = i + 1;
            const stats = user.matchStats || { elo: 100, totalWins: 0, totalLosses: 0 };
            const lvlInfo = getLevelInfo(stats.elo);

            const cardX = 80;
            const cardW = width - 160;

            // Themes
            let isTop3 = false;
            let themeColor = '#3f3f46';
            let glowColor = 'transparent';
            let rankFontColor = '#71717a';

            if (rank === 1) {
                isTop3 = true; themeColor = '#fbbf24'; glowColor = '#b45309'; rankFontColor = '#fbbf24'; // Gold
            } else if (rank === 2) {
                isTop3 = true; themeColor = '#e4e4e7'; glowColor = '#52525b'; rankFontColor = '#e4e4e7'; // Silver
            } else if (rank === 3) {
                isTop3 = true; themeColor = '#d97706'; glowColor = '#78350f'; rankFontColor = '#d97706'; // Bronze
            }

            // Card Shape & Background
            ctx.beginPath();
            ctx.roundRect(cardX, y, cardW, rowHeight, 20);

            // Glass/Dark Gradient
            const cardGrad = ctx.createLinearGradient(cardX, y, cardX + cardW, y);
            if (isTop3) {
                cardGrad.addColorStop(0, 'rgba(20, 20, 23, 0.9)');
                cardGrad.addColorStop(1, 'rgba(10, 10, 12, 0.95)');
            } else {
                cardGrad.addColorStop(0, '#121214');
                cardGrad.addColorStop(1, '#0e0e10');
            }
            ctx.fillStyle = cardGrad;
            ctx.fill();

            // Border & Glow
            if (isTop3) {
                ctx.lineWidth = 4;
                ctx.strokeStyle = themeColor;
                ctx.shadowColor = glowColor; ctx.shadowBlur = 25;
                ctx.stroke();
                ctx.shadowBlur = 0;

                // Left Active Bar
                ctx.fillStyle = themeColor;
                ctx.beginPath(); ctx.roundRect(cardX, y + 20, 15, rowHeight - 40, 10); ctx.fill();
            } else {
                ctx.fillStyle = '#27272a';
                ctx.beginPath(); ctx.roundRect(cardX, y + 20, 10, rowHeight - 40, 10); ctx.fill();
            }

            // --- DATA RENDERING ---

            // 1. Rank (#1)
            ctx.textAlign = 'center';
            ctx.font = 'bold 110px "DIN Alternate", sans-serif'; // Huge Rank
            ctx.fillStyle = rankFontColor;
            if (isTop3) { ctx.shadowColor = themeColor; ctx.shadowBlur = 20; }
            ctx.fillText(`#${rank}`, cardX + 120, y + 145);
            ctx.shadowBlur = 0;

            // 2. Avatar
            const avSize = 130; // Slightly smaller
            const avX = cardX + 250;
            const avY = y + (rowHeight - avSize) / 2;

            // Avatar Background/Border
            ctx.beginPath(); ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2 + 5, 0, Math.PI * 2);
            ctx.fillStyle = isTop3 ? themeColor : '#27272a'; ctx.fill();

            if (user.avatarURL) {
                try {
                    const av = await loadImage(user.avatarURL);
                    ctx.save();
                    ctx.beginPath(); ctx.arc(avX + avSize / 2, avY + avSize / 2, avSize / 2, 0, Math.PI * 2); ctx.clip();
                    ctx.drawImage(av, avX, avY, avSize, avSize);
                    ctx.restore();
                } catch (e) { }
            }

            // 3. Username
            ctx.textAlign = 'left';
            ctx.font = 'bold 70px "Segoe UI", sans-serif'; // Reduced from 80
            ctx.fillStyle = '#ffffff';
            let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';

            // Truncate logic to prevent overlap
            if (name.length > 12) name = name.substring(0, 12) + '..';

            const nameX = avX + avSize + 40;
            const nameY = y + 130;
            ctx.fillText(name, nameX, nameY);

            // 4. Level Icon
            const nameW = ctx.measureText(name).width;
            const iconSize = 80; // Reduced from 90
            const iconX = nameX + nameW + 30;

            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                if (fs.existsSync(iconPath)) {
                    const icon = await loadImage(iconPath);
                    ctx.drawImage(icon, iconX, y + (rowHeight - iconSize) / 2, iconSize, iconSize);
                }
            } catch (e) { }

            // 5. Stats Section (Floating Right)
            // Restore previous logic but with better spacing
            const statsStart = width - 950;

            // Win/Loss/WR Container
            const w = stats.totalWins || 0;
            const l = stats.totalLosses || 0;
            const t = w + l;
            const wr = t > 0 ? Math.round((w / t) * 100) : 0;

            ctx.font = 'bold 50px "DIN Alternate", sans-serif'; // Restored to 50px (was 70)
            ctx.textAlign = 'center';

            // Wins
            ctx.fillStyle = '#2ecc71';
            ctx.fillText(`${w} W`, statsStart, y + 120);

            // Losses
            ctx.fillStyle = '#ef4444';
            ctx.fillText(`${l} L`, statsStart + 160, y + 120);

            // WR
            ctx.textAlign = 'right';
            ctx.fillStyle = wr >= 50 ? '#2ecc71' : '#e74c3c';
            ctx.fillText(`${wr}%`, statsStart + 480, y + 120);

            ctx.font = 'bold 24px "Segoe UI", sans-serif';
            ctx.fillStyle = '#71717a';
            ctx.fillText("WIN RATE", statsStart + 480, y + 160);

            // 6. ELO (Far Right)
            const eloX = width - 100;
            ctx.textAlign = 'right';
            ctx.font = 'bold 90px "DIN Alternate", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${stats.elo}`, eloX, y + 115);

            ctx.font = 'bold 28px "Segoe UI", sans-serif';
            ctx.fillStyle = isTop3 ? themeColor : '#71717a';
            ctx.fillText("ELO POINTS", eloX, y + 160);

            y += rowHeight + gap;
        }

        // Footer Text
        ctx.textAlign = 'center';
        ctx.font = '30px "Segoe UI", sans-serif';
        ctx.fillStyle = '#52525b';
        ctx.fillText("NEXORA RANKED SYSTEM • DEVELOPED BY SWAFF", width / 2, height - 25);

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
        ctx.font = 'bold 35px sans-serif';
        ctx.fillText(`MATCH #${data.matchNumber}`, width / 2, 80);
        ctx.font = '20px sans-serif';
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
                ctx.font = 'bold 38px sans-serif';
                ctx.fillText(cap.name.toUpperCase().substring(0, 15), x, y + 80);

                const lvInfo = getLevelInfo(cap.elo || 200);
                ctx.font = 'bold 24px sans-serif';
                ctx.fillStyle = lvInfo.color;
                ctx.fillText(`LV.${lvInfo.lv} • ${cap.elo} ELO`, x, y + 115);
            } else {
                ctx.strokeStyle = '#27272a';
                ctx.setLineDash([8, 6]);
                ctx.beginPath(); ctx.arc(x, y - 50, 82, 0, Math.PI * 2); ctx.stroke();
                ctx.setLineDash([]);

                ctx.fillStyle = '#3f3f46';
                ctx.font = 'bold 28px sans-serif';
                ctx.fillText(isLeft ? "TEAM A CAPTAIN" : "TEAM B CAPTAIN", x, y + 80);
                ctx.font = '18px sans-serif';
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

        return canvas.toBuffer('image/png');
    },

    async createMapVetoImage(mapStates, selectedMap, statusText) {
        const maps = Object.keys(mapStates);
        const cardW = 220;
        const cardH = 350;
        const gap = 30;

        // Dinamik Genişlik (Haritaların sığması için)
        const totalContentWidth = maps.length * (cardW + gap) + 100;
        const width = Math.max(2000, totalContentWidth); // Min 2000px
        const height = 600;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Background
        ctx.fillStyle = '#121212'; ctx.fillRect(0, 0, width, height);

        // Header
        ctx.font = 'bold 60px "VALORANT", sans-serif';
        ctx.fillStyle = '#fff'; ctx.textAlign = 'center';
        ctx.fillText(statusText || "MAP SELECTION", width / 2, 80);

        // Start X Update
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

        return canvas.toBuffer('image/png');
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
        ctx.font = 'bold 30px "Segoe UI", sans-serif';
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
        ctx.font = 'bold 50px "Segoe UI", sans-serif';
        ctx.fillText(winner.name.toUpperCase(), width / 2, 280);

        // Subtext
        ctx.fillStyle = '#AAAAAA';
        ctx.font = '30px "Segoe UI", sans-serif';
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
        ctx.font = 'bold 300px "VALORANT", sans-serif';
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
            ctx.font = 'bold 50px "VALORANT", sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(cap.name.toUpperCase(), x, y + 150);

            if (isWinner) {
                ctx.font = 'bold 30px sans-serif';
                ctx.fillStyle = '#f1c40f'; // Gold
                ctx.fillText("WINNER", x, y - 190);
                // Mini Crown Emoji or similar would be nice but let's stick to text
            }
        };

        await drawDuelist(captainA, true);
        await drawDuelist(captainB, false);

        // Center Text
        ctx.textAlign = 'center';
        ctx.font = 'bold italic 60px "VALORANT", sans-serif';
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
                // Cover
                const scale = Math.max(width / img.width, height / img.height);
                const w = img.width * scale;
                const h = img.height * scale;
                ctx.drawImage(img, (width - w) / 2, (height - h) / 2, w, h);
            } else {
                ctx.fillStyle = '#111'; ctx.fillRect(0, 0, width, height);
            }
        } catch (e) { ctx.fillStyle = '#111'; ctx.fillRect(0, 0, width, height); }

        // Darkened Filter
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(0, 0, width, height);

        // Gradients for Sides
        const gradL = ctx.createLinearGradient(0, 0, 400, 0);
        gradL.addColorStop(0, 'rgba(231, 76, 60, 0.3)');
        gradL.addColorStop(1, 'transparent');
        ctx.fillStyle = gradL; ctx.fillRect(0, 0, 400, height);

        const gradR = ctx.createLinearGradient(width, 0, width - 400, 0);
        gradR.addColorStop(0, 'rgba(52, 152, 219, 0.3)');
        gradR.addColorStop(1, 'transparent');
        ctx.fillStyle = gradR; ctx.fillRect(width - 400, 0, 400, height);

        // Header
        ctx.textAlign = 'center';
        ctx.font = 'bold 80px "VALORANT", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#000'; ctx.shadowBlur = 20;
        ctx.fillText("SIDE SELECTION", width / 2, 120);

        ctx.font = 'bold 40px "VALORANT", sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.fillText(mapName.toUpperCase(), width / 2, 180);

        // Whose Turn?
        const selectorName = (selectorId === captainA.id) ? captainA.name : captainB.name;
        ctx.font = 'bold 35px sans-serif';
        ctx.fillStyle = '#f1c40f';
        ctx.fillText(`${selectorName.toUpperCase()}'S CHOICE`, width / 2, height - 80);

        // Boxes
        const boxY = 250;
        const boxW = 400;
        const boxH = 300;

        const drawChoiceBox = (label, x, color, emoji) => {
            // Shadow
            ctx.shadowBlur = 30; ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.fillStyle = 'rgba(20,20,23,0.8)';
            ctx.beginPath(); ctx.roundRect(x, boxY, boxW, boxH, 20); ctx.fill();
            ctx.shadowBlur = 0;

            // Border
            ctx.strokeStyle = color;
            ctx.lineWidth = 5;
            ctx.stroke();

            // Text
            ctx.textAlign = 'center';
            ctx.font = 'bold 60px "VALORANT", sans-serif';
            ctx.fillStyle = color;
            ctx.fillText(label, x + boxW / 2, boxY + boxH / 2 + 20);

            // Subtitle
            ctx.font = '24px sans-serif';
            ctx.fillStyle = '#71717a';
            ctx.fillText("CHOOSE YOUR SIDE", x + boxW / 2, boxY + boxH / 2 + 70);
        };

        drawChoiceBox("ATTACK", 150, '#ef4444');
        drawChoiceBox("DEFEND", width - 150 - boxW, '#3b82f6');

        // Middle VS or similar
        ctx.font = 'italic bold 40px sans-serif';
        ctx.fillStyle = '#333';
        ctx.fillText("OR", width / 2, boxY + boxH / 2);

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
        ctx.font = 'bold italic 200px "VALORANT", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.shadowColor = '#fff'; ctx.shadowBlur = 20;
        ctx.fillText("VS", centerX, centerY + 70);
        ctx.shadowBlur = 0;

        // Istanbul & Map Info
        ctx.font = 'bold 40px "VALORANT", sans-serif';
        ctx.fillStyle = '#ef4444';
        ctx.fillText("ISTANBUL", centerX, centerY - 150);

        ctx.font = 'bold 30px sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.letterSpacing = "5px";
        ctx.fillText((match.selectedMap || 'UNKNOWN').toUpperCase(), centerX, centerY - 100);

        // 4. Team Columns
        const drawTeamColumn = async (teamData, isLeft) => {
            const alignX = isLeft ? 100 : width - 100;
            const textAlign = isLeft ? 'left' : 'right';
            const color = isLeft ? '#3b82f6' : '#ef4444';

            // Top Header: TEAM [CAPTAIN]
            ctx.textAlign = textAlign;
            ctx.font = 'bold 60px "VALORANT", sans-serif';
            ctx.fillStyle = color;
            ctx.shadowColor = color; ctx.shadowBlur = 10;
            ctx.fillText(`TEAM ${teamData.captain.name.toUpperCase()}`, alignX, 150);
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
                ctx.font = 'bold 32px sans-serif';
                ctx.fillStyle = '#fff';
                const textStartX = isLeft ? avX + avSize + 25 : avX - 25;
                ctx.fillText(player.name.toUpperCase().substring(0, 16), textStartX, playerY + 45);

                const lvInfo = getLevelInfo(player.elo || 200);
                ctx.font = 'bold 24px "DIN Alternate", sans-serif';
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
        // votedMaps: { mapName: voteCount }
        // allPlayersData: [{ id, name, avatar, hasVoted }]
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

        // Header
        ctx.textAlign = 'center';
        ctx.font = 'bold 50px "VALORANT", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.fillText("MAP VOTING", width / 2, 80);

        // Sidebar: Voters Info
        const sidebarX = 900;
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(sidebarX, 0, 300, height);

        ctx.textAlign = 'left';
        ctx.font = 'bold 24px sans-serif';
        ctx.fillStyle = '#71717a';
        ctx.fillText("PARTICIPANTS", sidebarX + 20, 50);

        let pY = 100;
        for (const p of allPlayersData) {
            // Avatar
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

            // Status Icon (Tick or Waiting)
            ctx.font = '20px sans-serif';
            ctx.fillStyle = p.hasVoted ? '#2ecc71' : '#52525b';
            ctx.fillText(p.hasVoted ? '●' : '○', sidebarX + 70, pY);

            // Name
            ctx.fillStyle = p.hasVoted ? '#fff' : '#52525b';
            ctx.font = '18px sans-serif';
            ctx.fillText(p.name.toUpperCase().substring(0, 15), sidebarX + 95, pY);

            pY += 50;
        }

        // Map Grid
        const maps = require('../handlers/match/constants').MAPS.slice(0, 6); // First 6 maps
        const gridX = 50;
        const gridY = 150;
        const itemW = 250;
        const itemH = 150;
        const gap = 30;

        ctx.textAlign = 'center';
        for (let i = 0; i < maps.length; i++) {
            const m = maps[i];
            const col = i % 3;
            const row = Math.floor(i / 3);
            const x = gridX + col * (itemW + gap);
            const y = gridY + row * (itemH + gap);

            // Map Image
            try {
                const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
                let p = path.join(assetsPath, `${m.name}.png`);
                if (!fs.existsSync(p)) p = path.join(assetsPath, `${m.name.toLowerCase()}.png`);
                if (fs.existsSync(p)) {
                    const img = await loadImage(p);
                    ctx.save();
                    ctx.beginPath(); ctx.roundRect(x, y, itemW, itemH, 15); ctx.clip();
                    ctx.drawImage(img, x, y, itemW, itemH);

                    // Dark Filter
                    ctx.fillStyle = 'rgba(0,0,0,0.4)';
                    ctx.fillRect(x, y, itemW, itemH);
                    ctx.restore();
                }
            } catch (e) { }

            // Border
            ctx.strokeStyle = (votedMaps[m.name] > 0) ? '#f1c40f' : '#27272a';
            ctx.lineWidth = 3;
            ctx.beginPath(); ctx.roundRect(x, y, itemW, itemH, 15); ctx.stroke();

            // Map Name
            ctx.font = 'bold 22px sans-serif';
            ctx.fillStyle = '#fff';
            ctx.shadowColor = '#000'; ctx.shadowBlur = 10;
            ctx.fillText(m.name.toUpperCase(), x + itemW / 2, y + itemH / 2 + 10);
            ctx.shadowBlur = 0;

            // Vote Count Badge
            if (votedMaps[m.name] > 0) {
                const badgeR = 25;
                ctx.fillStyle = '#f1c40f';
                ctx.beginPath(); ctx.arc(x + itemW, y, badgeR, 0, Math.PI * 2); ctx.fill();
                ctx.fillStyle = '#000';
                ctx.font = 'bold 20px sans-serif';
                ctx.fillText(votedMaps[m.name], x + itemW, y + 7);
            }
        }

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
