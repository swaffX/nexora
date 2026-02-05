const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');
} catch (e) { }

// Kavisli Dikdörtgen
function roundRect(ctx, x, y, width, height, radius) {
    if (typeof radius === 'undefined') {
        radius = 5;
    }
    if (typeof radius === 'number') {
        radius = { tl: radius, tr: radius, br: radius, bl: radius };
    } else {
        var defaultRadius = { tl: 0, tr: 0, br: 0, bl: 0 };
        for (var side in defaultRadius) {
            radius[side] = radius[side] || defaultRadius[side];
        }
    }
    ctx.beginPath();
    ctx.moveTo(x + radius.tl, y);
    ctx.lineTo(x + width - radius.tr, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius.tr);
    ctx.lineTo(x + width, y + height - radius.br);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius.br, y + height);
    ctx.lineTo(x + radius.bl, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius.bl);
    ctx.lineTo(x, y + radius.tl);
    ctx.quadraticCurveTo(x, y, x + radius.tl, y);
    ctx.closePath();
}

function applyRoundAvatar(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
}

async function createLeaderboardImage(guildName, guildIconUrl, data, client) {
    const width = 1000;
    const height = 700; // Footer için biraz daha yer
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Modern Arkaplan
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#09090b');
    bgGradient.addColorStop(1, '#020617'); // Slate 950
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Grid Pattern (Çok silik)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke(); }
    for (let i = 0; i < height; i += 40) { ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke(); }

    // Header Glow
    const headerGlow = ctx.createRadialGradient(width / 2, 100, 0, width / 2, 100, 400);
    headerGlow.addColorStop(0, 'rgba(255, 70, 85, 0.15)'); // Kırmızımsı
    headerGlow.addColorStop(1, 'transparent');
    ctx.fillStyle = headerGlow;
    ctx.fillRect(0, 0, width, 250);

    // 2. Logo & Başlık
    if (guildIconUrl) {
        try {
            const logo = await loadImage(guildIconUrl);
            const logoSize = 100;
            const logoX = width / 2 - logoSize / 2;
            const logoY = 30;
            // Logo Shadow/Glow
            ctx.shadowColor = '#ff4655'; ctx.shadowBlur = 30;
            ctx.drawImage(logo, logoX, logoY, logoSize, logoSize);
            ctx.shadowBlur = 0;
        } catch (e) { }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '60px VALORANT, sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4655'; ctx.shadowBlur = 20;
    ctx.fillText(guildName.toUpperCase(), width / 2, 180);
    ctx.shadowBlur = 0;

    // 3. Listeler
    await drawRankList(ctx, 'TOP VOICE', 60, 230, data.voice, client, 'voice', '#3b82f6');
    await drawRankList(ctx, 'TOP CHAT', 540, 230, data.messages, client, 'msg', '#10b981');

    // 4. Footer (Yenilenmiş Layout: 3 Sütun)
    const footerY = 600;
    const footerHeight = 100;

    // Footer BG
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, footerY, width, footerHeight);

    // Top border gradient
    const lineG = ctx.createLinearGradient(0, footerY, width, footerY);
    lineG.addColorStop(0, 'transparent');
    lineG.addColorStop(0.5, '#475569');
    lineG.addColorStop(1, 'transparent');
    ctx.fillStyle = lineG;
    ctx.fillRect(0, footerY, width, 1);

    const colW = width / 3;
    const yCenter = footerY + footerHeight / 2;

    const totalHours = Math.floor(data.stats.totalVoice / 60);
    const totalMins = data.stats.totalVoice % 60;

    // Helper to draw footer stat
    const drawFooterStat = (label, value, color, index) => {
        const cx = (colW * index) + (colW / 2);

        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Label (Üstte, küçük)
        ctx.font = 'bold 16px "Segoe UI", sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(label, cx, yCenter - 15);

        // Value (Altta, büyük, renkli)
        ctx.font = 'bold 36px "DIN Alternate", sans-serif';
        ctx.fillStyle = '#fff';

        // Value Glow
        if (color) {
            ctx.shadowColor = color;
            ctx.shadowBlur = 15;
            ctx.fillStyle = color;
        }

        ctx.fillText(value, cx, yCenter + 20);
        ctx.shadowBlur = 0;
    };

    drawFooterStat('ÜYE', data.stats.trackedUsers, '#fff', 0);
    drawFooterStat('MESAJ', data.stats.totalMessages.toLocaleString(), '#10b981', 1);
    drawFooterStat('TOPLAM SES', `${totalHours}s ${totalMins}dk`, '#3b82f6', 2);

    return canvas.encode('png');
}

const userAvatarCache = new Map();

