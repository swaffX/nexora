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
async function createVoiceCard(user, durationMs, channelName, totalVoiceMinutes) {
    const canvas = createCanvas(800, 300);
    const ctx = canvas.getContext('2d');

    // --- RENK PALETİ ---
    const colors = {
        bg: '#0F172A',         // Çok koyu lacivert/siyah
        card: '#1E293B',       // Kart rengi
        accent: '#8B5CF6',     // Mor vurgu (Nexora teması)
        accentGlow: '#A78BFA', // Glow
        text: '#F8FAFC',       // Beyaz
        subtext: '#94A3B8',    // Gri
        green: '#10B981'       // Onay/Online rengi
    };

    // 1. Arkaplan
    ctx.fillStyle = colors.bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Hafif Gradient Arka Plan Efeği
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, '#0F172A');
    grad.addColorStop(1, '#1E1B4B'); // Hafif morumsu alt
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Ana Kart Alanı (Yuvarlak Köşeli)
    const cardX = 40, cardY = 40, cardW = 720, cardH = 220;
    const radius = 24;

    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 15;
    ctx.shadowOffsetY = 8;

    ctx.fillStyle = colors.card;
    ctx.beginPath();
    ctx.roundRect(cardX, cardY, cardW, cardH, radius);
    ctx.fill();
    ctx.restore();

    // 3. Sol Taraf: Büyük Avatar ve Glow
    const avatarSize = 120;
    const avatarX = cardX + 40;
    const avatarY = cardY + (cardH - avatarSize) / 2;

    // Avatar Glow
    ctx.save();
    ctx.shadowColor = colors.accent;
    ctx.shadowBlur = 25;
    ctx.beginPath();
    ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2 + 2, 0, Math.PI * 2);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.restore();

    // Avatar Resmi
    try {
        const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
        const avatar = await loadImage(avatarURL);

        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.drawImage(avatar, avatarX, avatarY, avatarSize, avatarSize);
        ctx.restore();
    } catch (e) {
        // Fallback daire
        ctx.fillStyle = '#333';
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
        ctx.fill();
    }

    // 4. Orta Kısım: İstatistikler
    const contentX = avatarX + avatarSize + 50;
    const contentY = cardY + 60;

    // SÜRE HESAPLAMA
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    const seconds = Math.floor((durationMs % 60000) / 1000);

    let timeString = "";
    if (hours > 0) timeString += `${hours} Saat `;
    if (minutes > 0) timeString += `${minutes} Dk `;
    timeString += `${seconds} Sn`;

    // Üst Başlık (Kanal)
    ctx.font = 'bold 24px Arial'; // Roboto varsa daha iyi
    ctx.fillStyle = colors.accentGlow;
    ctx.fillText(`🔊 ${channelName.length > 20 ? channelName.substring(0, 18) + '...' : channelName}`, contentX, contentY);

    // Ana Süre (Dev)
    ctx.font = 'bold 48px Arial';
    ctx.fillStyle = colors.text;
    ctx.fillText(timeString, contentX, contentY + 55);

    // Alt Bilgi (Toplam İstatistik)
    const totalHours = Math.floor(totalVoiceMinutes / 60);
    const totalMins = Math.floor(totalVoiceMinutes % 60);

    ctx.font = '18px Arial';
    ctx.fillStyle = colors.subtext;
    ctx.fillText(`Toplam Süren: ${totalHours} saat ${totalMins} dakika`, contentX, contentY + 95);

    // 5. Sağ Taraf: Dekoratif İkonlar / Coin
    // Basit bir "XP Kazanıldı" badge'i

    // Kazanılan XP (Tahmini: dakikada 5 XP)
    const xpGained = Math.max(1, Math.floor((durationMs / 60000) * 5));

    const badgeW = 140, badgeH = 50;
    const badgeX = cardX + cardW - badgeW - 30;
    const badgeY = cardY + 30;

    // Badge Arkaplan
    ctx.fillStyle = 'rgba(139, 92, 246, 0.2)'; // Mor transparan
    ctx.beginPath();
    ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 12);
    ctx.fill();

    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1;
    ctx.stroke();

    // Badge Yazı
    ctx.font = 'bold 20px Arial';
    ctx.fillStyle = colors.accentGlow;
    ctx.textAlign = 'center';
    ctx.fillText(`+${xpGained} XP`, badgeX + badgeW / 2, badgeY + 32);

    return new AttachmentBuilder(await canvas.encode('png'), { name: `voice-session.png` });
}

module.exports = { createWelcomeImage, createLevelCard, createVoiceCard };
