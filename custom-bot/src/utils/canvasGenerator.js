const { createCanvas, loadImage } = require('canvas');
const path = require('path');

// ELO ARALIKLARI (GÜNCEL)
// Level 1: 100 - 500
// Level 2: 501 - 750 (Aralık: 250)
// ...
const getLevelInfo = (elo) => {
    if (elo <= 500) return { lv: 1, min: 100, max: 500, color: '#00ff00' }; // Yeşil
    if (elo <= 750) return { lv: 2, min: 501, max: 750, color: '#00ff00' };
    if (elo <= 900) return { lv: 3, min: 751, max: 900, color: '#00ff00' };
    if (elo <= 1050) return { lv: 4, min: 901, max: 1050, color: '#ffcc00' }; // Sarı
    if (elo <= 1200) return { lv: 5, min: 1051, max: 1200, color: '#ffcc00' };
    if (elo <= 1350) return { lv: 6, min: 1201, max: 1350, color: '#ffcc00' };
    if (elo <= 1530) return { lv: 7, min: 1351, max: 1530, color: '#ffcc00' };
    if (elo <= 1750) return { lv: 8, min: 1531, max: 1750, color: '#ff4400' }; // Turuncu/Kırmızı
    if (elo <= 2000) return { lv: 9, min: 1751, max: 2000, color: '#ff4400' };
    return { lv: 10, min: 2001, max: 99999, color: '#ff0000' }; // Kırmızı
};

