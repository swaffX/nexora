const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const fs = require('fs'); // fs gerekli
const eloService = require('../services/eloService');

// Helper: Hex to RGB
const hexToRgba = (hex, alpha) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

// ELO Level Info
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

module.exports = {
    async createEloCard(user, stats) {
        const width = 1200;
        const height = 450;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

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
        const glowColor = `rgba(${r}, ${g}, ${b}, 0.15)`;

        const glow = ctx.createRadialGradient(width * 0.9, height * 0.5, 0, width * 0.9, height * 0.5, 500);
        glow.addColorStop(0, glowColor);
        glow.addColorStop(1, 'transparent');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = rankColor;
        ctx.fillRect(0, 0, 10, height);

        try {
            const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${levelData.lv}.png`);
            const icon = await loadImage(iconPath);
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 20;
            ctx.drawImage(icon, 50, 75, 300, 300);
            ctx.shadowBlur = 0;
        } catch (e) { }

        const textX = 380;

        ctx.font = 'bold 70px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffffff';
        let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
        if (name.length > 15) name = name.substring(0, 15) + '...';
        ctx.fillText(name, textX, 100);

        const progressY = 160;
        const barWidth = 750;
        const barHeight = 15;

        let progress = 0;
        if (levelData.lv < 10) {
            const range = levelData.max - levelData.min;
            const current = elo - levelData.min;
            progress = range > 0 ? current / range : 0;
            progress = Math.min(1, Math.max(0, progress));
        } else {
            progress = 1;
        }

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

        let streakColor = '#fff';
        let streakVal = Math.abs(streak);
        let streakLabel = 'Streak';
        if (streak >= 3) { streakColor = '#f39c12'; streakLabel = 'Win Streak'; }
        else if (streak >= 1) { streakColor = '#2ecc71'; streakLabel = 'Win Streak'; }
        else if (streak <= -1) { streakColor = '#e74c3c'; streakLabel = 'Lose Streak'; }

        drawStatBox(3, streakLabel, streakVal, streakColor);

        return canvas.toBuffer();
    },

    async createDetailedStatsImage(user, stats, matchHistory, bestMap, favoriteTeammate) {
        const eloCardBuffer = await this.createEloCard(user, stats);
        const eloCardImage = await loadImage(eloCardBuffer);

        const width = 1200;
        const topHeight = 600;
        const totalHeight = topHeight + 450;

        const canvas = createCanvas(width, totalHeight);
        const ctx = canvas.getContext('2d');

        const bgGradient = ctx.createLinearGradient(0, 0, width, totalHeight);
        bgGradient.addColorStop(0, '#18181b');
        bgGradient.addColorStop(1, '#09090b');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, totalHeight);

        ctx.drawImage(eloCardImage, 0, topHeight);

        ctx.font = 'bold 30px "Segoe UI", sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('LAST MATCHES (5)', 50, 70);

        let matchY = 100;
        for (const match of matchHistory) {
            // Arkaplan Resmi
            let mapBg = null;
            try {
                const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
                // Dosya adını bulmaya çalış (pearl.png, Pearl.png vb.)
                const mapNameLower = match.map.toLowerCase();
                let p = path.join(assetsPath, `${mapNameLower}.png`);

                if (Date.now() % 2 === 0 && !fs.existsSync(p)) {
                    // Bazen dosya bulunamazsa alternatifler denenebilir ama şimdilik simple
                }

                if (fs.existsSync(p)) {
                    mapBg = await loadImage(p);
                }
            } catch (e) { }

            if (mapBg) {
                // Resmi kutuya sığdır ve kırp
                const boxW = 600;
                const boxH = 80;
                // Cover
                const scale = Math.max(boxW / mapBg.width, boxH / mapBg.height);
                const w = mapBg.width * scale;
                const h = mapBg.height * scale;

                // Center crop
                const x = 50 + (boxW - w) / 2;
                const y = matchY + (boxH - h) / 2;

                ctx.save();
                ctx.beginPath();
                ctx.rect(50, matchY, boxW, boxH);
                ctx.clip();

                ctx.drawImage(mapBg, x, y, w, h);

                // Dark Overlay
                ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                ctx.fillRect(50, matchY, boxW, boxH);
                ctx.restore();
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.03)';
                ctx.fillRect(50, matchY, 600, 80);
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

            // DETAYLI SKOR METNİ
            // Örn: 13-11 • +25 • 326 ELO
            let detailText = match.score;
            if (match.eloChange !== null && match.eloChange !== undefined) {
                const sign = match.eloChange > 0 ? '+' : '';
                detailText += ` • ${sign}${match.eloChange}`;

                if (match.newElo !== null && match.newElo !== undefined) {
                    detailText += ` • ${match.newElo} ELO`;
                }
            }

            ctx.fillStyle = '#ccc';
            ctx.font = '30px "DIN Alternate", sans-serif';
            ctx.fillText(detailText, 400, matchY + 50);

            ctx.font = 'italic 20px "Segoe UI", sans-serif';
            ctx.fillStyle = '#666';
            ctx.textAlign = 'right';
            ctx.fillText(match.date, 630, matchY + 48);
            ctx.textAlign = 'left';

            matchY += 95;
        }

        const rightX = 720;

        if (bestMap) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(rightX, 100, 430, 120);

            ctx.font = 'bold 20px "Segoe UI", sans-serif';
            ctx.fillStyle = '#666';
            ctx.fillText('BEST MAP', rightX + 20, 140);

            ctx.font = 'bold 45px "Segoe UI", sans-serif';
            ctx.fillStyle = '#fff';
            ctx.fillText(bestMap.name.toUpperCase(), rightX + 20, 190);

            ctx.font = '30px "DIN Alternate", sans-serif';
            ctx.fillStyle = '#2ecc71';
            ctx.textAlign = 'right';
            ctx.fillText(`%${bestMap.wr} WR`, rightX + 410, 190);
            ctx.textAlign = 'left';
        }

        if (favoriteTeammate) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(rightX, 240, 430, 120);

            ctx.font = 'bold 20px "Segoe UI", sans-serif';
            ctx.fillStyle = '#666';
            ctx.fillText('FAVORITE DUO', rightX + 20, 280);

            if (favoriteTeammate.avatarURL) {
                try {
                    const avatar = await loadImage(favoriteTeammate.avatarURL);
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(rightX + 60, 320, 35, 0, Math.PI * 2);
                    ctx.clip();
                    ctx.drawImage(avatar, rightX + 25, 285, 70, 70);
                    ctx.restore();
                } catch (e) { }
            }

            ctx.fillStyle = '#fff';
            ctx.font = 'bold 40px "Segoe UI", sans-serif';
            ctx.fillText(favoriteTeammate.username, rightX + 110, 330);
        }

        ctx.fillStyle = 'rgba(255,255,255,0.03)';
        ctx.fillRect(rightX, 380, 430, 120);

        const w = stats.totalWins || 0;
        const l = stats.totalLosses || 0;
        const total = w + l;
        const wr = total > 0 ? Math.round((w / total) * 100) : 0;

        ctx.font = 'bold 20px "Segoe UI", sans-serif';
        ctx.fillStyle = '#666';
        ctx.fillText('WIN RATE (SEASON)', rightX + 20, 420);

        ctx.font = 'bold 50px "DIN Alternate", sans-serif';
        ctx.fillStyle = wr >= 50 ? '#2ecc71' : '#e74c3c';
        ctx.fillText(`%${wr}`, rightX + 20, 470);

        ctx.font = '30px "DIN Alternate", sans-serif';
        ctx.fillStyle = '#fff';
        ctx.textAlign = 'right';
        ctx.fillText(`${w}W / ${l}L`, rightX + 410, 470);
        ctx.textAlign = 'left';

        return canvas.toBuffer();
    },

    async createLeaderboardImage(users) {
        const rowHeight = 140;
        const width = 2000;
        const height = 300 + (users.length * (rowHeight + 20));
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.antialias = 'subpixel';

        const bgGradient = ctx.createLinearGradient(0, 0, width, height);
        bgGradient.addColorStop(0, '#18181b');
        bgGradient.addColorStop(1, '#09090b');
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px "Segoe UI", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LEADERBOARD', width / 2, 120);

        ctx.font = '30px "Segoe UI", sans-serif';
        ctx.fillStyle = '#666';
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

            ctx.fillStyle = rankColor;
            ctx.fillRect(50, y, 10, rowHeight);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 60px "DIN Alternate", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(`#${i + 1}`, 130, y + 95);

            ctx.textAlign = 'left';
            ctx.font = 'bold 50px "Segoe UI", sans-serif';
            let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
            if (name.length > 15) name = name.substring(0, 15) + '...';

            const streak = Number(stats.winStreak) || 0;
            if (streak >= 3) ctx.fillStyle = '#fbbf24';
            else if (streak <= -3) ctx.fillStyle = '#ef4444';
            else ctx.fillStyle = '#fff';

            ctx.fillText(name, 350, y + 90);

            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                const icon = await loadImage(iconPath);
                ctx.drawImage(icon, 220, y + 20, 100, 100);
            } catch (e) { }

            const wins = stats.totalWins || 0;
            const losses = stats.totalLosses || 0;
            const total = wins + losses;
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;

            ctx.textAlign = 'center';

            ctx.font = 'bold 45px "DIN Alternate", sans-serif';
            ctx.fillStyle = '#2ecc71';
            ctx.fillText(`${wins} W`, 1150, y + 90);

            ctx.fillStyle = '#ef4444';
            ctx.fillText(`${losses} L`, 1350, y + 90);

            ctx.fillStyle = wr >= 50 ? '#2ecc71' : '#e74c3c';
            ctx.fillText(`%${wr}`, 1550, y + 85);
            ctx.font = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillStyle = '#666';
            ctx.fillText('WIN RATE', 1550, y + 125);

            ctx.font = 'bold 80px "DIN Alternate", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${stats.elo}`, 1800, y + 90);
            ctx.font = 'bold 22px "Segoe UI", sans-serif';
            ctx.fillStyle = '#666';
            ctx.fillText('ELO POINTS', 1800, y + 125);

            y += rowHeight + 20;
        }

        return canvas.toBuffer();
    },

    async createLeaderboardImage_OLD(users) {
        const rowHeight = 150;
        const width = 2000;
        const height = (users.length * rowHeight) + 200;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        ctx.fillStyle = '#181818';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ff5500';
        ctx.fillRect(0, 0, 20, height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('TOP 10 LEADERBOARD', 60, 120);

        ctx.font = '40px sans-serif';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'right';
        ctx.fillText(`Update: ${new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })}`, 1950, 120);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(60, 180);
        ctx.lineTo(1940, 180);
        ctx.stroke();

        let y = 280;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const stats = user.matchStats || { elo: 100 };
            const lvlInfo = getLevelInfo(stats.elo);
            const streak = Number(stats.winStreak) || 0;

            ctx.font = 'bold 60px sans-serif';
            ctx.textAlign = 'center';
            let rankColor = '#ffffff';
            if (i === 0) rankColor = '#ffcc00';
            if (i === 1) rankColor = '#c0c0c0';
            if (i === 2) rankColor = '#cd7f32';
            ctx.fillStyle = rankColor;
            ctx.fillText(`#${i + 1}`, 150, y);

            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                const icon = await loadImage(iconPath);
                ctx.drawImage(icon, 250, y - 60, 100, 100);
            } catch (e) { }

            ctx.textAlign = 'left';
            ctx.font = 'bold 60px sans-serif';
            const name = user.username || `Player ${user.odasi?.substring(0, 5) || '???'}`;

            if (streak >= 3) {
                ctx.fillStyle = '#ff8800';
                ctx.fillText(name, 400, y + 15);
                try {
                    const nameWidth = ctx.measureText(name).width;
                    const fireUrl = 'https://cdnjs.cloudflare.com/ajax/libs/twemoji/14.0.2/72x72/1f525.png';
                    const fireImg = await loadImage(fireUrl);
                    ctx.drawImage(fireImg, 400 + nameWidth + 15, y - 45, 60, 60);
                } catch (e) { }
            } else if (streak <= -3) {
                ctx.fillStyle = '#ff0000';
                ctx.fillText(name, 400, y + 15);
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.fillText(name, 400, y + 15);
            }

            const wCount = stats.totalWins || 0;
            const lCount = (stats.totalMatches || 0) - wCount;

            ctx.font = 'bold 40px sans-serif';
            let statCursor = 1150;
            ctx.textAlign = 'right';
            ctx.fillStyle = '#e74c3c';
            const lText = `${lCount} L`;
            ctx.fillText(lText, statCursor, y + 10);
            const lWidth = ctx.measureText(lText).width;

            ctx.fillStyle = '#2ecc71';
            ctx.fillText(`${wCount} W`, statCursor - lWidth - 20, y + 10);

            ctx.fillStyle = '#eeeeee';
            ctx.textAlign = 'right';
            ctx.font = 'bold 60px sans-serif';
            ctx.fillText(`${stats.elo} ELO`, 1500, y + 15);

            const total = stats.totalMatches || 0;
            const wins = stats.totalWins || 0;
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
            ctx.fillStyle = wr >= 50 ? '#00ff00' : '#ff4400';
            ctx.font = '40px sans-serif';
            ctx.fillText(`%${wr} WR`, 1900, y + 15);

            y += rowHeight;
        }

        return canvas.toBuffer();
    },

    async createVersusImage(teamA, teamB, mapName) {
        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            let mapPath = path.join(assetsPath, `${mapName}.png`);
            if (!require('fs').existsSync(mapPath)) mapPath = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (require('fs').existsSync(mapPath)) {
                const bg = await loadImage(mapPath);
                const scale = Math.max(width / bg.width, height / bg.height);
                const x = (width / 2) - (bg.width * scale / 2);
                const y = (height / 2) - (bg.height * scale / 2);
                ctx.drawImage(bg, x, y, bg.width * scale, bg.height * scale);
            } else {
                ctx.fillStyle = '#2B2D31';
                ctx.fillRect(0, 0, width, height);
            }
        } catch (e) {
            ctx.fillStyle = '#2B2D31';
            ctx.fillRect(0, 0, width, height);
        }

        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(0, 0, 40, 0.9)');
        gradient.addColorStop(0.4, 'rgba(0, 0, 20, 0.7)');
        gradient.addColorStop(0.6, 'rgba(40, 0, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(60, 0, 0, 0.9)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.font = 'bold 250px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
        ctx.fillText('V', width / 2 - 20, height / 2);
        ctx.fillStyle = '#ff5500';
        ctx.fillText('S', width / 2 + 130, height / 2);

        const drawCaptain = async (captainData, x, align) => {
            const { user, stats, name } = captainData;
            const avatarSize = 400;
            const avatarY = height / 2 - 100;

            try {
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, avatarY, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                const avatarURL = user.displayAvatarURL({ extension: 'png', size: 512 });
                const avatar = await loadImage(avatarURL);
                ctx.drawImage(avatar, x - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
                ctx.restore();

                ctx.beginPath();
                ctx.arc(x, avatarY, avatarSize / 2, 0, Math.PI * 2);
                ctx.lineWidth = 15;
                ctx.strokeStyle = align === 'left' ? '#3498DB' : '#E74C3C';
                ctx.stroke();

                const lvlInfo = getLevelInfo(stats.elo);
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                try {
                    const icon = await loadImage(iconPath);
                    const iconSize = 120;
                    ctx.drawImage(icon, x - (iconSize / 2), avatarY + (avatarSize / 2) - 40, iconSize, iconSize);
                } catch (e) { }
            } catch (e) { }

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 80px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(name.toUpperCase(), x, avatarY + avatarSize / 2 + 110);

            ctx.font = '50px sans-serif';
            ctx.fillStyle = '#cccccc';
            ctx.fillText(`Level ${stats.matchLevel} • ${stats.elo} ELO`, x, avatarY + avatarSize / 2 + 170);
        };

        await drawCaptain(teamA, width * 0.25, 'left');
        await drawCaptain(teamB, width * 0.75, 'right');

        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`MAP: ${mapName.toUpperCase()}`, width / 2, 100);

        return canvas.toBuffer();
    },

    async createSideSelectionImage(captainA, captainB, selectorId, mapName) {
        const width = 1200;
        const height = 600;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        try {
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            let mapPath = path.join(assetsPath, `${mapName}.png`);
            if (!require('fs').existsSync(mapPath)) mapPath = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (require('fs').existsSync(mapPath)) {
                const bg = await loadImage(mapPath);
                const scale = Math.max(width / bg.width, height / bg.height);
                const x = (width / 2) - (bg.width * scale / 2);
                const y = (height / 2) - (bg.height * scale / 2);
                ctx.drawImage(bg, x, y, bg.width * scale, bg.height * scale);
            } else {
                ctx.fillStyle = '#2B2D31'; ctx.fillRect(0, 0, width, height);
            }
        } catch (e) {
            ctx.fillStyle = '#2B2D31'; ctx.fillRect(0, 0, width, height);
        }

        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(0, 0, width, height);

        ctx.font = 'bold 60px "VALORANT", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#000000'; ctx.shadowBlur = 10;
        ctx.fillText('SIDE SELECTION', width / 2, 80);
        ctx.shadowBlur = 0;

        const isSelectorA = selectorId === captainA.id;
        const selectorUser = isSelectorA ? captainA.user : captainB.user;
        const selectorName = isSelectorA ? captainA.name : captainB.name;
        const avatarSize = 200;
        const cx = width / 2;
        const cy = height / 2 + 20;

        try {
            ctx.save();
            ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 40;
            ctx.beginPath();
            ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#000'; ctx.fill();
            ctx.restore();

            const avatarURL = selectorUser.displayAvatarURL({ extension: 'png', size: 256 });
            const avatar = await loadImage(avatarURL);

            ctx.save();
            ctx.beginPath();
            ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
            ctx.closePath();
            ctx.clip();
            ctx.drawImage(avatar, cx - avatarSize / 2, cy - avatarSize / 2, avatarSize, avatarSize);
            ctx.restore();

            ctx.lineWidth = 8;
            ctx.strokeStyle = '#fbbf24';
            ctx.beginPath();
            ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
            ctx.stroke();
        } catch (e) { }

        ctx.font = 'bold 40px sans-serif';
        ctx.fillStyle = '#fbbf24';
        ctx.fillText(`${selectorName.toUpperCase()} CHOOSING...`, cx, cy + avatarSize / 2 + 50);

        ctx.font = '30px sans-serif';
        ctx.fillStyle = '#cccccc';
        ctx.fillText('ATTACK or DEFEND', cx, cy + avatarSize / 2 + 90);

        ctx.font = 'bold 50px sans-serif';
        ctx.fillStyle = isSelectorA ? '#3498DB' : 'rgba(52, 152, 219, 0.4)';
        ctx.textAlign = 'left';
        ctx.fillText(captainA.name.toUpperCase(), 50, height / 2);

        ctx.textAlign = 'right';
        ctx.fillStyle = !isSelectorA ? '#E74C3C' : 'rgba(231, 76, 60, 0.4)';
        ctx.fillText(captainB.name.toUpperCase(), width - 50, height / 2);

        return canvas.toBuffer();
    },

    async createWheelResult(winner, loser) {
        const width = 800;
        const height = 600;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, width, height);

        const winnerIsA = winner.team === 'A';
        const teamColor = winnerIsA ? '#3498DB' : '#E74C3C'; // A: Mavi, B: Kırmızı

        ctx.save();
        ctx.translate(width / 2, height / 2);
        for (let i = 0; i < 12; i++) {
            ctx.rotate(Math.PI / 6);
            ctx.fillStyle = (i % 2 === 0) ? teamColor : '#222';
            ctx.globalAlpha = 0.2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.arc(0, 0, 500, -Math.PI / 12, Math.PI / 12);
            ctx.fill();
        }
        ctx.restore();

        for (let i = 0; i < 50; i++) {
            ctx.fillStyle = Math.random() < 0.5 ? '#f1c40f' : '#ffffff';
            ctx.beginPath();
            ctx.arc(Math.random() * width, Math.random() * height, Math.random() * 5 + 2, 0, Math.PI * 2);
            ctx.fill();
        }

        const avatarSize = 250;
        const cx = width / 2;
        const cy = height / 2 - 30;

        try {
            ctx.beginPath();
            ctx.arc(cx, cy, avatarSize / 2 + 10, 0, Math.PI * 2);
            ctx.fillStyle = teamColor; ctx.fill();

            const avatarURL = winner.user.displayAvatarURL ? winner.user.displayAvatarURL({ extension: 'png', size: 256 }) : '';
            if (avatarURL) {
                const avatar = await loadImage(avatarURL);
                ctx.save();
                ctx.beginPath();
                ctx.arc(cx, cy, avatarSize / 2, 0, Math.PI * 2);
                ctx.clip();
                ctx.drawImage(avatar, cx - avatarSize / 2, cy - avatarSize / 2, avatarSize, avatarSize);
                ctx.restore();
            }
        } catch (e) { }

        ctx.font = 'bold 80px "VALORANT", sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.shadowColor = teamColor; ctx.shadowBlur = 20;
        ctx.fillText('WINNER', cx, height - 120);

        ctx.font = 'bold 40px sans-serif';
        ctx.shadowBlur = 0;
        const wName = winner.name || 'Winner';
        ctx.fillText(wName.toUpperCase(), cx, height - 60);

        return canvas.toBuffer();
    }
};
