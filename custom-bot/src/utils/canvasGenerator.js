const { createCanvas, loadImage } = require('canvas');
const path = require('path');

// ELO ARALIKLARI
// Level 1: 100 - 500
// Level 2: 501 - 700 
// ...
const getLevelInfo = (elo) => {
    if (elo <= 500) return { lv: 1, min: 100, max: 500, color: '#00ff00' };
    if (elo <= 750) return { lv: 2, min: 501, max: 750, color: '#00ff00' };
    if (elo <= 900) return { lv: 3, min: 751, max: 900, color: '#00ff00' };
    if (elo <= 1050) return { lv: 4, min: 901, max: 1050, color: '#ffcc00' };
    if (elo <= 1200) return { lv: 5, min: 1051, max: 1200, color: '#ffcc00' };
    if (elo <= 1350) return { lv: 6, min: 1201, max: 1350, color: '#ffcc00' };
    if (elo <= 1530) return { lv: 7, min: 1351, max: 1530, color: '#ffcc00' };
    if (elo <= 1750) return { lv: 8, min: 1531, max: 1750, color: '#ff4400' };
    if (elo <= 2000) return { lv: 9, min: 1751, max: 2000, color: '#ff4400' };
    return { lv: 10, min: 2001, max: 99999, color: '#ff0000' };
};

module.exports = {
    async createEloCard(user, stats) {
        // RETINA ÇÖZÜNÜRLÜK
        const width = 1600;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.antialias = 'subpixel';

        // 1. ARKAPLAN
        ctx.fillStyle = '#181818';
        ctx.fillRect(0, 0, width, height);

        // Verileri Al
        const elo = stats.elo !== undefined ? stats.elo : 100;
        const levelData = getLevelInfo(elo);
        const currentLevel = levelData.lv;

        // --- İLERLEME HESABI ---
        let progress = 0;
        if (currentLevel < 10) {
            const range = levelData.max - levelData.min;
            const current = elo - levelData.min;
            progress = Math.max(0, Math.min(1, current / range));
        } else {
            progress = 1;
        }

        // ================= SOL TARA (SADECE İKON) =================
        const centerX = 300;
        const centerY = 250;

        // *Yuvarlak Bar Kaldırıldı*
        // Sadece İkon
        try {
            const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${currentLevel}.png`);
            const icon = await loadImage(iconPath);

            const iconSize = 250; // İkon biraz daha büyüdü
            ctx.drawImage(icon, centerX - (iconSize / 2), centerY - (iconSize / 2), iconSize, iconSize);
        } catch (e) {
            console.error('Icon Load Error:', e);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 120px sans-serif';
            ctx.fillText(currentLevel.toString(), centerX, centerY);
        }

        // ================= SAĞ TARAF (METİNLER) =================
        const textStartX = 600;

        // ÜST BAŞLIK 
        ctx.font = '500 36px "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#888888';
        ctx.textAlign = 'left';
        ctx.fillText(`LEVEL ${currentLevel} • NEXORA COMPETITIVE`, textStartX, 120);

        // KULLANICI ADI
        let displayName = user.username.toUpperCase();
        ctx.fillStyle = '#ffffff';
        if (displayName.length > 15) {
            ctx.font = 'bold 60px "Segoe UI", Roboto, sans-serif';
        } else {
            ctx.font = 'bold 90px "Segoe UI", Roboto, sans-serif';
        }

        if (displayName.length > 18) displayName = displayName.substring(0, 18) + '...';
        ctx.fillText(displayName, textStartX, 220);

        // ELO SAYILARI
        ctx.font = 'bold 100px "DIN Alternate", "Segoe UI", sans-serif';

        const currentEloText = `${elo}`;
        const maxEloText = currentLevel < 10 ? ` / ${levelData.max}` : '';

        ctx.fillStyle = '#ffffff';
        ctx.fillText(currentEloText, textStartX, 340);

        if (maxEloText) {
            const currentEloWidth = ctx.measureText(currentEloText).width;
            ctx.fillStyle = '#666666';
            ctx.fillText(maxEloText, textStartX + currentEloWidth, 340);
        }

        // ================= ALT BAR (GLOW EFEKTLİ) =================
        const barY = 400;
        const barHeight = 25;
        const barWidth = 800;

        // Arkaplan
        ctx.fillStyle = '#333333';
        ctx.fillRect(textStartX, barY, barWidth, barHeight);

        // Doluluk (GLOW)
        if (progress > 0) {
            ctx.fillStyle = '#ff5500'; // Turuncu
            ctx.shadowColor = '#ff5500';
            ctx.shadowBlur = 20; // GLOW EKLENDİ
            ctx.fillRect(textStartX, barY, barWidth * progress, barHeight);

            // Glow'u kapat
            ctx.shadowBlur = 0;
        }

        // ================= SONRAKİ LEVEL İKONU =================
        if (currentLevel < 10) {
            const nextLevel = currentLevel + 1;
            try {
                const nextIconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${nextLevel}.png`);
                const nextIcon = await loadImage(nextIconPath);

                const nextIconSize = 80;
                ctx.globalAlpha = 0.7;
                ctx.drawImage(nextIcon, textStartX + barWidth + 30, barY - 30, nextIconSize, nextIconSize);
                ctx.globalAlpha = 1.0;
            } catch (e) { }
        }

        return canvas.toBuffer();
    },

    // Leaderboard logic remains similar but simplified if needed
    async createLeaderboardImage(users) {
        const rowHeight = 150;
        const width = 2000;
        const height = (users.length * rowHeight) + 200;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        ctx.fillStyle = '#181818';
        ctx.fillRect(0, 0, width, height);

        ctx.fillStyle = '#ff5500';
        ctx.fillRect(0, 0, 20, height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('NEXORA TOP 10 LEADERBOARD', 100, 120);

        ctx.font = '40px sans-serif';
        ctx.fillStyle = '#888';
        ctx.fillText(`Last Update: ${new Date().toLocaleTimeString('tr-TR')}`, 1300, 120);

        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(100, 180);
        ctx.lineTo(1900, 180);
        ctx.stroke();

        let y = 280;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const stats = user.matchStats || { elo: 100 };
            const lvlInfo = getLevelInfo(stats.elo);

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

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = 'bold 60px sans-serif';
            const name = user.username || `Player ${user.odasi?.substring(0, 5) || '???'}`;
            ctx.fillText(name, 400, y + 15);

            ctx.fillStyle = '#eeeeee';
            ctx.textAlign = 'right';
            ctx.font = 'bold 60px sans-serif';
            ctx.fillText(`${stats.elo} ELO`, 1500, y + 15);

            const total = stats.totalMatches || 0;
            const wins = stats.totalWins || 0;
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
            ctx.fillStyle = wr >= 50 ? '#00ff00' : '#ff4400';
            ctx.font = '40px sans-serif';
            ctx.fillText(`%${wr} WR`, 1800, y + 15);

            y += rowHeight;
        }

        return canvas.toBuffer();
    }
};
