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

module.exports = { createWelcomeImage };
