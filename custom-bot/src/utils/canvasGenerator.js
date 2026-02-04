const { createCanvas, loadImage, registerFont } = require('canvas');
const path = require('path');

// ELO Ranges
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

        // --- Arkaplan (Koyu Gri) ---
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, width, height);

        // Yuvarlatılmış Köşeler (CSS border-radius effect)
        // (Canvas'ta maskeleme yapabiliriz ama düz dikdörtgen de şık durur)

        const elo = stats.elo || 1000;
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
        } else {
            progress = 1; // Max level
        }

        // 3. İlerleme Çemberi (Yeşil/Turuncu)
        // Başlangıç: -90 derece (Saat 12 yönü)
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * progress);

        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.strokeStyle = '#2ecc71'; // Yeşil
        if (currentLevel >= 8) ctx.strokeStyle = '#f1c40f'; // Altın
        if (currentLevel === 10) ctx.strokeStyle = '#e74c3c'; // Kırmızı
        ctx.lineWidth = 20;
        ctx.lineCap = 'round';
        ctx.stroke();

        // 4. Ortaya Level İkonu
        try {
            const iconPath = path.join(__dirname, '..', '..', 'levels', `${currentLevel}.png`);
            const icon = await loadImage(iconPath);
            // Resmi ortaya çiz (60x60 gibi)
            ctx.drawImage(icon, centerX - 50, centerY - 50, 100, 100);
        } catch (e) {
            // İkon yoksa Yazı yaz
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 60px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentLevel.toString(), centerX, centerY);
        }

        // --- Sağ Taraf: İsim ve ELO Barı ---
        const startX = 300;

        // İsim
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(user.username.toUpperCase(), startX, 80);

        // Level Title
        ctx.font = '20px Arial';
        ctx.fillStyle = '#aaaaaa';
        ctx.fillText(`LEVEL ${currentLevel} • FACEIT STYLE`, startX, 45);

        // ELO Text (600 / 750)
        ctx.font = 'bold 50px Arial';
        ctx.fillStyle = '#ffffff';
        if (currentLevel < 10) {
            ctx.fillText(`${elo} / ${levelData.max}`, startX, 140);
        } else {
            ctx.fillText(`${elo} ELO`, startX, 140);
        }

        // Alt Bar (Linear Progress)
        const barWidth = 400;
        const barHeight = 20;
        const barY = 180;

        // Bar Arkaplan
        ctx.fillStyle = '#333333';
        ctx.fillRect(startX, barY, barWidth, barHeight);

        // Bar Doluluk
        ctx.fillStyle = '#e67e22'; // Turuncu
        ctx.fillRect(startX, barY, barWidth * progress, barHeight);

        // Sonraki Level İkonu (Küçük)
        if (currentLevel < 10) {
            try {
                const nextIconPath = path.join(__dirname, '..', '..', 'levels', `${currentLevel + 1}.png`);
                const nextIcon = await loadImage(nextIconPath);
                // Barın sonuna koy
                ctx.drawImage(nextIcon, startX + barWidth + 20, barY - 15, 50, 50);

                // İçine sayı yaz
                /*
                ctx.fillStyle = '#000';
                ctx.font = 'bold 20px Arial';
                ctx.textAlign = 'center';
                ctx.fillText((currentLevel + 1).toString(), startX + barWidth + 45, barY + 10);
                */
            } catch (e) { }
        }

        return canvas.toBuffer();
    },

    async createLeaderboardImage(users) {
        // Liste Resim Boyutları
        const rowHeight = 80;
        const width = 1000;
        const height = (users.length * rowHeight) + 100; // +100 Header

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Arkaplan
        ctx.fillStyle = '#1e1e1e';
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#f1c40f'; // Altın
        ctx.fillRect(0, 0, 10, height); // Sol Şerit

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
            const stats = user.matchStats || { elo: 1000 };
            const lvlInfo = getLevelInfo(stats.elo);

            // Sıra No
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px Arial';
            ctx.textAlign = 'center';

            let rankColor = '#ffffff';
            if (i === 0) rankColor = '#f1c40f'; // Gold
            if (i === 1) rankColor = '#bdc3c7'; // Silver
            if (i === 2) rankColor = '#cd7f32'; // Bronze

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
            // İsim veritabanında user.username olarak yoksa user.displayName veya odasi olabilir.
            // Bot tarafında bu user object mongoose doc'u. Usernamesi olmayabilir.
            // Client'tan çekmek lazım aslında ama burada DB verisi var.
            // DB'de username yoksa ID yazarız.
            const name = user.username || `Player ${user.odasi.substring(0, 5)}`;
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
