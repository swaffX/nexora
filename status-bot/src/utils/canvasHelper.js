const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Font Register (Eğer font dosyası varsa ve bu yol doğruysa)
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');
} catch (e) {
    // console.error('Font yükleme hatası:', e);
}

// Yuvarlak Avatar Kırpma
function applyRoundAvatar(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
}

async function createLeaderboardImage(guildName, guildIconUrl, data, client) {
    const width = 1000;
    const height = 650;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Arkaplan (Derin Koyu - Stats/Elo Tarzı)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#09090b'); // Kömür karası (Stats bot ile uyumlu)
    bgGradient.addColorStop(1, '#020202'); // Simsiyah
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Hafif Grid (Opaklık çok düşük)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 50) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let i = 0; i < height; i += 50) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    // 2. Header (NEXORA with Glow) --
    // Logo (Ortada, parlayan)
    if (guildIconUrl) {
        try {
            const logo = await loadImage(guildIconUrl);
            const logoSize = 90;
            const logoX = width / 2 - logoSize / 2;
            const logoY = 30;

            // Logo Glow
            ctx.filter = 'blur(20px)';
            ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
            ctx.filter = 'none';

            ctx.save();
            applyRoundAvatar(ctx, logoX, logoY, logoSize);
            ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
            ctx.restore();
        } catch (e) { }
    }

    ctx.fillStyle = '#ffffff';
    // Font yüklenmediyse sans-serif fallback
    ctx.font = '60px VALORANT, sans-serif';
    ctx.textAlign = 'center';

    // Kırmızı neon glow (NEXORA teması)
    ctx.shadowColor = '#ff4655';
    ctx.shadowBlur = 25;
    ctx.fillText(guildName.toUpperCase(), width / 2, 160);
    ctx.shadowBlur = 0;

    // 3. İki Sütun (Voice & Chat)
    // Sütunlar arası boşluk ve düzen
    // Sol: 50, Sağ: 540 (Width 1000 ise ortada boşluk kalsın)
    // Voice: Mavi tema, Chat: Yeşil tema
    await drawRankList(ctx, 'TOP VOICE', 60, 200, data.voice, client, 'voice', '#3b82f6');
    await drawRankList(ctx, 'TOP CHAT', 540, 200, data.messages, client, 'msg', '#10b981');

    // 4. Footer (Stats Style)
    const footerY = 570;
    const footerHeight = height - footerY;

    // Footer Background with Glow
    ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
    ctx.fillRect(0, footerY, width, footerHeight);

    // Top border glow line
    const footerLine = ctx.createLinearGradient(0, footerY, width, footerY);
    footerLine.addColorStop(0, 'transparent');
    footerLine.addColorStop(0.5, '#ff4655');
    footerLine.addColorStop(1, 'transparent');
    ctx.fillStyle = footerLine;
    ctx.fillRect(0, footerY, width, 2);

    // Text
    ctx.font = 'bold 24px "Segoe UI", sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';

    const totalHours = Math.floor(data.stats.totalVoice / 60);
    const totalMins = data.stats.totalVoice % 60;

    // Değerleri renkli yapalım
    // Üye
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Üye: `, width / 2 - 250, 615);
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    ctx.fillText(`${data.stats.trackedUsers}`, width / 2 - 210, 615);
    ctx.shadowBlur = 0;

    // Mesaj
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Mesaj: `, width / 2, 615);
    ctx.fillStyle = '#10b981'; ctx.shadowColor = '#10b981'; ctx.shadowBlur = 10;
    ctx.fillText(`${data.stats.totalMessages.toLocaleString()}`, width / 2 + 50, 615);
    ctx.shadowBlur = 0;

    // Ses
    ctx.fillStyle = '#aaa';
    ctx.fillText(`Toplam Ses: `, width / 2 + 250, 615);
    ctx.fillStyle = '#3b82f6'; ctx.shadowColor = '#3b82f6'; ctx.shadowBlur = 10;
    ctx.fillText(`${totalHours}s ${totalMins}dk`, width / 2 + 340, 615);
    ctx.shadowBlur = 0;

    return canvas.encode('png');
}

const userAvatarCache = new Map();

