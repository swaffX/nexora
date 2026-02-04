const { createCanvas, loadImage } = require('canvas');
const path = require('path');

// ELO Ranges (Updated)
const getLevelInfo = (elo) => {
    if (elo <= 500) return { lv: 1, min: 100, max: 500 };
    if (elo <= 750) return { lv: 2, min: 501, max: 750 };
    if (elo <= 900) return { lv: 3, min: 751, max: 900 };
    if (elo <= 1050) return { lv: 4, min: 901, max: 1050 };
    if (elo <= 1200) return { lv: 5, min: 1051, max: 1200 };
    if (elo <= 1350) return { lv: 6, min: 1201, max: 1350 };
    if (elo <= 1530) return { lv: 7, min: 1351, max: 1530 };
    if (elo <= 1750) return { lv: 8, min: 1531, max: 1750 };
    if (elo <= 2000) return { lv: 9, min: 1751, max: 2000 };
    return { lv: 10, min: 2001, max: 99999 };
};

module.exports = {
    async createEloCard(user, stats) {
        const width = 800;
        const height = 250;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Yüksek Kalite Ayarları (Smoothing)
        ctx.imageSmoothingEnabled = true;

        // --- Arkaplan (Koyu Gri) ---
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, width, height);

        const elo = stats.elo !== undefined ? stats.elo : 100; // Default 100
        const levelData = getLevelInfo(elo);
        const currentLevel = levelData.lv;

        // --- Sol Taraf: Yuvarlak Progress & Level ---
        const centerX = 150;
        const centerY = 125;
        const radius = 80;

        // 1. Dış Çember (Koyu)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#2b2b2b';
        ctx.lineWidth = 20;
        ctx.stroke();

        // 2. İlerleme Hesabı
        let progress = 0;
        if (currentLevel < 10) {
            progress = (elo - levelData.min) / (levelData.max - levelData.min);
            if (progress < 0) progress = 0;
            if (progress > 1) progress = 1;
        } else {
            progress = 1;
        }

        // 3. İlerleme Çemberi
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * progress);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);

        let progressColor = '#2ecc71'; // Yeşil (Default)
        if (currentLevel >= 4) progressColor = '#f1c40f'; // Sarı
        if (currentLevel >= 8) progressColor = '#e74c3c'; // Kırmızı

        ctx.strokeStyle = progressColor;
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 4. Ortaya Level İkonu (Boyut: 90x90, Ortalı)
        try {
            const iconPath = path.join(__dirname, '..', '..', 'levels', `${currentLevel}.png`);
            const icon = await loadImage(iconPath);
            ctx.drawImage(icon, centerX - 45, centerY - 45, 90, 90);
        } catch (e) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 60px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentLevel.toString(), centerX, centerY);
        }

        // --- Sağ Taraf ---
        const startX = 300;

        // İsim
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(user.username.toUpperCase(), startX, 85);

        // Subtitle
        ctx.font = '18px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`LEVEL ${currentLevel} • NEXORA COMPETITIVE`, startX, 50);

        // ELO (100 / 500)
        ctx.font = 'bold 50px Arial';
        ctx.fillStyle = '#ffffff';
        const eloText = currentLevel < 10 ? `${elo} / ${levelData.max}` : `${elo} ELO`;
        ctx.fillText(eloText, startX, 145);

        // Alt Bar
        const barWidth = 400;
        const barHeight = 20;
        const barY = 180;

        // Bar Arkaplan
        ctx.fillStyle = '#333333';
        ctx.fillRect(startX, barY, barWidth, barHeight);

        // Bar Doluluk
        ctx.fillStyle = '#e67e22'; // Turuncu Bar
        ctx.fillRect(startX, barY, barWidth * progress, barHeight);

        // Sonraki Level İkonu (Küçük)
        if (currentLevel < 10) {
            try {
                const nextIconPath = path.join(__dirname, '..', '..', 'levels', `${currentLevel + 1}.png`);
                const nextIcon = await loadImage(nextIconPath);
                ctx.drawImage(nextIcon, startX + barWidth + 20, barY - 15, 50, 50);
            } catch (e) { }
        }

        return canvas.toBuffer();
    },

    async createLeaderboardImage(users) {
        const rowHeight = 80;
        const width = 1000;
        const height = (users.length * rowHeight) + 100;

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        // Arkaplan
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#f1c40f';
        ctx.fillRect(0, 0, 10, height);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'left';
        ctx.fillText('NEXORA TOP 10 LEADERBOARD', 50, 60);

        ctx.font = '20px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`Last Update: ${new Date().toLocaleTimeString('tr-TR')}`, 700, 60);

        // Çizgi
        ctx.strokeStyle = '#444';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(50, 90);
        ctx.lineTo(950, 90);
        ctx.stroke();

        let y = 140;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const stats = user.matchStats || { elo: 100 };
            const lvlInfo = getLevelInfo(stats.elo);

            // Sıra No
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';
            let rankColor = '#ffffff';
            if (i === 0) rankColor = '#f1c40f';
            if (i === 1) rankColor = '#bdc3c7';
            if (i === 2) rankColor = '#cd7f32';
            ctx.fillStyle = rankColor;
            ctx.fillText(`#${i + 1}`, 80, y);

            // Level Icon
            try {
                const iconPath = path.join(__dirname, '..', '..', 'levels', `${lvlInfo.lv}.png`);
                const icon = await loadImage(iconPath);
                ctx.drawImage(icon, 150, y - 30, 40, 40);
            } catch (e) { }

            // İsim
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = 'bold 30px Arial';
            const name = user.username || `Player ${user.odasi?.substring(0, 5) || 'Unknown'}`;
            ctx.fillText(name, 220, y);

            // ELO
            ctx.fillStyle = '#ecf0f1';
            ctx.textAlign = 'right';
            ctx.font = 'bold 30px Arial';
            ctx.fillText(`${stats.elo} ELO`, 800, y);

            // Win Rate
            const total = stats.totalMatches || 0;
            const wins = stats.totalWins || 0;
            const wr = total > 0 ? Math.round((wins / total) * 100) : 0;
            ctx.fillStyle = wr >= 50 ? '#2ecc71' : '#e74c3c';
            ctx.font = '20px Arial';
            ctx.fillText(`%${wr} WR`, 950, y);

            y += rowHeight;
        }
        return canvas.toBuffer();
    }
};
