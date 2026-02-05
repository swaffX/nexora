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

        // 🛑 GUARD: SPAM KONTROLÜ
        try {
            const isSpam = await require('../handlers/guardHandler').checkSpam(message);
            if (isSpam) return; // Spam ise işlemi durdur
        } catch (e) { console.error('Guard Error:', e); }

        // Guild ayarlarını al
        const guildSettings = await Guild.findOrCreate(message.guild.id, message.guild.name);

        // 🧠 Nexora Brain (AI)
        await aiHandler.handleMessage(message);

        // LEVEL SİSTEMİ KALDIRILDI
        // ESKİ XP/LEVEL/ACHIEVEMENT KODLARI BURADAYDI VE TEMİZLENDİ.

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
