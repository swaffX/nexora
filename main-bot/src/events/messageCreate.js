const path = require('path');
const { Guild, User } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));
const logger = require(path.join(__dirname, '..', '..', '..', 'shared', 'logger'));
const utils = require(path.join(__dirname, '..', '..', '..', 'shared', 'utils'));
const aiHandler = require('../handlers/aiHandler');
const { AttachmentBuilder } = require('discord.js');
const { createCanvas, loadImage } = require('@napi-rs/canvas');

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (message.author.bot) return;
        if (!message.guild) return;

        // Guild ayarlarını al
        const guildSettings = await Guild.findOrCreate(message.guild.id, message.guild.name);

        // 🧠 Nexora Brain (AI)
        await aiHandler.handleMessage(message);

        // Level sistemi
        if (guildSettings.levelSystem?.enabled) {
            const levelSettings = guildSettings.levelSystem;

            // Cooldown kontrolü (default 60s)
            const cooldownKey = `${message.guild.id}-${message.author.id}`;
            const cooldownRemaining = utils.checkCooldown(client.xpCooldowns, cooldownKey, 60);

            if (cooldownRemaining === 0) {
                try {
                    const userData = await User.findOrCreate(message.author.id, message.guild.id, message.author.username);

                    // XP ekle (15-25 arası random * çarpan)
                    const xpGain = utils.randomXP(15, 25) * (levelSettings.multiplier || 1);
                    const newLevel = await userData.addXP(xpGain);

                    const nowMs = Date.now();
                    const lastMessageMs = userData.lastDailyReset ? userData.lastDailyReset.getTime() : 0;
                    if (nowMs - lastMessageMs > 86400000) { // 24 saati geçmişse daily sıfırla
                        userData.dailyMessages = 0;
                        userData.dailyVoice = 0;
                        userData.lastDailyReset = new Date();
                    }

                    // Mesaj sayısını artır
                    userData.totalMessages += 1;
                    userData.dailyMessages += 1;
                    userData.weeklyMessages += 1;
                    userData.monthlyMessages += 1;
                    await userData.save();

                    // Level atladı ve yeni bir seviyeye ulaştı (null değilse)
                    if (newLevel) {
                        // Log kanalına veya mevcut kanala bildir
                        const notifyChannelId = levelSettings.logChannelId;
                        let notifyChannel = notifyChannelId ? message.guild.channels.cache.get(notifyChannelId) : message.channel;

                        // Kanal yoksa mevcut kanala at
                        if (!notifyChannel) notifyChannel = message.channel;

                        // --- CANVAS LEVEL UP ---
                        try {
                            const canvas = createCanvas(800, 200);
                            const ctx = canvas.getContext('2d');

                            // Arkaplan
                            ctx.fillStyle = '#121212'; // Çok koyu gri
                            ctx.fillRect(0, 0, canvas.width, canvas.height);

                            // Şerit Arkaplan
                            const gradient = ctx.createLinearGradient(0, 0, 800, 0);
                            gradient.addColorStop(0, '#f1c40f'); // Sarı/Gold
                            gradient.addColorStop(1, '#e67e22'); // Turuncu
                            ctx.fillStyle = gradient;
                            ctx.fillRect(10, 10, canvas.width - 20, canvas.height - 20);

                            // İç Kutu
                            ctx.fillStyle = '#1e1e1e';
                            ctx.fillRect(15, 15, canvas.width - 30, canvas.height - 30);

                            // Avatar Yükle
                            const avatarURL = message.author.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
                            try {
                                const avatar = await loadImage(avatarURL);
                                // Yuvarlak Avatar
                                ctx.save();
                                ctx.beginPath();
                                ctx.arc(100, 100, 70, 0, Math.PI * 2, true);
                                ctx.closePath();
                                ctx.clip();
                                ctx.drawImage(avatar, 30, 30, 140, 140);
                                ctx.restore();

                                // Avatar Sınırı
                                ctx.strokeStyle = '#f1c40f';
                                ctx.lineWidth = 5;
                                ctx.beginPath();
                                ctx.arc(100, 100, 70, 0, Math.PI * 2, true);
                                ctx.stroke();
                            } catch (e) {
                                // Avatar yüklenemezse kare çiz
                                ctx.fillStyle = '#7289da';
                                ctx.fillRect(30, 30, 140, 140);
                            }

                            // Metinler
                            ctx.font = 'bold 50px Arial';
                            ctx.fillStyle = '#ffffff';
                            ctx.textAlign = 'left';
                            ctx.fillText('TEBRİKLER!', 200, 80);

                            ctx.font = '40px Arial';
                            ctx.fillStyle = '#f1c40f';
                            ctx.fillText(`LEVEL ${newLevel}`, 200, 130);

                            // XP Bilgisi
                            const nextLevelXP = 100 * Math.pow(newLevel + 1, 2); // 100 * level^2 formülü
                            const xpLeft = nextLevelXP - userData.xp;

                            ctx.font = '20px Arial';
                            ctx.fillStyle = '#aaaaaa';
                            ctx.fillText(`Sonraki Seviye: ${Math.floor(xpLeft)} XP kaldı`, 200, 160);

                            const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'levelup.png' });

                            notifyChannel.send({
                                content: `🎉 **Tebrikler** <@${message.author.id}>! Seviye atladın!`,
                                files: [attachment]
                            });

                        } catch (err) {
                            // Canvas hatası olursa eski usül embed at
                            logger.error('Level Up Canvas Hatası:', err);
                            notifyChannel.send({
                                embeds: [embeds.levelUp(message.author, newLevel)]
                            }).catch(() => { });
                        }
                        // --- END CANVAS ---

                        // Rol ödülleri
                        if (levelSettings.roleRewards && levelSettings.roleRewards.length > 0) {
                            for (const reward of levelSettings.roleRewards) {
                                if (newLevel >= reward.level) {
                                    const role = message.guild.roles.cache.get(reward.roleId);
                                    if (role && !message.member.roles.cache.has(role.id)) {
                                        await message.member.roles.add(role, `Level ${reward.level} ödülü`);
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    logger.error('Level sistemi hatası:', error.message);
                }
            }
        }

        // AFK kontrolü
        const userData = await User.findOne({ odasi: message.author.id, odaId: message.guild.id });
        if (userData && userData.afk && userData.afk.enabled) {
            userData.afk.enabled = false;
            userData.afk.reason = null;
            userData.afk.since = null;
            await userData.save();

            const afkMsg = await message.reply({
                content: '👋 AFK durumunuz kaldırıldı!',
                allowedMentions: { repliedUser: false }
            });
            setTimeout(() => afkMsg.delete().catch(() => { }), 3000);
        }

        // Mention edilen AFK kullanıcılarını kontrol et
        if (message.mentions.users.size > 0) {
            for (const [, mentioned] of message.mentions.users) {
                const mentionedUser = await User.findOne({ odasi: mentioned.id, odaId: message.guild.id });
                if (mentionedUser && mentionedUser.afk && mentionedUser.afk.enabled) {
                    await message.reply({
                        content: `💤 **${mentioned.username}** AFK: ${mentionedUser.afk.reason || 'Sebep belirtilmedi'}`,
                        allowedMentions: { repliedUser: false }
                    });
                }
            }
        }
    }
};
