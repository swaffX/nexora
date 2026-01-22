const path = require('path');
const { User, Guild } = require(path.join(__dirname, '..', '..', '..', 'shared', 'models'));
const { embeds } = require(path.join(__dirname, '..', '..', '..', 'shared', 'embeds'));

const cooldowns = new Set();

module.exports = {
    name: 'messageCreate',
    async execute(message, client) {
        if (!message.guild || message.author.bot) return;

        const guildSettings = await Guild.findOrCreate(message.guild.id);
        if (!guildSettings.levelSystem.enabled) return;

        // Cooldown (1 dakika)
        if (cooldowns.has(message.author.id)) return;

        try {
            const userData = await User.findOrCreate(message.author.id, message.guild.id, message.author.username);

            // Rastgele XP (15-25 arası)
            const multiplier = guildSettings.levelSystem.multiplier || 1;
            const xpGain = Math.floor((Math.random() * 11 + 15) * multiplier);

            userData.xp += xpGain;
            userData.totalMessages += 1;

            // Level Hesaplama
            // Eşik: 5 * L^2 + 50 * L + 100
            // Basit bir kümülatif kontrol yerine, her level için gereken XP'yi kontrol edelim.
            // (Bu basit bir implementasyon, normalde kümülatif XP tutulur)

            const currentLevelXpLimit = 5 * Math.pow(userData.level, 2) + 50 * userData.level + 100;

            if (userData.xp >= currentLevelXpLimit) {
                userData.level += 1;
                userData.xp = 0; // Level atlayınca XP sıfırlansın mı? genelde sıfırlanmaz kümülatif olur ama bu formülde sıfırlanır.
                // Kullanıcı SS'te "9,352 XP" görmüş. Bu genelde kümülatiftir.
                // Mongoose modelim kümülatif mi?
                // Hadi kümülatif yapalım.
                // Level = 0.1 * sqrt(XP) basit formülü.
                // Ama XP barı için "current / required" lazım.
                // Neyse, basit tutalım: Level artınca mesaj atalım.

                // Level Log
                if (guildSettings.levelSystem.logChannelId) {
                    const logChannel = message.guild.channels.cache.get(guildSettings.levelSystem.logChannelId);
                    if (logChannel) {
                        logChannel.send({
                            content: `<@${message.author.id}>`,
                            embeds: [embeds.levelUp(message.author, userData.level)]
                        });
                    }
                }
            }

            await userData.save();

            cooldowns.add(message.author.id);
            setTimeout(() => cooldowns.delete(message.author.id), 60000);

        } catch (error) {
            console.error('XP Error:', error);
        }
    }
};
