const path = require('path');
const { Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));

module.exports = {
    name: 'guildMemberAdd',
    async execute(member, client) {
        const guildSettings = await Guild.findOrCreate(member.guild.id, member.guild.name);

        // 1. Resimli Hoşgeldin Mesajı
        if (guildSettings.welcome.enabled && guildSettings.welcome.channelId) {
            const welcomeChannel = member.guild.channels.cache.get(guildSettings.welcome.channelId);

            if (welcomeChannel) {
                try {
                    // Canvas oluştur (1024x500)
                    const canvas = createCanvas(1024, 500);
                    const ctx = canvas.getContext('2d');

                    // Arkaplan Rengi (Koyu/Modern)
                    ctx.fillStyle = '#101010';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);

                    // Dekoratif Şekiller (Gradient)
                    const gradient = ctx.createLinearGradient(0, 0, 1024, 500);
                    gradient.addColorStop(0, '#00c6ff'); // Mavi
                    gradient.addColorStop(1, '#0072ff'); // Koyu Mavi
                    ctx.fillStyle = gradient;

                    // Alt Bar (Footer gibi)
                    ctx.fillRect(0, 480, 1024, 20);

                    // Yuvarlak dekorlar
                    ctx.beginPath();
                    ctx.arc(512, 180, 140, 0, Math.PI * 2, true);
                    ctx.fill();

                    // Avatar Çemberi (Maskeleme)
                    ctx.save();
                    ctx.beginPath();
                    ctx.arc(512, 180, 130, 0, Math.PI * 2, true);
                    ctx.closePath();
                    ctx.clip();

                    // Avatar
                    try {
                        const avatarURL = member.user.displayAvatarURL({ extension: 'png', size: 512, forceStatic: true });
                        const avatar = await loadImage(avatarURL);
                        ctx.drawImage(avatar, 382, 50, 260, 260); // 130 radius * 2 = 260 width/height
                    } catch (e) {
                        // Avatar yoksa gri renk
                        ctx.fillStyle = '#7289da';
                        ctx.fillRect(382, 50, 260, 260);
                    }
                    ctx.restore();

                    // Avatar Çerçevesi (Beyaz)
                    ctx.strokeStyle = '#ffffff';
                    ctx.lineWidth = 10;
                    ctx.beginPath();
                    ctx.arc(512, 180, 130, 0, Math.PI * 2, true);
                    ctx.stroke();

                    // Yazılar
                    ctx.textAlign = 'center';

                    // "BİR KİŞİ DAHA KATILDI"
                    ctx.font = 'bold 30px Arial';
                    ctx.fillStyle = '#cccccc';
                    ctx.fillText('BİR KİŞİ DAHA KATILDI', 512, 360);

                    // Kullanıcı Adı
                    ctx.font = 'bold 60px Arial';
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(member.user.username.toUpperCase(), 512, 420);

                    // Üye Sayısı
                    ctx.font = '30px Arial';
                    ctx.fillStyle = '#00c6ff';
                    ctx.fillText(`#${member.guild.memberCount}. Üye`, 512, 460);

                    const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'welcome-image.png' });

                    // Mesaj Metni (Ayarlanmışsa)
                    let content = guildSettings.welcome.message
                        .replace('{user}', `<@${member.id}>`)
                        .replace('{username}', member.user.username)
                        .replace('{server}', member.guild.name)
                        .replace('{membercount}', member.guild.memberCount);

                    await welcomeChannel.send({
                        content: content,
                        files: [attachment]
                    });

                } catch (error) {
                    logger.error('Welcome Image Error:', error);
                    // Hata olursa düz mesaj at (Fallback)
                    await welcomeChannel.send(`Hoş geldin <@${member.id}>!`);
                }
            }
        }

        // 2. DM Mesajı
        if (guildSettings.welcome.dmEnabled && guildSettings.welcome.dmMessage) {
            try {
                const dmContent = guildSettings.welcome.dmMessage
                    .replace('{user}', member.user.username)
                    .replace('{server}', member.guild.name)
                    .replace('{membercount}', member.guild.memberCount);

                await member.send(dmContent);
            } catch (e) {
                // DM kapalı olabilir, loglamaya gerek yok
            }
        }

        // 3. Otorol
        if (guildSettings.autoRole.enabled && guildSettings.autoRole.roleId) {
            try {
                const role = member.guild.roles.cache.get(guildSettings.autoRole.roleId);
                if (role && !member.user.bot) {
                    await member.roles.add(role);
                }
            } catch (e) {
                logger.error('Autorole Hatası:', e.message);
            }
        }
    }
};
