const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const User = require('../../../../shared/models/User');
const ValorantUser = require('../../../../shared/models/ValorantUser');
const { JOBS } = require('../../utils/jobs');
const path = require('path');

// Font Kaydı
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');
} catch (e) { }

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('Kullanıcı profilini görüntüler veya düzenler.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('view')
                .setDescription('Bir kullanıcının profilini görüntüler.')
                .addUserOption(option => option.setName('user').setDescription('Profilini görmek istediğin kullanıcı')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-bio')
                .setDescription('Profil biyografini düzenle.')
                .addStringOption(option => option.setName('text').setDescription('Yeni biyografin').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set-bg')
                .setDescription('Profil arkaplan resmini değiştir (URL).')
                .addStringOption(option => option.setName('url').setDescription('Resim bağlantısı').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        // --- BİYOGRAFİ AYARLAMA ---
        if (subcommand === 'set-bio') {
            const text = interaction.options.getString('text');
            if (text.length > 150) return interaction.reply({ content: '❌ Biyografi en fazla 150 karakter olabilir.', ephemeral: true });

            await User.findOneAndUpdate(
                { odasi: interaction.user.id, odaId: guildId },
                { $set: { bio: text } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return interaction.reply({ content: '✅ Biyografi güncellendi!', ephemeral: true });
        }

        // --- ARKAPLAN AYARLAMA ---
        if (subcommand === 'set-bg') {
            const url = interaction.options.getString('url');
            if (!url.startsWith('http')) return interaction.reply({ content: '❌ Lütfen geçerli bir resim bağlantısı girin.', ephemeral: true });

            await User.findOneAndUpdate(
                { odasi: interaction.user.id, odaId: guildId },
                { $set: { backgroundImage: url } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return interaction.reply({ content: '✅ Arkaplan resmi güncellendi!', ephemeral: true });
        }

        // --- PROFİL GÖRÜNTÜLEME ---
        if (subcommand === 'view') {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('user') || interaction.user;

            // Verileri Çek
            const userData = await User.findOne({ odasi: targetUser.id, odaId: guildId });
            const valorantData = await ValorantUser.findOne({ userId: targetUser.id });

            // Verileri Hazırla
            const balance = userData?.balance || 0;
            const xp = userData?.xp || 0;
            const level = userData?.level || 0;
            const bio = userData?.bio || 'Biyografi yok.';
            const rep = userData?.reputation || 0;
            const bgUrl = userData?.backgroundImage;

            // Career
            const jobKey = userData?.career?.job;
            const job = jobKey ? JOBS[jobKey] : null;
            const jobName = job ? job.name : 'İşsiz';
            const jobEmoji = job ? job.emoji : '🛑';
            const careerLvl = userData?.career?.level || 0;

            // Valorant
            const valRank = valorantData?.lastRank || 'Unlinked';
            const valName = valorantData ? `${valorantData.riotName}#${valorantData.riotTag}` : '---';

            // --- CANVAS ÇİZİMİ ---
            const canvas = createCanvas(800, 500); // Biraz daha yüksek
            const ctx = canvas.getContext('2d');

            // 1. Arkaplan
            ctx.fillStyle = '#111';
            ctx.fillRect(0, 0, 800, 500);

            if (bgUrl) {
                try {
                    const bg = await loadImage(bgUrl);
                    // Center Crop
                    const scale = Math.max(800 / bg.width, 500 / bg.height);
                    const x = (800 - bg.width * scale) / 2;
                    const y = (500 - bg.height * scale) / 2;
                    ctx.drawImage(bg, x, y, bg.width * scale, bg.height * scale);

                    // Karartma (Overlay)
                    ctx.fillStyle = 'rgba(0,0,0,0.65)';
                    ctx.fillRect(0, 0, 800, 500);
                } catch (e) { console.error(e); }
            }

            // 2. Ana Kart (Glassmorphism)
            ctx.save();
            ctx.translate(40, 40); // Padding

            // Kart Arkaplan
            ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.roundRect(0, 0, 720, 420, 20);
            ctx.fill();
            ctx.stroke();

            // 3. Avatar
            const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
            try {
                const avatar = await loadImage(avatarURL);
                ctx.save();
                ctx.beginPath();
                ctx.arc(80, 80, 60, 0, Math.PI * 2);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, 20, 20, 120, 120);
                ctx.restore();

                // Avatar Border
                ctx.strokeStyle = '#FD4556'; // Valorant Redish
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(80, 80, 60, 0, Math.PI * 2);
                ctx.stroke();
            } catch (e) { }

            // 4. İsim ve Bio
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 40px "VALORANT", sans-serif';
            ctx.fillText(targetUser.username.toUpperCase(), 160, 60);

            ctx.font = 'italic 18px sans-serif';
            ctx.fillStyle = '#DDD';
            ctx.fillText(bio.length > 60 ? bio.substring(0, 57) + '...' : bio, 160, 90);

            // 5. Stat Blokları
            const drawStatBox = (x, y, w, h, title, value, sub, color = '#FFF') => {
                ctx.fillStyle = 'rgba(0,0,0,0.4)';
                ctx.beginPath();
                ctx.roundRect(x, y, w, h, 10);
                ctx.fill();

                ctx.textAlign = 'left';
                ctx.fillStyle = '#AAA';
                ctx.font = '14px sans-serif';
                ctx.fillText(title, x + 10, y + 25);

                ctx.fillStyle = color;
                ctx.font = 'bold 24px "VALORANT", sans-serif';
                ctx.fillText(value, x + 10, y + 55);

                if (sub) {
                    ctx.fillStyle = '#DDD';
                    ctx.font = '14px sans-serif';
                    ctx.fillText(sub, x + 10, y + 75);
                }
            };

            // Grid Düzeni
            // Sol Taraf (Level & Career)
            drawStatBox(20, 160, 330, 90, 'LEVEL & XP', `LVL ${level}`, `${xp} XP`, '#F1C40F');
            drawStatBox(20, 260, 330, 90, 'CAREER', `${jobEmoji} ${jobName.toUpperCase()}`, `Career Lvl: ${careerLvl}`, '#3498DB');

            // Sağ Taraf (Valorant & Eco)
            drawStatBox(370, 160, 330, 90, 'VALORANT RANK', valRank.toUpperCase(), valName, '#FD4556');
            drawStatBox(370, 260, 330, 90, 'BALANCE', `${balance.toLocaleString()} 💰`, 'NexCoin', '#2ECC71');

            // Alt Bar (Reputation & Invites)
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.beginPath();
            ctx.roundRect(20, 370, 680, 30, 5);
            ctx.fill();

            ctx.textAlign = 'center';
            ctx.fillStyle = '#FFF';
            ctx.font = 'bold 16px sans-serif';
            const invites = userData ? (userData.invites.regular + userData.invites.bonus) : 0;
            ctx.fillText(`❤️ Reputation: ${rep}   •   📩 Invites: ${invites}   •   📅 Joined: ${targetUser.createdAt.toLocaleDateString('tr-TR')}`, 360, 391);

            ctx.restore(); // Main transform restore

            // Footer Text
            ctx.textAlign = 'right';
            ctx.fillStyle = 'rgba(255,255,255,0.3)';
            ctx.font = '12px sans-serif';
            ctx.fillText('NEXORA PROFILE SYSTEM', 780, 490);

            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'profile-card.png' });
            await interaction.editReply({ files: [attachment] });
        }
    }
};
