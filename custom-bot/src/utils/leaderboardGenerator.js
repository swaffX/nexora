const { createCanvas, loadImage } = require('@napi-rs/canvas');
const path = require('path');
const fs = require('fs');
const eloService = require('../services/eloService');

const assetCache = new Map();
const MAX_CACHE_SIZE = 50;

async function loadCachedImage(imagePath) {
    if (assetCache.has(imagePath)) {
        const img = assetCache.get(imagePath);
        assetCache.delete(imagePath);
        assetCache.set(imagePath, img);
        return img;
    }
    try {
        if (fs.existsSync(imagePath)) {
            const img = await loadImage(imagePath);
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

module.exports = {
    async createLeaderboardImage(users) {
        const width = 2800;
        const rowHeight = 220;
        const gap = 25;
        const headerHeight = 360;
        const footerHeight = 100;

        const height = headerHeight + (users.length * (rowHeight + gap)) + footerHeight + 20;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        // BACKGROUND
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

        // HEADER
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
        ctx.fillText(`SEASON 1  •  TOP ${users.length} PLAYERS`, width / 2, 235);

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

        // ROWS
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

            // Card Background
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

            // 1. Rank Number
            ctx.textAlign = 'center';
            ctx.font = 'bold 80px Arial, sans-serif';
            ctx.fillStyle = rankFontColor;
            if (isTop3) {
                ctx.shadowColor = themeColor;
                ctx.shadowBlur = 15;
            }
            ctx.fillText(`#${rank}`, cardX + 110, y + rowHeight / 2 + 28);
            ctx.shadowBlur = 0;

            // 2. Level Icon (PROMINENT)
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

            // 3. Avatar
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

            // 4. Username + Title Badge
            const nameX = avX + avSize + 35;
            ctx.textAlign = 'left';
            ctx.font = 'bold 52px Arial, sans-serif';
            ctx.fillStyle = '#ffffff';
            let name = user.username ? user.username.toUpperCase() : 'UNKNOWN';
            if (name.length > 14) name = name.substring(0, 14) + '..';
            ctx.fillText(name, nameX, y + rowHeight / 2 + 5);

            // Title Badge
            if (user.matchStats && user.matchStats.activeTitle) {
                const titleColor = eloService.getTitleColor(user.matchStats.activeTitle);
                const titleText = user.matchStats.activeTitle.toUpperCase();
                ctx.font = 'bold 18px Arial, sans-serif';
                const titleW = ctx.measureText(titleText).width;
                const pillW = titleW + 20;
                const pillH = 28;
                const pillX = nameX;
                const pillY = y + rowHeight / 2 + 12;
                
                // Parse title color for rgba
                const tr = parseInt(titleColor.slice(1, 3), 16);
                const tg = parseInt(titleColor.slice(3, 5), 16);
                const tb = parseInt(titleColor.slice(5, 7), 16);
                
                // Badge background
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, 14);
                ctx.fillStyle = `rgba(${tr}, ${tg}, ${tb}, 0.15)`;
                ctx.fill();
                
                // Badge border
                ctx.beginPath();
                ctx.roundRect(pillX, pillY, pillW, pillH, 14);
                ctx.strokeStyle = `rgba(${tr}, ${tg}, ${tb}, 0.4)`;
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Badge text
                ctx.fillStyle = titleColor;
                ctx.fillText(titleText, pillX + 10, pillY + 20);
            }

            // 5. ELO Progress Bar (under name)
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

            // 6. Stats Boxes
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

            // 7. ELO (Far Right)
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

        // FOOTER
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
    }
};
