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

        let totalEloWidth = ctx.measureText(currentEloText).width;

        if (maxEloText) {
            const currentEloWidth = ctx.measureText(currentEloText).width;
            ctx.fillStyle = '#666666';
            ctx.fillText(maxEloText, textStartX + currentEloWidth, 340);
            totalEloWidth += ctx.measureText(maxEloText).width;
        }

        // --- WIN RATE & STREAK ---
        const total = stats.totalMatches || 0;
        const wins = stats.totalWins || 0;
        const wr = total > 0 ? Math.round((wins / total) * 100) : 0;

        ctx.font = 'bold 45px "Segoe UI", sans-serif';
        ctx.fillStyle = wr >= 50 ? '#00ff00' : '#ff4400';
        ctx.textAlign = 'left';
        ctx.fillText(`%${wr} WIN RATE`, textStartX + totalEloWidth + 40, 340);

        // STREAK
        const streak = stats.winStreak || 0;
        if (streak >= 3) {
            ctx.fillStyle = '#ff5500';
            ctx.fillText(`🔥 ${streak} STREAK`, textStartX, 390); // Barın hemen üstü/altı
        } else if (streak > 0) {
            ctx.fillStyle = '#888888';
            ctx.font = 'bold 30px "Segoe UI", sans-serif';
            ctx.fillText(`${streak} Win Streak`, textStartX + totalEloWidth + 300, 340);
        }

        // ================= ALT BAR (GLOW EFEKTLİ) =================
        const barY = 410; // Biraz aşağı aldım streak sığsın diye
        const barHeight = 25;
        const barWidth = 800;

        // ... (Bar çizimi aynı kalabilir, sadece Y koordinatı güncellenmeli)

        // Arkaplan
        ctx.fillStyle = '#333333';
        ctx.fillRect(textStartX, barY, barWidth, barHeight);

        // Doluluk
        if (progress > 0) {
            ctx.save();
            ctx.fillStyle = '#ff5500';
            ctx.shadowColor = '#ff5500';
            ctx.shadowBlur = 30;
            ctx.fillRect(textStartX, barY, barWidth * progress, barHeight);
            ctx.restore();
        }

        // ...
        return canvas.toBuffer();
    },

    async createLeaderboardImage(users) {
        // Canvas Boyutları
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

        // Sol Kenar Çizgisi
        ctx.fillStyle = '#ff5500';
        ctx.fillRect(0, 0, 20, height);

        // Başlık
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('TOP 10 LEADERBOARD', 60, 120);

        // Güncelleme Saati
        ctx.font = '40px sans-serif';
        ctx.fillStyle = '#888';
        ctx.textAlign = 'right';
        ctx.fillText(`Update: ${new Date().toLocaleTimeString('tr-TR', { timeZone: 'Europe/Istanbul' })}`, 1950, 120);

        // Ayırıcı Çizgi
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(60, 180);
        ctx.lineTo(1940, 180);
        ctx.stroke();

        let y = 280;

        for (let i = 0; i < users.length; i++) {
            const user = users[i];
            const stats = user.matchStats || { elo: eloService.ELO_CONFIG.DEFAULT_ELO };
            const lvlInfo = getLevelInfo(stats.elo);
            const streak = stats.winStreak || 0;

            // Sıra Numarası
            ctx.font = 'bold 60px sans-serif';
            ctx.textAlign = 'center';
            let rankColor = '#ffffff';
            if (i === 0) rankColor = '#ffcc00'; // Altın
            if (i === 1) rankColor = '#c0c0c0'; // Gümüş
            if (i === 2) rankColor = '#cd7f32'; // Bronz
            ctx.fillStyle = rankColor;
            ctx.fillText(`#${i + 1}`, 150, y);

            // Level İkonu
            try {
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                const icon = await loadImage(iconPath);
                ctx.drawImage(icon, 250, y - 60, 100, 100);
            } catch (e) { }

            // İsim (Streak varsa turuncu + ateş)
            ctx.textAlign = 'left';
            ctx.font = 'bold 60px sans-serif';
            const name = user.username || `Player ${user.odasi?.substring(0, 5) || '???'}`;

            if (streak >= 3) {
                ctx.fillStyle = '#ff8800';
                ctx.fillText(`${name} 🔥`, 400, y + 15);
            } else {
                ctx.fillStyle = '#ffffff';
                ctx.fillText(name, 400, y + 15);
            }

            // --- Win / Lose Stats ---
            const wCount = stats.totalWins || 0;
            const lCount = (stats.totalMatches || 0) - wCount;

            ctx.font = 'bold 40px sans-serif';
            let statCursor = 1250; // ELO (1500) öncesi güvenli boşluk

            // Lose (Right Align)
            ctx.textAlign = 'right';
            ctx.fillStyle = '#e74c3c'; // Kırmızı
            const lText = `${lCount} Lose`;
            ctx.fillText(lText, statCursor, y + 10);

            const lWidth = ctx.measureText(lText).width;

            // Win (Right Align - Lose'un solu)
            ctx.fillStyle = '#2ecc71'; // Yeşil
            ctx.fillText(`${wCount} Win`, statCursor - lWidth - 30, y + 10);

            // ELO
            ctx.fillStyle = '#eeeeee';
            ctx.textAlign = 'right';
            ctx.font = 'bold 60px sans-serif';
            ctx.fillText(`${stats.elo} ELO`, 1500, y + 15);

            // Win Rate
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
        // teamA/B structure: { user: UserObject (Discord), stats: { matchLevel, elo }, name: string }

        const width = 1920;
        const height = 1080;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;

        // 1. Arkaplan (Harita Görseli)
        try {
            // Map handling logic similar to game.js
            const assetsPath = path.join(__dirname, '..', '..', 'assets', 'maps');
            let mapPath = path.join(assetsPath, `${mapName}.png`);
            if (!require('fs').existsSync(mapPath)) mapPath = path.join(assetsPath, `${mapName.toLowerCase()}.png`);

            if (require('fs').existsSync(mapPath)) {
                const bg = await loadImage(mapPath);
                // Cover mode logic
                const scale = Math.max(width / bg.width, height / bg.height);
                const x = (width / 2) - (bg.width * scale / 2);
                const y = (height / 2) - (bg.height * scale / 2);
                ctx.drawImage(bg, x, y, bg.width * scale, bg.height * scale);
            } else {
                ctx.fillStyle = '#2B2D31'; // Fallback bg
                ctx.fillRect(0, 0, width, height);
            }
        } catch (e) {
            ctx.fillStyle = '#2B2D31';
            ctx.fillRect(0, 0, width, height);
        }

        // Karartma & Blur efekti (Gradient)
        // Sol Mavi, Sağ Kırmızı
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        gradient.addColorStop(0, 'rgba(0, 0, 40, 0.9)');    // Koyu Mavi
        gradient.addColorStop(0.4, 'rgba(0, 0, 20, 0.7)');
        gradient.addColorStop(0.6, 'rgba(40, 0, 0, 0.7)');
        gradient.addColorStop(1, 'rgba(60, 0, 0, 0.9)');  // Koyu Kırmızı
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        // VS Text Ortalama
        ctx.font = 'bold 250px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // V
        ctx.fillStyle = '#ffffff';
        ctx.fillText('V', width / 2 - 20, height / 2);
        // S
        ctx.fillStyle = '#ff5500'; // Nexora Orange
        ctx.fillText('S', width / 2 + 130, height / 2);

        // --- DRAW CAPTAIN FUNCTION ---
        const drawCaptain = async (captainData, x, align) => {
            const { user, stats, name } = captainData;

            // Avatar
            const avatarSize = 400;
            const avatarY = height / 2 - 100;

            try {
                // Yuvarlak Avatar
                ctx.save();
                ctx.beginPath();
                ctx.arc(x, avatarY, avatarSize / 2, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();

                const avatarURL = user.displayAvatarURL({ extension: 'png', size: 512 });
                const avatar = await loadImage(avatarURL);
                ctx.drawImage(avatar, x - avatarSize / 2, avatarY - avatarSize / 2, avatarSize, avatarSize);
                ctx.restore();

                // Çerçeve
                ctx.beginPath();
                ctx.arc(x, avatarY, avatarSize / 2, 0, Math.PI * 2);
                ctx.lineWidth = 15;
                ctx.strokeStyle = align === 'left' ? '#3498DB' : '#E74C3C'; // Team Colors
                ctx.stroke();

                // Level İkonu (Avatarın altına bindir)
                const lvlInfo = getLevelInfo(stats.elo);
                const iconPath = path.join(__dirname, '..', '..', 'faceitsekli', `${lvlInfo.lv}.png`);
                try {
                    const icon = await loadImage(iconPath);
                    const iconSize = 120;
                    ctx.drawImage(icon, x - (iconSize / 2), avatarY + (avatarSize / 2) - 40, iconSize, iconSize);
                } catch (e) { }

            } catch (e) {
                console.error("Avatar load error", e);
            }

            // İsim
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 80px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(name.toUpperCase(), x, avatarY + avatarSize / 2 + 110);

            // Level & ELO Text
            ctx.font = '50px sans-serif';
            ctx.fillStyle = '#cccccc';
            ctx.fillText(`Level ${stats.matchLevel} • ${stats.elo} ELO`, x, avatarY + avatarSize / 2 + 170);
        };

        // Kaptan A (Sol - Mavi)
        await drawCaptain(teamA, width * 0.25, 'left');

        // Kaptan B (Sağ - Kırmızı)
        await drawCaptain(teamB, width * 0.75, 'right');

        // Map İsmi (En üst ortada)
        ctx.font = 'bold 60px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.fillText(`MAP: ${mapName.toUpperCase()}`, width / 2, 100);

        return canvas.toBuffer();
    }
};
