const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ComponentType } = require('discord.js');
const path = require('path');
const User = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models', 'User'));
const { JOBS, calculateSalary, requiredXP } = require('../../utils/jobs');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('career')
        .setDescription('Kariyer Yönetimi Sistemi')
        .addSubcommand(sub =>
            sub.setName('info')
                .setDescription('Kariyer durumunu görüntüle'))
        .addSubcommand(sub =>
            sub.setName('jobs')
                .setDescription('Mevcut meslekleri listele ve işe gir'))
        .addSubcommand(sub =>
            sub.setName('work')
                .setDescription('Çalışarak para ve XP kazan'))
        .addSubcommand(sub =>
            sub.setName('resign')
                .setDescription('Mevcut işinden istifa et')),

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Kullanıcıyı bul
        let user = await User.findOne({ odasi: userId, odaId: guildId });
        if (!user) {
            user = await User.create({ odasi: userId, odaId: guildId });
        }

        // --- 1. INFO: Kariyer Kartı ---
        if (subcommand === 'info') {
            const jobData = user.career.job ? JOBS[user.career.job] : null;

            const embed = new EmbedBuilder()
                .setColor(jobData ? '#3498db' : '#95a5a6')
                .setTitle(`📋 ${interaction.user.username} - Kariyer Dosyası`)
                .setThumbnail(interaction.user.displayAvatarURL());

            if (jobData) {
                const salary = calculateSalary(user.career.job, user.career.level);
                const nextLevelXP = requiredXP(user.career.level);
                const progress = Math.floor((user.career.xp / nextLevelXP) * 100);

                embed.addFields(
                    { name: 'Meslek', value: `${jobData.emoji} **${jobData.name}**`, inline: true },
                    { name: 'Seviye', value: `Level **${user.career.level}**`, inline: true },
                    { name: 'Maaş', value: `💳 ${salary} coin/saat`, inline: true },
                    { name: 'Terfi Durumu', value: `XP: ${user.career.xp}/${nextLevelXP} (%${progress})\n${this.createProgressBar(progress)}`, inline: false },
                    { name: 'Toplam Kazanç', value: `💰 ${user.career.totalEarnings.toLocaleString()} coin`, inline: false }
                );
            } else {
                embed.setDescription('🚫 Şu an işsizsiniz. `/career jobs` komutuyla iş bulabilirsiniz.');
            }

            return interaction.reply({ embeds: [embed] });
        }

        // --- 2. JOBS: İş Listesi ve Seçim ---
        if (subcommand === 'jobs') {
            if (user.career.job) {
                return interaction.reply({ content: '❌ Zaten bir işin var! Önce istifa etmelisin (`/career resign`).', ephemeral: true });
            }

            const embed = new EmbedBuilder()
                .setTitle('💼 İş İlanları')
                .setDescription('Aşağıdaki menüden ilgini çeken mesleği seçip başlayabilirsin.')
                .setColor('#f1c40f');

            const options = Object.entries(JOBS).map(([key, job]) => {
                return {
                    label: job.name,
                    description: `Maaş: ${job.baseSalary} - ${job.description}`,
                    value: key,
                    emoji: job.emoji
                };
            });

            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder()
                    .setCustomId('select_job')
                    .setPlaceholder('Bir meslek seç...')
                    .addOptions(options)
            );

            const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            // Collector
            const filter = i => i.user.id === interaction.user.id;
            const collector = msg.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

            collector.on('collect', async i => {
                const selectedJobId = i.values[0];
                const job = JOBS[selectedJobId];

                user.career = {
                    job: selectedJobId,
                    level: 1,
                    xp: 0,
                    lastWorkTime: null,
                    totalEarnings: 0
                };
                await user.save();

                await i.update({ content: `🎉 Tebrikler! Artık bir **${job.emoji} ${job.name}** olarak çalışıyorsun. İlk iş günün için \`/career work\` yaz!`, embeds: [], components: [] });
            });

            return;
        }

        // --- 3. WORK: Çalışma ---
        if (subcommand === 'work') {
            if (!user.career.job) {
                return interaction.reply({ content: '❌ İşsizken çalışamazsın! Önce iş bul (`/career jobs`).', ephemeral: true });
            }

            // Cooldown Kontrolü (1 Saat)
            const NOW = Date.now();
            const COOLDOWN = 3600 * 1000;
            const lastWork = user.career.lastWorkTime ? new Date(user.career.lastWorkTime).getTime() : 0;

            if (NOW - lastWork < COOLDOWN) {
                const remaining = Math.ceil((COOLDOWN - (NOW - lastWork)) / 60000);
                return interaction.reply({ content: `⏳ Çok yorgunsun! Tekrar çalışmak için **${remaining} dakika** dinlenmelisin.`, ephemeral: true });
            }

            // Maaş ve XP Hesapla
            const salary = calculateSalary(user.career.job, user.career.level);
            const xpGain = Math.floor(Math.random() * 20) + 10; // 10-30 XP

            // Güncelle
            user.balance += salary;
            user.career.totalEarnings += salary;
            user.career.xp += xpGain;
            user.career.lastWorkTime = NOW;

            // Seviye Atlama Kontrolü
            const required = requiredXP(user.career.level);
            let promoteMsg = '';

            if (user.career.xp >= required) {
                user.career.level++;
                user.career.xp -= required;
                const newSalary = calculateSalary(user.career.job, user.career.level);
                promoteMsg = `\n🆙 **TERFİ ALDIN!** Yeni seviyen: **${user.career.level}**. Yeni maaşın: **${newSalary}** coin!`;
            }

            await user.save(); // Önce kariyer bilgilerini kaydet

            // Quest Update (Kaydedilmiş veri üzerinden işlem yapması için sonra çağırıyoruz)
            const { updateQuestProgress } = require('../../utils/questManager');
            const newAchievements = await updateQuestProgress({ odasi: userId, odaId: guildId }, 'work', 1);

            if (newAchievements.length > 0) {
                promoteMsg += `\n🏆 **YENİ BAŞARIM:** ${newAchievements.join(', ')}`;
            }

            const job = JOBS[user.career.job];
            const workEmbed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setAuthor({ name: `${job.name} olarak çalıştın`, iconURL: interaction.user.displayAvatarURL() })
                .setDescription(`💵 **Kazanılan:** ${salary} coin\n⭐ **Kazanılan XP:** ${xpGain} XP${promoteMsg}`)
                .setFooter({ text: 'Bir sonraki vardiya: 1 saat sonra' });

            return interaction.reply({ embeds: [workEmbed] });
        }

        // --- 4. RESIGN: İstifa ---
        if (subcommand === 'resign') {
            if (!user.career.job) {
                return interaction.reply({ content: '❌ Zaten işsizsin.', ephemeral: true });
            }

            // Onay mekanizması eklenebilir ama basit tutalım.
            const oldJob = JOBS[user.career.job].name;
            user.career = {
                job: null,
                level: 1,
                xp: 0,
                lastWorkTime: null,
                totalEarnings: user.career.totalEarnings // Gelir geçmişi kalsın mı? Evet, hatıra.
            };
            await user.save();

            return interaction.reply({ content: `🚪 **${oldJob}** mesleğinden istifa ettin. Artık özgürsün (ve parasızsın).`, ephemeral: true });
        }
    },

    createProgressBar(percent) {
        const totalBars = 10;
        const filledBars = Math.round((percent / 100) * totalBars);
        const emptyBars = totalBars - filledBars;
        return '🟩'.repeat(filledBars) + '⬜'.repeat(emptyBars);
    }
};
