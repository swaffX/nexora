const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const path = require('path');

// Font yükle (VPS'te yoksa diye)
// GlobalFonts.registerFromPath(path.join(__dirname, '..', 'assets', 'fonts', 'Roboto-Bold.ttf'), 'Roboto');

async function createWelcomeImage(member) {
    const canvas = createCanvas(1024, 450);
    const ctx = canvas.getContext('2d');

    // Arkaplan
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Modern Gradient (Mor - Mavi)
    const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    gradient.addColorStop(0, '#6a11cb');
    gradient.addColorStop(1, '#2575fc');
    ctx.fillStyle = gradient;
    ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);

    // İç siyah kutu
    ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Yazılar
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('HOŞGELDİN', 650, 200);

    ctx.font = 'bold 45px Arial';
    ctx.fillStyle = '#f1c40f'; // Gold
    ctx.fillText(member.user.username.toUpperCase(), 650, 270);

    ctx.font = '30px Arial';
    ctx.fillStyle = '#cccccc';
    ctx.fillText(`#${member.guild.memberCount}. Üye`, 650, 330);

    // Avatar Çizimi
    const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });

    try {
        const avatar = await loadImage(avatarURL);

        ctx.save();
        ctx.beginPath();
        // Daire (Çerçeve)
        ctx.arc(250, 225, 135, 0, Math.PI * 2, true);
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
        ctx.closePath();

        // Daire (Resim)
        ctx.clip();
        ctx.drawImage(avatar, 115, 90, 270, 270);
        ctx.restore();

    } catch (e) {
        console.error('Welcome avatar error:', e);
    }

    return new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome.png' });
}

async function createLevelCard(user, level, xpLeft) {
    const canvas = createCanvas(800, 250);
    const ctx = canvas.getContext('2d');

    // 1. Arkaplan (Koyu Siyah)
    ctx.fillStyle = '#090909';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Altın/Turuncu Çerçeve
    ctx.strokeStyle = '#FFA500'; // Turuncu
    ctx.lineWidth = 6;
    ctx.strokeRect(10, 10, canvas.width - 20, canvas.height - 20);

    // 3. Yazılar
    ctx.textAlign = 'left';

    // TEBRİKLER
    ctx.font = 'bold 60px Arial';
    ctx.fillStyle = '#ffffff';
    ctx.fillText('TEBRİKLER!', 280, 90);

    // LEVEL X
    ctx.font = 'bold 50px Arial';
    ctx.fillStyle = '#FFD700'; // Gold
    ctx.fillText(`LEVEL ${level}`, 280, 150);

    // XP Bilgisi
    ctx.font = '24px Arial';
    ctx.fillStyle = '#aaaaaa';
    ctx.fillText(`Sonraki Seviye: ${xpLeft} XP kaldı`, 280, 190);

    // 4. Avatar
    try {
        const avatarURL = user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
        const avatar = await loadImage(avatarURL);

        ctx.save();
        ctx.beginPath();
        // Daire
        ctx.arc(140, 125, 90, 0, Math.PI * 2, true);
        ctx.closePath();

        // Kırpma
        ctx.clip();
        ctx.drawImage(avatar, 50, 35, 180, 180);

        // Çerçeve (Avatar Etrafına)
        ctx.beginPath();
        ctx.arc(140, 125, 90, 0, Math.PI * 2, true);
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#FFD700';
        ctx.stroke();

        ctx.restore();
    } catch (e) {
        console.error('Level avatar error:', e);
    }

    return new AttachmentBuilder(await canvas.encode('png'), { name: `levelup-${user.id}.png` });
}

/**
 * Detaylı Ses İstatistik Kartı Oluşturur
 * @param {object} user Discord User Objesi
 * @param {number} durationMs Milisaniye cinsinden süre
 * @param {string} channelName Kanal adı
 * @param {number} totalVoice Genel toplam süre (dakika) veya XP
 */
