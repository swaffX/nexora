const path = require('path');
const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription('Seviye kartını görüntüler')
        .addUserOption(opt =>
            opt.setName('kullanıcı')
                .setDescription('Kullanıcı (belirtilmezse kendiniz)')),

    async execute(interaction) {
        await interaction.deferReply();

        const user = interaction.options.getUser('kullanıcı') || interaction.user;
        const userData = await User.findOrCreate(user.id, interaction.guild.id, user.username);

        // XP Hesaplamaları
        // Level formülü: Level = 0.1 * sqrt(XP) => XP = (Level/0.1)^2 = 100 * Level^2
        const nextLevelXP = 100 * Math.pow(userData.level + 1, 2);
        const currentLevelXP = 100 * Math.pow(userData.level, 2);
        const progress = userData.xp - currentLevelXP;
        const needed = nextLevelXP - currentLevelXP;
        // Percentage 0-1 aralığında
        const percentage = Math.min(Math.max(progress / needed, 0), 1);

        // Sıralama
        const rankPosition = await User.countDocuments({
            odaId: interaction.guild.id,
            xp: { $gt: userData.xp }
        }) + 1;

        // Canvas Oluşturma
        const canvas = createCanvas(934, 282);
        const ctx = canvas.getContext('2d');

        // Arkaplan Rengi (Koyu Tema)
        ctx.fillStyle = '#1a1c24';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Hafif Gradient Arkaplan
        const gradient = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
        gradient.addColorStop(0, '#2b2d31');
        gradient.addColorStop(1, '#1a1c24');
        ctx.fillStyle = gradient;
        // Kenarlardan 10px boşluk bırakarak iç kutu çizimi
        ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);

        // Avatar Konumu ve Boyutu
        const avatarSize = 180;
        const avatarX = 50;
        const avatarY = 50;

        // Avatar Yuvarlama İşlemi
        ctx.save();
        ctx.beginPath();
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.closePath();
        ctx.clip();

        // Avatarı Yükle
        try {
            const avatarURL = user.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
            const avatarImage = await loadImage(avatarURL);
            ctx.drawImage(avatarImage, avatarX, avatarY, avatarSize, avatarSize);
        } catch (e) {
            // Avatar yüklenemezse fallback renk
            ctx.fillStyle = '#7289da';
            ctx.fillRect(avatarX, avatarY, avatarSize, avatarSize);
        }
        ctx.restore();

        // Avatar Çerçevesi
        ctx.beginPath();
        ctx.lineWidth = 5;
        ctx.strokeStyle = '#23272a';
        ctx.arc(avatarX + avatarSize / 2, avatarY + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2, true);
        ctx.stroke();

        // Progress Bar
        const barX = 260;
        const barY = 180;
        const barWidth = 620;
        const barHeight = 40;
        const radius = 20; // Yuvarlaklık yarıçapı

        // Bar Arkaplanı (Boş Kısım)
        ctx.fillStyle = '#484b4e';
        ctx.beginPath();
        // roundRect: x, y, w, h, radii
        if (ctx.roundRect) {
            ctx.roundRect(barX, barY, barWidth, barHeight, radius);
        } else {
            ctx.rect(barX, barY, barWidth, barHeight);
        }
        ctx.fill();

        // Bar Doluluğu (Dolu Kısım)
        const fillWidth = Math.max(barWidth * percentage, radius * 2);
        // Canlı Yeşil
        ctx.fillStyle = '#00f260';
        // Glow Efekti
        ctx.shadowColor = '#00f260';
        ctx.shadowBlur = 15;

        ctx.beginPath();
        if (ctx.roundRect) {
            ctx.roundRect(barX, barY, fillWidth, barHeight, radius);
        } else {
            ctx.rect(barX, barY, fillWidth, barHeight);
        }
        ctx.fill();

        ctx.shadowBlur = 0; // Glow efektini sonraki çizimler için sıfırla

        // Metinler
        ctx.fillStyle = '#ffffff';
        // Arial varsayılan olarak desteklenir
        ctx.font = 'bold 42px Arial';
        ctx.fillText(user.username.slice(0, 15), barX, 120);

        // İstatistikler (Level, Rank)
        ctx.textAlign = 'right';

        // Level
        ctx.fillStyle = '#00f260';
        ctx.font = 'bold 50px Arial';
        const levelY = 80;
        ctx.fillText(`Level ${userData.level}`, canvas.width - 50, levelY);

        // Rank
        ctx.fillStyle = '#ffffff';
        ctx.font = '30px Arial';
        ctx.fillText(`Rank #${rankPosition}`, canvas.width - 50, levelY + 40);

        // XP Bilgisi (Barın İçine)
        const xpText = `${Math.floor(progress).toLocaleString()} / ${Math.floor(needed).toLocaleString()} XP`;
        ctx.font = 'bold 24px Arial';
        ctx.fillStyle = '#000000'; // Yeşil barın üzerinde siyah yazı okunaklı olur
        if (percentage < 0.3) ctx.fillStyle = '#ffffff'; // Eğer bar çok boşsa yazı beyaz olsun

        ctx.textAlign = 'center';
        // Barın ortasına yaz
        ctx.fillText(xpText, barX + barWidth / 2, barY + 28);

        // Resmi Discord'a gönder
        const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'rank-card.png' });

        await interaction.editReply({ files: [attachment] });
    }
};
