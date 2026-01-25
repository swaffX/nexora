const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Font Register
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');
} catch (e) { console.error('Font yükleme hatası:', e); }

// Yuvarlak Avatar Kırpma
function applyRoundAvatar(ctx, x, y, size) {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2, true);
    ctx.closePath();
    ctx.clip();
}

async function createLeaderboardImage(guildName, guildIconUrl, data, client) {
    const width = 1000;
    const height = 650; // Biraz daha uzun
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Arkaplan (Modern Koyu Degrade)
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#0f172a'); // Çok koyu mavi (Slate 900)
    bgGradient.addColorStop(1, '#1e1b4b'); // Koyu indigo
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Grid Çizgileri (Tekno havası)
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.lineWidth = 1;
    for (let i = 0; i < width; i += 40) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, height); ctx.stroke();
    }
    for (let i = 0; i < height; i += 40) {
        ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(width, i); ctx.stroke();
    }

    // 2. Header (Başlık)
    // Logo (Varsa)
    if (guildIconUrl) {
        try {
            const logo = await loadImage(guildIconUrl);
            ctx.save();
            applyRoundAvatar(ctx, width / 2 - 40, 20, 80);
            ctx.drawImage(logo, width / 2 - 40, 20, 80, 80);
            ctx.restore();
        } catch (e) { }
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = '60px VALORANT';
    ctx.textAlign = 'center';
    ctx.shadowColor = '#ff4655';
    ctx.shadowBlur = 15;
    ctx.fillText(guildName.toUpperCase(), width / 2, 160);
    ctx.shadowBlur = 0;

    // KATEGORİLER (XP - VOICE - CHAT)
    // Emojileri kaldırdım, sadece metin
    await drawRankList(ctx, 'TOP LEVEL', 50, 200, data.xp, client, 'xp', '#fbbf24'); // Amber
    await drawRankList(ctx, 'TOP VOICE', 370, 200, data.voice, client, 'voice', '#3b82f6'); // Blue
    await drawRankList(ctx, 'TOP CHAT', 690, 200, data.messages, client, 'msg', '#10b981'); // Emerald

    // Footer (Global Stats)
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(0, 570, width, 80);

    // Alt Çizgi
    ctx.fillStyle = '#ff4655';
    ctx.fillRect(0, 565, width, 5);

    ctx.font = 'bold 24px sans-serif';
    ctx.fillStyle = '#e2e8f0';
    ctx.textAlign = 'center';

    // Toplam Ses Saat/Dakika formatı
    const totalHours = Math.floor(data.stats.totalVoice / 60);
    const totalMins = data.stats.totalVoice % 60;

    // Emojiler yerine text separator veya simple chars
    const statsText = `Üye: ${data.stats.trackedUsers}   •   Mesaj: ${data.stats.totalMessages.toLocaleString()}   •   Toplam Ses: ${totalHours}s ${totalMins}dk`;
    ctx.fillText(statsText, width / 2, 620);

    // "Son Güncelleme" kısmını buradan kaldırdık (Embed'e eklenecek)

    return canvas.encode('png');
}

const userAvatarCache = new Map();

async function drawRankList(ctx, title, x, y, list, client, type, color) {
    // Başlık Kutusu
    ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
    ctx.fillRect(x, y, 260, 50);

    // Sol Kenar Çizgisi
    ctx.fillStyle = color;
    ctx.fillRect(x, y, 5, 50);

    ctx.font = '28px VALORANT';
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'left';
    ctx.fillText(title, x + 20, y + 35);

    // Liste Elemanları (Top 5)
    let currentY = y + 70;
    const top5 = list.slice(0, 5);

    for (let i = 0; i < 5; i++) { // Her zaman 5 satır çiz
        const item = top5[i];

        // Arka Plan Şeridi
        if (i % 2 === 0) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
            ctx.fillRect(x, currentY - 10, 260, 60);
        }

        if (!item) {
            ctx.font = '16px sans-serif';
            ctx.fillStyle = '#475569';
            ctx.fillText('-', x + 20, currentY + 25);
            currentY += 60;
            continue;
        }

        // Sıra No
        ctx.font = 'bold 24px sans-serif';
        if (i === 0) ctx.fillStyle = '#fbbf24';
        else if (i === 1) ctx.fillStyle = '#94a3b8';
        else if (i === 2) ctx.fillStyle = '#b45309';
        else ctx.fillStyle = '#64748b';

        ctx.fillText(`${i + 1}`, x + 10, currentY + 25);

        // --- AVATAR CACHE SYSTEM ---
        let avatarImage;
        const cacheKey = item.userId;

        if (userAvatarCache.has(cacheKey)) {
            const cached = userAvatarCache.get(cacheKey);
            // 10 dakika cache (Resim URL değişmediyse)
            if (Date.now() - cached.timestamp < 10 * 60 * 1000) {
                avatarImage = cached.image;
            }
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
            const avatarSize = 40;
            ctx.save();
            applyRoundAvatar(ctx, x + 40, currentY - 5, avatarSize);
            ctx.drawImage(avatarImage, x + 40, currentY - 5, avatarSize, avatarSize);
            ctx.restore();
        }

        // --- İSİM ---
        let username = 'Bilinmiyor';
        try {
            const user = client.users.cache.get(item.userId);
            if (user) username = user.username;
        } catch (e) { }

        ctx.font = 'bold 16px sans-serif';
        ctx.fillStyle = '#ffffff';
        ctx.fillText(username.substring(0, 10), x + 90, currentY + 10);

        // Değer
        ctx.font = '14px sans-serif';
        ctx.fillStyle = color;
        let valText = '';
        if (type === 'xp') valText = `LVL ${item.level} • ${item.xp.toLocaleString()} XP`;
        else if (type === 'voice') valText = `${Math.floor(item.totalVoiceMinutes / 60)}s ${item.totalVoiceMinutes % 60}dk`;
        else valText = `${item.totalMessages.toLocaleString()} Mesaj`;

        ctx.fillText(valText, x + 90, currentY + 30);

        currentY += 60;
    }
}

module.exports = { createLeaderboardImage };