module.exports = {
    async createEloCard(user, stats) {
        // RETINA ÇÖZÜNÜRLÜK (2X SCALE)
        const width = 1600;
        const height = 500;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // YUMUŞATMA AYARLARI
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.antialias = 'subpixel'; // Metin netliği için

        // 1. ARKAPLAN (FaceIT Dark)
        ctx.fillStyle = '#181818'; // Daha koyu, neredeyse siyah
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
            progress = 1; // Max level
        }

        // ================= SOL TARA (DAİRESEL GRAFİK) =================
        const centerX = 300;
        const centerY = 250;
        const radius = 160;   // Daire Büyüklüğü
        const lineWidth = 30; // Çizgi Kalınlığı

        // 2. BOŞ HALKA (Arka Plandaki Sönük Daire)
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#282828'; // Koyu gri
        ctx.lineWidth = lineWidth;
        ctx.stroke();

        // 3. DOLU HALKA (Progress)
        // FaceIT stili: Üstten başlar (-90 derece)
        // Kapsül ucu için lineCap = 'round' değil 'butt' kullanacağız ama şık dursun diye round yapıyorum
        const startAngle = -Math.PI / 2;
        const endAngle = startAngle + (Math.PI * 2 * progress);

        if (progress > 0) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.strokeStyle = levelData.color; // Level Rengi
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round'; // Uçları yuvarlak

            // Neon Efekti (Hafif Glow)
            ctx.shadowColor = levelData.color;
            ctx.shadowBlur = 15;
            ctx.stroke();

            // Gölgeyi sıfırla (Diğer cisimlere bulaşmasın)
            ctx.shadowBlur = 0;
        }

        // 4. ORTA LEVE İKONU
        // İkonu dairenin tam ortasına yerleştiriyoruz.
        try {
            const iconPath = path.join(__dirname, '..', '..', 'levels', `${currentLevel}.png`);
            const icon = await loadImage(iconPath);

            // İkon Boyutu: Dairenin içine sığacak kadar (radius * 1.2)
            const iconSize = 200;
            ctx.drawImage(icon, centerX - (iconSize / 2), centerY - (iconSize / 2), iconSize, iconSize);
        } catch (e) {
            // İkon yoksa Yazı
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 120px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentLevel.toString(), centerX, centerY);
        }

        // ================= SAĞ TARAF (METİNLER) =================
        const textStartX = 600;

        // 5. ÜST BAŞLIK (LEVEL X - NEXORA)
        ctx.font = '500 36px "Segoe UI", Roboto, sans-serif'; // Daha ince
        ctx.fillStyle = '#888888'; // Gri
        ctx.textAlign = 'left';
        ctx.fillText(`LEVEL ${currentLevel} • NEXORA COMPETITIVE`, textStartX, 120);

        // 6. KULLANICI ADI
        ctx.font = 'bold 90px "Segoe UI", Roboto, sans-serif';
        ctx.fillStyle = '#ffffff';
        let displayName = user.username.toUpperCase();
        if (displayName.length > 12) displayName = displayName.substring(0, 12) + '...';
        ctx.fillText(displayName, textStartX, 220);

        // 7. ELO SAYILARI (600 / 750)
        // ELO kısmı beyaz, Slash ve Max kısmı gri olabilir veya hepsi beyaz
        ctx.font = 'bold 100px "DIN Alternate", "Segoe UI", sans-serif'; // Sayılar için monospaced tarzı

        const currentEloText = `${elo}`;
        const maxEloText = currentLevel < 10 ? ` / ${levelData.max}` : '';

        ctx.fillStyle = '#ffffff';
        ctx.fillText(currentEloText, textStartX, 340);

        // Slash ve Max kısmı biraz daha silik
        if (maxEloText) {
            const currentEloWidth = ctx.measureText(currentEloText).width;
            ctx.fillStyle = '#666666'; // Koyu Gri
            ctx.fillText(maxEloText, textStartX + currentEloWidth, 340);
        }

        // ================= ALT BAR (TURUNCU ÇİZGİ) =================
        // Referans görselde altta ince bir XP barı var.
        const barY = 400;
        const barHeight = 25; // İnceliği artırdım
        const barWidth = 800; // Uzunluk

        // Arkaplan
        ctx.fillStyle = '#333333';
        ctx.fillRect(textStartX, barY, barWidth, barHeight);

        // Doluluk
        ctx.fillStyle = '#ff5500'; // FaceIT Turuncusu
        ctx.fillRect(textStartX, barY, barWidth * progress, barHeight);

        // ================= SONRAKİ LEVEL İKONU (KÜÇÜK) =================
        // Barın sağ ucuna bir sonraki levelin ikonu
        if (currentLevel < 10) {
            const nextLevel = currentLevel + 1;
            try {
                const nextIconPath = path.join(__dirname, '..', '..', 'levels', `${nextLevel}.png`);
                const nextIcon = await loadImage(nextIconPath);

                // İkonu barın sonuna, biraz şefaf çiz
                const nextIconSize = 80;
                ctx.globalAlpha = 0.7; // Hafif silik
                ctx.drawImage(nextIcon, textStartX + barWidth + 30, barY - 30, nextIconSize, nextIconSize);
                ctx.globalAlpha = 1.0;
            } catch (e) { }
        }

        return canvas.toBuffer();
    },

    async createLeaderboardImage(users) {
        // LEIDEBOARD DA RETINA KALİTESİ
        const rowHeight = 150; // Satır yüksekliği arttı
        const width = 2000;
        const scale = 2; // Her şeyi büyüterek çiziyoruz
        const height = (users.length * rowHeight) + 200; // Header payı

        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';

        // Arkaplan
        ctx.fillStyle = '#181818';
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.fillStyle = '#ff5500'; // Turuncu Header Çizgisi
        ctx.fillRect(0, 0, 20, height);

        // Başlık
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 80px sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText('NEXORA TOP 10 LEADERBOARD', 100, 120);

        ctx.font = '40px sans-serif';
        ctx.fillStyle = '#888';
        ctx.fillText(`Last Update: ${new Date().toLocaleTimeString('tr-TR')}`, 1300, 120);

        // Ayırıcı Çizgi
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

            // Sıra No (#1, #2)
            ctx.font = 'bold 60px sans-serif';
            ctx.textAlign = 'center';

            let rankColor = '#ffffff';
            if (i === 0) rankColor = '#ffcc00'; // Gold
            if (i === 1) rankColor = '#c0c0c0'; // Silver
            if (i === 2) rankColor = '#cd7f32'; // Bronze

            ctx.fillStyle = rankColor;
            ctx.fillText(`#${i + 1}`, 150, y);

            // Level Icon
            try {
                const iconPath = path.join(__dirname, '..', '..', 'levels', `${lvlInfo.lv}.png`);
                const icon = await loadImage(iconPath);
                ctx.drawImage(icon, 250, y - 60, 100, 100); // 100x100 ikon
            } catch (e) { }

            // İsim
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';
            ctx.font = 'bold 60px sans-serif';
            const name = user.username || `Player ${user.odasi?.substring(0, 5) || '???'}`;
            ctx.fillText(name, 400, y + 15);

            // ELO
            ctx.fillStyle = '#eeeeee';
            ctx.textAlign = 'right';
            ctx.font = 'bold 60px sans-serif';
            ctx.fillText(`${stats.elo} ELO`, 1500, y + 15);

            // WR (Win Rate)
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
