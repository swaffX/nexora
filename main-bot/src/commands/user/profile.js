const { SlashCommandBuilder, AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
const User = require('../../../../shared/models/User');
const path = require('path');

// Font Kaydı 
// (Match handler'da da yapıldı ama global kayıt olduğu için burada check edebiliriz veya tekrar deneyebiliriz, try-catch ile güvenli olur)
try {
    GlobalFonts.registerFromPath(path.join(__dirname, '..', '..', '..', 'assets', 'fonts', 'Valorant.ttf'), 'VALORANT');
} catch (e) {
    // Zaten kayıtlı olabilir
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('profil')
        .setDescription('Kullanıcı profilini görüntüler veya düzenler.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('görüntüle')
                .setDescription('Bir kullanıcının profilini görüntüler.')
                .addUserOption(option => option.setName('kullanıcı').setDescription('Profilini görmek istediğin kullanıcı')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('biyografi')
                .setDescription('Profil biyografini düzenle.')
                .addStringOption(option => option.setName('text').setDescription('Yeni biyografin').setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('arkaplan')
                .setDescription('Profil arkaplan resmini değiştir (URL).')
                .addStringOption(option => option.setName('url').setDescription('Resim bağlantısı').setRequired(true))),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const guildId = interaction.guild.id;

        if (subcommand === 'biyografi') {
            const text = interaction.options.getString('text');
            if (text.length > 150) return interaction.reply({ content: 'Biyografi en fazla 150 karakter olabilir.', ephemeral: true });

            await User.findOneAndUpdate(
                { odasi: interaction.user.id, odaId: guildId },
                { $set: { bio: text } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return interaction.reply({ content: '✅ Biyografi güncellendi!', ephemeral: true });
        }

        if (subcommand === 'arkaplan') {
            const url = interaction.options.getString('url');
            // Basit URL kontrolü
            if (!url.startsWith('http')) return interaction.reply({ content: 'Lütfen geçerli bir resim bağlantısı girin.', ephemeral: true });

            await User.findOneAndUpdate(
                { odasi: interaction.user.id, odaId: guildId },
                { $set: { backgroundImage: url } },
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            return interaction.reply({ content: '✅ Arkaplan resmi güncellendi!', ephemeral: true });
        }

        if (subcommand === 'görüntüle') {
            await interaction.deferReply();

            const targetUser = interaction.options.getUser('kullanıcı') || interaction.user;
            const userData = await User.findOne({ odasi: targetUser.id, odaId: guildId });

            // Veri Yoksa Varsayılanlar
            const balance = userData?.balance || 0;
            const xp = userData?.xp || 0;
            const level = userData?.level || 0;
            const bio = userData?.bio || 'Biyografi ayarlanmamış.';
            const rep = userData?.reputation || 0;
            const invites = userData ? (userData.invites.regular + userData.invites.bonus - userData.invites.fake - userData.invites.left) : 0;
            const bgUrl = userData?.backgroundImage;

            // CANVAS OLUŞTURMA
            const canvas = createCanvas(800, 450);
            const ctx = canvas.getContext('2d');

            // 1. Arkaplan
            ctx.fillStyle = '#1a1a1a';
            ctx.fillRect(0, 0, 800, 450);

            if (bgUrl) {
                try {
                    const bg = await loadImage(bgUrl);
                    ctx.drawImage(bg, 0, 0, 800, 450);
                    // Hafif Karartma
                    ctx.fillStyle = 'rgba(0,0,0,0.5)';
                    ctx.fillRect(0, 0, 800, 450);
                } catch (e) {
                    console.error('BG Load Error:', e);
                }
            }

            // 2. Glassmorphism Card
            ctx.save();
            ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
            ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
            ctx.shadowBlur = 20;
            ctx.roundRect(50, 50, 700, 350, 20); // main container
            ctx.fill();
            ctx.restore();

            // Border Overlay
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.lineWidth = 2;
            ctx.stroke();

            // 3. Avatar
            const avatarURL = targetUser.displayAvatarURL({ extension: 'png', size: 256 });
            try {
                const avatar = await loadImage(avatarURL);
                ctx.save();
                ctx.beginPath();
                ctx.arc(150, 150, 80, 0, Math.PI * 2, true);
                ctx.closePath();
                ctx.clip();
                ctx.drawImage(avatar, 70, 70, 160, 160);
                ctx.restore();

                // Avatar Border
                ctx.beginPath();
                ctx.arc(150, 150, 80, 0, Math.PI * 2, true);
                ctx.strokeStyle = '#5865F2';
                ctx.lineWidth = 5;
                ctx.stroke();
            } catch (e) { }

            // 4. Text Info
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'left';

            // Username
            ctx.font = 'bold 40px "VALORANT", sans-serif'; // Fallback sans-serif
            ctx.fillText(targetUser.username.toUpperCase(), 260, 110);

            // Level Badge
            ctx.fillStyle = '#5865F2';
            ctx.font = 'bold 24px sans-serif';
            ctx.fillText(`LEVEL ${level}`, 260, 150);

            // XP Bar Background
            ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
            ctx.beginPath();
            ctx.roundRect(260, 170, 400, 20, 10);
            ctx.fill();

            // XP Bar Fill
            // Max XP formülü: genelde 500 * level^2 vs. Basit hesap yapalım veya 1000 sabitleyelim.
            // Botun xpHandler'ında maxXP logic'i vardır. Şimdilik görsel amaçlı %'lik gösterelim.
            // Varsayım: Level başı 5000 xp gerekli olsun
            const nextLevelXp = (level + 1) * 500;
            const progress = Math.min(xp / nextLevelXp, 1);

            ctx.fillStyle = '#5865F2';
            ctx.beginPath();
            ctx.roundRect(260, 170, 400 * progress, 20, 10);
            ctx.fill();

            ctx.fillStyle = '#cccccc';
            ctx.font = '14px sans-serif';
            ctx.fillText(`${xp} / ${nextLevelXp} XP`, 600, 165);

            // İstatistikler Grid
            // Start Y: 240
            ctx.font = '20px "VALORANT", sans-serif';
            ctx.fillStyle = '#ffffff';

            // Coins
            ctx.fillText('COINS', 100, 280);
            ctx.font = '30px sans-serif';
            ctx.fillStyle = '#FFD700'; // Gold
            ctx.fillText(`${balance}`, 100, 320);

            // Invites
            ctx.font = '20px "VALORANT", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('INVITES', 300, 280);
            ctx.font = '30px sans-serif';
            ctx.fillStyle = '#5865F2';
            ctx.fillText(`${invites}`, 300, 320);

            // Rep
            ctx.font = '20px "VALORANT", sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.fillText('REP', 500, 280);
            ctx.font = '30px sans-serif';
            ctx.fillStyle = '#ED4245';
            ctx.fillText(`${rep}`, 500, 320);

            // Bio Box
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.roundRect(50, 360, 700, 40, 10);
            ctx.fill();

            ctx.font = 'italic 16px sans-serif';
            ctx.fillStyle = '#dddddd';
            ctx.textAlign = 'center';
            ctx.fillText(bio.length > 80 ? bio.substring(0, 77) + '...' : bio, 400, 385);

            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'profile.png' });
            await interaction.editReply({ files: [attachment] });
        }
    }
};