async function drawRankList(ctx, title, x, y, list, client, type, themeColor) {
    const w = 400; // List Width

    // Başlık
    ctx.font = '30px VALORANT, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.shadowColor = themeColor; ctx.shadowBlur = 15;
    ctx.fillText(title, x, y);
    ctx.shadowBlur = 0;

    // Renkli Çizgi (Başlık Altı)
    ctx.fillStyle = themeColor;
    ctx.fillRect(x, y + 10, 50, 4);

    let currentY = y + 40;
    const top5 = list.slice(0, 5);

    for (let i = 0; i < 5; i++) {
        const item = top5[i];
        if (!item) { currentY += 65; continue; } // Boş slot

        // Kart Arkaplanı
        ctx.save();
        roundRect(ctx, x, currentY, w, 55, 8);
        ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
        // 1. sıradaki için özel glowlu bg
        if (i === 0) {
            const g = ctx.createLinearGradient(x, currentY, x + w, currentY);
            g.addColorStop(0, `rgba(${parseInt(themeColor.slice(1, 3), 16)}, ${parseInt(themeColor.slice(3, 5), 16)}, ${parseInt(themeColor.slice(5, 7), 16)}, 0.15)`);
            g.addColorStop(1, 'transparent');
            ctx.fillStyle = g;
        }
        ctx.fill();
        // İnce border
        ctx.strokeStyle = 'rgba(255,255,255,0.05)';
        ctx.stroke();
        ctx.restore();

        // Sıra No (Rank) - Sol tarafta dikey ortalı
        ctx.font = 'bold 24px "DIN Alternate", sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const rankX = x + 30;
        const rankY = currentY + 27.5; // Kutu ortası

        if (i === 0) { ctx.fillStyle = '#fbbf24'; ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 10; }
        else if (i === 1) { ctx.fillStyle = '#e2e8f0'; ctx.shadowColor = '#e2e8f0'; ctx.shadowBlur = 5; }
        else if (i === 2) { ctx.fillStyle = '#b45309'; ctx.shadowColor = '#b45309'; ctx.shadowBlur = 5; }
        else ctx.fillStyle = '#64748b';

        ctx.fillText(`#${i + 1}`, rankX, rankY);
        ctx.shadowBlur = 0;

        // Avatar
        const avatarSize = 40;
        const avatarX = x + 60;
        const avatarY = currentY + 7.5; // (55 - 40) / 2 = 7.5 margin

        let avatarImage;
        const cacheKey = item.userId;
        if (userAvatarCache.has(cacheKey) && Date.now() - userAvatarCache.get(cacheKey).timestamp < 600000) {
            avatarImage = userAvatarCache.get(cacheKey).image;
        } else {
            try {
                let u = client.users.cache.get(item.userId);
                if (!u) u = await client.users.fetch(item.userId);
                if (u) {
                    const url = u.displayAvatarURL({ extension: 'png', size: 64, forceStatic: true });
                    avatarImage = await loadImage(url);
                    userAvatarCache.set(cacheKey, { image: avatarImage, timestamp: Date.now() });
                }
            } catch (e) { }
        }

        if (avatarImage) {
            ctx.save();
            applyRoundAvatar(ctx, avatarX, avatarY, avatarSize);
            ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
            ctx.restore();
            // Küçük bir border (1. sıra için)
            if (i === 0) {
                ctx.beginPath(); ctx.arc(avatarX + 20, avatarY + 20, 20, 0, Math.PI * 2);
                ctx.strokeStyle = themeColor; ctx.lineWidth = 2; ctx.stroke();
            }
        }

        // İsim ve Değer
        ctx.textAlign = 'left';
        ctx.textBaseline = 'alphabetic'; // Reset

        // Username
        let uname = 'Unknown';
        try { const u = client.users.cache.get(item.userId); if (u) uname = u.username; } catch (e) { }

        ctx.font = 'bold 18px "Segoe UI", sans-serif';
        ctx.fillStyle = '#fff';
        if (i === 0) { ctx.shadowColor = themeColor; ctx.shadowBlur = 10; }
        ctx.fillText(uname.substring(0, 14), x + 115, currentY + 25);
        ctx.shadowBlur = 0;

        // Stat Değeri
        ctx.font = '14px "Segoe UI", sans-serif';
        ctx.fillStyle = themeColor;
        let val = '';
        if (type === 'voice') val = `${Math.floor(item.totalVoiceMinutes / 60)}s ${item.totalVoiceMinutes % 60}dk`;
        else val = `${item.totalMessages.toLocaleString()} Mesaj`;

        ctx.fillText(val, x + 115, currentY + 45);

        currentY += 65; // Bir sonraki satır
    }
}

module.exports = { createLeaderboardImage };
