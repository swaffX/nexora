const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const path = require('path');
const User = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models', 'User'));
const { QUESTS, ACHIEVEMENTS, generateDailyQuests } = require('../../utils/questManager');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('quests')
        .setDescription('Görev ve Başarımları Görüntüle')
        .addSubcommand(sub =>
            sub.setName('daily')
                .setDescription('Günlük Görevlerini Gör'))
        .addSubcommand(sub =>
            sub.setName('achievements')
                .setDescription('Başarımlarını ve Rozetlerini Gör')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        let user = await User.findOne({ odasi: userId, odaId: guildId });
        if (!user) {
            user = await User.create({ odasi: userId, odaId: guildId });
        }

        // --- GÜNLÜK GÖREVLERİN SIFIRLANMASI (Kontrol) ---
        const NOW = new Date();
        const lastReset = user.lastQuestReset ? new Date(user.lastQuestReset) : new Date(0);

        // Eğer gün değiştiyse (Basit kontrol: tarih stringi farklıysa)
        if (NOW.toDateString() !== lastReset.toDateString()) {
            user.quests = generateDailyQuests();
            user.lastQuestReset = NOW;
            await user.save();
        }

        if (subcommand === 'daily') {
            const embed = new EmbedBuilder()
                .setColor('#e67e22')
                .setTitle('📜 Günlük Görevler')
                .setDescription('Her gün gece 00:00\'da yenilenir. Tamamlanan görevlerin ödülleri otomatik hesabına yatar.')
                .setThumbnail(interaction.user.displayAvatarURL());

            if (!user.quests || user.quests.length === 0) {
                user.quests = generateDailyQuests();
                await user.save();
            }

            user.quests.forEach((q, index) => {
                const def = QUESTS[q.questId];
                if (!def) return;

                const percent = Math.floor((q.progress / q.target) * 100);
                const statusEmoji = q.isCompleted ? '✅' : '⏳';
                const progressBar = this.createProgressBar(percent);

                embed.addFields({
                    name: `${statusEmoji} Görev #${index + 1}: ${def.description}`,
                    value: `İlerleme: **${q.progress}/${q.target}**\n${progressBar} (%${percent})\n🎁 Ödül: **${def.reward}** Coin`,
                    inline: false
                });
            });

            return interaction.reply({ embeds: [embed] });
        }

        if (subcommand === 'achievements') {
            const embed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('🏆 Başarımlar & Rozetler')
                .setDescription('Sistemde gösterdiğin üstün performans rozetleri.')
                .setThumbnail(interaction.user.displayAvatarURL());

            const userAchieves = user.achievements.map(a => a.id);
            let unlockedCount = 0;

            for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
                const isUnlocked = userAchieves.includes(id);
                if (isUnlocked) unlockedCount++;

                const status = isUnlocked ? '🔓 AÇIK' : '🔒 KİLİTLİ';
                const name = isUnlocked ? `**${ach.name}**` : `||${ach.name}||`; // Gizem

                embed.addFields({
                    name: `${isUnlocked ? '🌟' : 'zzz'} ${name}`,
                    value: `${ach.description}\nDurum: ${status}`,
                    inline: true
                });
            }

            embed.setFooter({ text: `Toplam: ${unlockedCount}/${Object.keys(ACHIEVEMENTS).length} Başarım Açıldı` });

            return interaction.reply({ embeds: [embed] });
        }
    },

    createProgressBar(percent) {
        const total = 10;
        const filled = Math.round((percent / 100) * total);

        const emojies = {
            start_fill: '<a:fillstart:1246429695529058374>',
            mid_fill: '<a:fill:1246429692571943014>',
            end_fill: '<a:fillend:1246429703145918516>',
            mid_empty: '<:empty:1246429688134373407>',
            end_empty: '<:emptyend:1246429710137954397>'
        };

        if (filled === 0) {
            return emojies.mid_empty.repeat(9) + emojies.end_empty;
        }

        if (filled === 10) {
            return emojies.start_fill + emojies.mid_fill.repeat(8) + emojies.end_fill;
        }

        const start = emojies.start_fill;
        const midFilled = emojies.mid_fill.repeat(Math.max(0, filled - 1));
        const midEmpty = emojies.mid_empty.repeat(Math.max(0, total - filled - 1));
        const end = emojies.end_empty;

        return `${start}${midFilled}${midEmpty}${end}`;
    }
};