async function drawRankList(ctx, title, x, y, list, client, type, themeColor) {
    const colWidth = 400; // Genişletildi

    // Başlık
    ctx.fillStyle = `rgba(${parseInt(themeColor.slice(1, 3), 16)}, ${parseInt(themeColor.slice(3, 5), 16)}, ${parseInt(themeColor.slice(5, 7), 16)}, 0.1)`;
    ctx.fillRect(x, y, colWidth, 50);

    // Sol Çizgi (Glowlu)
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 15;
    ctx.fillStyle = themeColor;
    ctx.fillRect(x, y, 4, 50);
    ctx.shadowBlur = 0;

    ctx.font = '32px VALORANT, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';

    // Title Glow
    ctx.shadowColor = themeColor;
    ctx.shadowBlur = 10;
    ctx.fillText(title, x + 25, y + 36);
    ctx.shadowBlur = 0;

    let currentY = y + 70;
    const top5 = list.slice(0, 5);

    for (let i = 0; i < 5; i++) {
        const item = top5[i];

        // Item Background
        if (!item) {
            // Empty slot
            currentY += 65;
            continue;
        }

        // 1. Sıra için özel arkaplan
        if (i === 0) {
            const grad = ctx.createLinearGradient(x, currentY, x + colWidth, currentY);
            grad.addColorStop(0, `rgba(${parseInt(themeColor.slice(1, 3), 16)}, ${parseInt(themeColor.slice(3, 5), 16)}, ${parseInt(themeColor.slice(5, 7), 16)}, 0.15)`);
            grad.addColorStop(1, 'transparent');
            ctx.fillStyle = grad;
            ctx.fillRect(x, currentY - 10, colWidth, 60);
        } else if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.fillRect(x, currentY - 10, colWidth, 60);
        }

        // Rank Number
        ctx.font = 'bold 30px sans-serif';
        if (i === 0) { ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10; }
        else if (i === 1) { ctx.fillStyle = '#94a3b8'; ctx.shadowColor = '#94a3b8'; ctx.shadowBlur = 5; }
        else if (i === 2) { ctx.fillStyle = '#b45309'; ctx.shadowColor = '#b45309'; ctx.shadowBlur = 5; }
        else { ctx.fillStyle = '#64748b'; ctx.shadowBlur = 0; }

        ctx.fillText(`${i + 1}`, x + 15, currentY + 30);
        ctx.shadowBlur = 0;

        // Avatar
        let avatarImage;
        const cacheKey = item.userId;
        if (userAvatarCache.has(cacheKey)) {
            const cached = userAvatarCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 10 * 60 * 1000) avatarImage = cached.image;
        }
        if (!avatarImage) {
            try {
                let user = client.users.cache.get(item.userId);
                if (!user) user = await client.users.fetch(item.userId);
                if (user) {
                    const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 64, forceStatic: true });
                    avatarImage = await loadImage(avatarUrl);
                    userAvatarCache.set(cacheKey, { image: avatarImage, timestamp: Date.now() });
                }
            } catch (e) { }
        }

        if (avatarImage) {
            const avatarSize = 46;
            ctx.save();
            applyRoundAvatar(ctx, x + 55, currentY - 5, avatarSize);
            ctx.drawImage(avatarImage, x + 55, currentY - 5, avatarSize, avatarSize);
            ctx.restore();

            // Avatar Border (Optional)
            if (i === 0) {
                ctx.beginPath();
                ctx.arc(x + 55 + avatarSize / 2, currentY - 5 + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
                ctx.strokeStyle = themeColor;
                ctx.lineWidth = 2;
                ctx.stroke();
            }
        }

        // Username
        let username = 'Bilinmiyor';
        try {
            const user = client.users.cache.get(item.userId);
            if (user) username = user.username;
        } catch (e) { }

        ctx.font = 'bold 20px "Segoe UI", sans-serif';
        ctx.fillStyle = '#ffffff';
        // Rank 1 ismi glowlu
        if (i === 0) { ctx.shadowColor = themeColor; ctx.shadowBlur = 10; }
        ctx.fillText(username.substring(0, 15), x + 115, currentY + 15);
        ctx.shadowBlur = 0;

        // Value
        ctx.font = '16px "Segoe UI", sans-serif';
        ctx.fillStyle = themeColor;

        let valText = '';
        if (type === 'voice') valText = `${Math.floor(item.totalVoiceMinutes / 60)}s ${item.totalVoiceMinutes % 60}dk`;
        else valText = `${item.totalMessages.toLocaleString()} Mesaj`;

        ctx.fillText(valText, x + 115, currentY + 38);

        currentY += 65;
    }
}

module.exports = { createLeaderboardImage };
