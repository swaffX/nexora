const { createCanvas, loadImage } = require('canvas');
const path = require('path');
const eloService = require('../services/eloService');

// ELO Level Info (Canvas için min/max/color bilgisi - eloService ile senkron)
const getLevelInfo = (elo) => {
    const level = eloService.getLevelFromElo(elo);
    const thresholds = eloService.ELO_CONFIG.LEVEL_THRESHOLDS;

    // Renk Haritası
    const colors = {
        1: '#00ff00', 2: '#00ff00', 3: '#00ff00',
        4: '#ffcc00', 5: '#ffcc00', 6: '#ffcc00', 7: '#ffcc00',
        8: '#ff4400', 9: '#ff4400', 10: '#ff0000'
    };

    // Min/Max hesapla
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
            // MUTLAK İLERLEME: Barın başı 0 ELO, sonu Target Level Max ELO.
            // Böylece 100 ELO'daki biri barın %20'sini dolu görür (100/500).
            progress = elo / levelData.max;
            progress = Math.min(1, Math.max(0, progress));
        } else {
            progress = 1;
        }

        // ================= SOL TARA (SADECE İKON) =================
        const centerX = 300;
        const centerY = 250;

        try {
            const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${currentLevel}.png`);
            const icon = await loadImage(iconPath);

            const iconSize = 250;
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
            ctx.save();
            ctx.fillStyle = '#ff5500'; // Turuncu

            // GLOW
            ctx.shadowColor = '#ff5500';
            ctx.shadowBlur = 30; // Güçlü Glow
            ctx.fillRect(textStartX, barY, barWidth * progress, barHeight);

            ctx.restore();
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

    async createLeaderboardImage(users) {
        // LEIDEBOARD DA RETINA KALİTESİ
        const rowHeight = 150;
        const width = 2000;
        const height = (users.length * rowHeight) + 200;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Arkaplan
        ctx.fillStyle = '#181818';
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#ff5500';
        ctx.fillRect(0, 0, 20, height);

        // Başlık (Sol)
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('TOP 10 LEADERBOARD', 60, 120);

        // Tarih (Sağ - Çakışmayı Önlemek İçin)
        ctx.font = '40px sans-serif';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'right'; // EN SAĞA YASLA
        ctx.fillText(`Update: ${new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })}`, 1950, 120);

        // Çizgi
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

            // Sıra No
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
            ctx.fillText(`%${wr} WR`, 1900, y + 15);

            y += rowHeight;
        }

        return canvas.toBuffer();
    }
};