async function createVoiceCard(user, durationMs, channelName, userStats, rank) {
    // 800x250 yerine daha geniş ve modern panel
    const canvas = createCanvas(900, 280);
    const ctx = canvas.getContext('2d');

    // --- RENK PALETİ (Nexora Dark Theme) ---
    const colors = {
        bg: '#0B0E14',         // En koyu arka plan
        panel: '#151921',      // Panel rengi
        accent: '#5865F2',     // Discord Blurple / Nexora Blue
        text: '#ECECEC',       // Beyaz
        subtext: '#9CA3AF',    // Gri
        border: '#2B2D31'      // İnce kenarlıklar
    };

    // 1. Arkaplan
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Yuvarlak Köşeli Ana Panel
    const cardX = 20, cardY = 20, cardW = 860, cardH = 240;
    const radius = 20;

    // Panel Gölgesi
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;

    ctx.fillStyle = colors.panel;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();

    // Gölgeyi kapat
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // İnce Border
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.stroke();

    // --- SOL: İSTATİSTİK TABLOSU ---
    // Tablo Arkaplanı
    const tableX = cardX + 20;
    const tableY = cardY + 20;
    const tableW = 220;
    const tableH = cardH - 40;

    ctx.fillStyle = '#111318'; // Daha koyu tablo zemini
    ctx.beginPath();
    ctx.roundRect(tableX, tableY, tableW, tableH, 12);
    ctx.fill();

    // Başlık
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Ses Bilgi', tableX + 15, tableY + 30);

    // Mikrofon İkonu (Çizim)
    ctx.font = '20px Arial';
    ctx.fillText('🎙️', tableX + tableW - 35, tableY + 30);

    // Çizgi
    ctx.strokeStyle = '#2B2D31';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(tableX + 10, tableY + 45);
    ctx.lineTo(tableX + tableW - 10, tableY + 45);
    ctx.stroke();

    // Veriler
    const rows = [
        { label: 'Tüm Zamanlar', value: formatDuration(userStats.totalVoiceMinutes * 60000) },
        { label: '30 Gün', value: formatDuration(userStats.monthlyVoice * 60000) }, // DB'de aylık var, 30 gün kabul edelim
        { label: '7 Gün', value: formatDuration(userStats.weeklyVoice * 60000) },  // Haftalık
        { label: '1 Gün', value: formatDuration(userStats.dailyVoice * 60000) }    // Günlük
    ];

    let rowY = tableY + 75;
    ctx.font = '14px Arial';

    for (const row of rows) {
        // Label (Sol)
        ctx.fillStyle = '#9CA3AF';
        ctx.textAlign = 'left';
        ctx.fillText(row.label, tableX + 15, rowY);

        // Value (Sağ)
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'right';
        ctx.fillText(row.value, tableX + tableW - 15, rowY);

        // Arkaplan Barı (Zebra Efekti gibi hafif)
        if (rows.indexOf(row) % 2 === 0) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(tableX + 5, rowY - 14, tableW - 10, 20);
        }

        rowY += 35;
    }

    // --- ORTA: AVATAR & RANK ---
    const centerX = cardX + 330;
    const centerY = cardY + cardH / 2 - 20;

    // Avatar
    const avatarSize = 100;
    try {
        const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
        const avatar = await loadImage(avatarURL);

        ctx.save();
        ctx.beginPath();
        ctx.arc(centerX + 50, centerY - 20, avatarSize / 2, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#202225'; // Avatar etrafı
        ctx.stroke();
        ctx.clip();
        ctx.drawImage(avatar, centerX, centerY - 70, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) { }

    // Rank Kutusu
    const rankBoxY = centerY + 50;
    ctx.fillStyle = '#111318';
    ctx.beginPath();
    ctx.roundRect(centerX - 10, rankBoxY, 120, 60, 10);
    ctx.fill();

    ctx.textAlign = 'left';
    ctx.font = '14px Arial';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText('Sunucu Rankı 📊', centerX, rankBoxY + 20);

    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Rank #${rank}`, centerX + 15, rankBoxY + 50);


    // --- SAĞ: KANAL BİLGİLERİ (Panel) ---
    const rightPanelX = cardX + 480; // Biraz daha sağa
    const rightPanelY = tableY;
    const rightPanelW = 340;
    const rightPanelH = cardH - 40;

    // Kanal Paneli Arkaplan (Koyu)
    ctx.fillStyle = '#111318';
    ctx.beginPath();
    ctx.roundRect(rightPanelX, rightPanelY, rightPanelW, rightPanelH, 12);
    ctx.fill();

    // Başlık
    ctx.textAlign = 'left';
    ctx.font = 'bold 16px Arial';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Kanal Bilgileri', rightPanelX + 15, rightPanelY + 30);

    // Hoparlör İkonu
    ctx.font = '20px Arial';
    ctx.fillText('🔊', rightPanelX + rightPanelW - 35, rightPanelY + 30);

    // Ayırıcı Çizgi
    ctx.strokeStyle = '#2B2D31';
    ctx.beginPath();
    ctx.moveTo(rightPanelX + 10, rightPanelY + 45);
    ctx.lineTo(rightPanelX + rightPanelW - 10, rightPanelY + 45);
    ctx.stroke();

    // Kanal Adı ve Süresi (Grid Gibi)
    const channelRowY = rightPanelY + 75;

    // Kanal Adı
    ctx.font = '15px Arial';
    ctx.fillStyle = '#9CA3AF';
    ctx.fillText(channelName.length > 25 ? channelName.substring(0, 23) + '..' : channelName, rightPanelX + 15, channelRowY);

    // Süre (Oturum Süresi)
    ctx.textAlign = 'right';
    ctx.fillStyle = '#5865F2'; // Mavi vurgu
    ctx.font = 'bold 15px Arial';
    ctx.fillText(formatDuration(durationMs), rightPanelX + rightPanelW - 15, channelRowY);

    // Boş satırlar (Görsellik için, SS'teki gibi)
    for (let i = 1; i < 4; i++) {
        const y = channelRowY + (i * 35);
        ctx.fillStyle = 'rgba(255,255,255,0.02)';
        ctx.fillRect(rightPanelX + 10, y - 15, rightPanelW - 20, 25);
    }

    return new AttachmentBuilder(await canvas.encode('png'), { name: `voice-session.png` });
}

function formatDuration(ms) {
    if (!ms) return "0 sn";
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)));

    if (hours > 0) return `${hours} sa ${minutes} dk`;
    if (minutes > 0) return `${minutes} dk ${seconds} sn`;
    return `${seconds} sn`;
}

module.exports = { createWelcomeImage, createLevelCard, createVoiceCard };
