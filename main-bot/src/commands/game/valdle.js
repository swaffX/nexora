const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const path = require('path');
const valorantData = require('../../utils/valorantGameData');
const User = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models', 'User'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('valdle')
        .setDescription('Valorant Bilgi Yarışması (Valdle.gg tarzı)')
        .addSubcommand(sub => sub.setName('classic').setDescription('Ajanı Tahmin Et (İpuçlarıyla)'))
        .addSubcommand(sub => sub.setName('ability').setDescription('Yetenek İkonundan Ajanı Bul'))
        .addSubcommand(sub => sub.setName('weapon').setDescription('Silahı Tahmin Et'))
        .addSubcommand(sub => sub.setName('map').setDescription('Harita Görselini Tahmin Et')),

    async execute(interaction) {
        // Önce verileri yükle (Eğer yoksa)
        await valorantData.fetchData();

        if (valorantData.agents.length === 0) {
            return interaction.reply({ content: '⚠️ Veriler yüklenemedi. Lütfen biraz sonra tekrar deneyin.', ephemeral: true });
        }

        const subcommand = interaction.options.getSubcommand();
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // --- 1. ABILITY, WEAPON, MAP (Basit Seçmeli Modlar) ---
        if (['ability', 'weapon', 'map'].includes(subcommand)) {
            let questionData;
            let correctAnswer;
            let options = [];
            let embedTitle = '';
            let embedImage = '';

            if (subcommand === 'ability') {
                const data = valorantData.getRandomAbility();
                questionData = data;
                correctAnswer = data.agentName;
                embedTitle = 'Hangi Ajanın Yeteneği?';
                embedImage = data.icon;

                // Yanlış cevaplar (Rastgele Ajanlar)
                const others = valorantData.agents.filter(a => a.name !== correctAnswer).sort(() => 0.5 - Math.random()).slice(0, 4);
                options = [...others.map(o => o.name), correctAnswer].sort(() => 0.5 - Math.random());
            }
            else if (subcommand === 'weapon') {
                const data = valorantData.getRandomWeapon();
                questionData = data;
                correctAnswer = data.name; // Silah ismini soruyoruz
                embedTitle = 'Bu Hangi Silah?';
                // Eğer skin varsa skin ikonunu göster, yoksa silah ikonunu

                // Biraz zorlaştırmak için sadece ikonu gösterelim
                embedImage = data.icon;

                // Yanlış cevaplar (Rastgele Silahlar)
                const others = valorantData.weapons.filter(w => w.name !== correctAnswer).sort(() => 0.5 - Math.random()).slice(0, 4);
                options = [...others.map(o => o.name), correctAnswer].sort(() => 0.5 - Math.random());
            }
            else if (subcommand === 'map') {
                const data = valorantData.getRandomMap();
                questionData = data;
                correctAnswer = data.name;
                embedTitle = 'Bu Hangi Harita?';
                embedImage = data.splash; // Tam ekran görsel

                // Yanlış cevaplar
                const others = valorantData.maps.filter(m => m.name !== correctAnswer).sort(() => 0.5 - Math.random()).slice(0, 4);
                options = [...others.map(o => o.name), correctAnswer].sort(() => 0.5 - Math.random());
            }

            // Embed Oluştur
            const embed = new EmbedBuilder()
                .setColor('#ff4655') // Valorant Red
                .setTitle(`🧩 Valdle: ${embedTitle}`)
                .setImage(embedImage)
                .setFooter({ text: 'Aşağıdaki menüden doğru cevabı seç!' });

            // Select Menu
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('valdle_guess')
                .setPlaceholder('Tahminini Seç...')
                .addOptions(options.map(opt => ({ label: opt, value: opt })));

            const row = new ActionRowBuilder().addComponents(selectMenu);

            const reply = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

            // Collector
            const collector = reply.createMessageComponentCollector({
                componentType: ComponentType.StringSelect,
                filter: i => i.user.id === userId,
                time: 30000
            });

            collector.on('collect', async i => {
                const guess = i.values[0];
                collector.stop();

                if (guess === correctAnswer) {
                    // Ödül Ver
                    const prize = 150;
                    await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: prize } });

                    // Quest Update
                    try {
                        const { updateQuestProgress } = require('../../utils/questManager');
                        // Burada 'valdle' diye bir quest tipi yok ama 'gamble' veya 'daily' olarak değil, belki 'win_game' eklenebilir.
                        // Şimdilik eklemiyoruz veya 'work' gibi sayabiliriz.
                    } catch (e) { }

                    await i.update({
                        content: `🎉 **DOĞRU!** Cevap: **${correctAnswer}**\n💰 Kazandın: **${prize} NexCoin**`,
                        embeds: [embed.setColor('#2ecc71')],
                        components: []
                    });
                } else {
                    await i.update({
                        content: `❌ **YANLIŞ!** Doğru cevap: **${correctAnswer}**\nSeçimin: ${guess}`,
                        embeds: [embed.setColor('#e74c3c')],
                        components: []
                    });
                }
            });
            return;
        }

        // --- 2. CLASSIC (Ajan Tahmin - Wordle Tarzı) ---
        if (subcommand === 'classic') {
            const targetAgent = valorantData.getRandomAgent();
            let attempts = 0;
            const maxAttempts = 6;
            const history = []; // Tahmin geçmişi

            const embed = new EmbedBuilder()
                .setColor('#ff4655')
                .setTitle('🕵️‍♂️ Valdle: Ajanı Tahmin Et!')
                .setDescription(`Aklımda bir ajan var. Özelliklerine bakarak bulmaya çalış!\n\n**Aşağıya ajan ismini yaz.** (Kalan Hak: ${maxAttempts})`)
                .addFields({ name: 'İpuçları', value: 'Tahmin yaptıkça burada belirecek.' })
                .setThumbnail('https://cdn.icon-icons.com/icons2/2699/PNG/512/valorant_logo_icon_170311.png');

            await interaction.reply({ embeds: [embed] });

            // Mesaj Collector (Kanalı dinle)
            const collector = interaction.channel.createMessageCollector({
                filter: m => m.author.id === userId,
                time: 120000 // 2 dakika
            });

            collector.on('collect', async m => {
                const guessName = m.content.trim();

                // Geçerli bir ajan ismi mi?
                const matchCheck = valorantData.checkAgentGuess(targetAgent.name, guessName);

                if (!matchCheck) {
                    // Geçersiz isimse tepki ver ama hakkını yeme (veya ye, valdle yemez)
                    const warning = await m.reply('❌ Böyle bir ajan yok! Lütfen geçerli bir ajan ismi yaz.');
                    setTimeout(() => warning.delete().catch(() => { }), 3000);
                    // Mesajı sil
                    m.delete().catch(() => { });
                    return;
                }

                // Mesajı sil (Temiz chat)
                m.delete().catch(() => { });

                attempts++;

                // Sonucu Analiz Et
                // matchCheck: { name: { value: 'Jett', match: true/false }, gender: ... }

                const formatCell = (item) => item.match ? `🟩 ${item.value}` : `🟥 ${item.value}`;

                const resultLine = `**${attempts}.** ${matchCheck.name.match ? '✅' : '❌'} **${matchCheck.name.value}** | ` +
                    `${formatCell(matchCheck.gender)} | ${formatCell(matchCheck.role)} | ${formatCell(matchCheck.species)} | ${formatCell(matchCheck.region)}`;

                history.push(resultLine);

                // Kazanma Kontrolü
                if (matchCheck.name.match) {
                    collector.stop('win');
                    const prize = 500; // Zor olduğu için yüksek ödül
                    await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: prize } });

                    embed.setColor('#2ecc71')
                        .setTitle(`🎉 TEBRİKLER! Ajan: ${targetAgent.name}`)
                        .setDescription(`Doğru bildin!\n\n${history.join('\n')}`)
                        .setThumbnail(targetAgent.icon)
                        .setFields({ name: 'Ödül', value: `💰 **${prize} NexCoin**` });

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                // Kaybetme Kontrolü
                if (attempts >= maxAttempts) {
                    collector.stop('lose');
                    embed.setColor('#e74c3c')
                        .setTitle(`💀 KAYBETTİN... Ajan: ${targetAgent.name}`)
                        .setDescription(`Hakkın bitti.\n\n${history.join('\n')}`)
                        .setThumbnail(targetAgent.icon);

                    await interaction.editReply({ embeds: [embed] });
                    return;
                }

                // Devam ediyor
                embed.setDescription(`Yanlış tahmin! Devam et.\nKalan Hak: **${maxAttempts - attempts}**`)
                    .setFields({ name: 'Geçmiş Tahminler', value: history.join('\n') || 'Henüz yok.' });

                await interaction.editReply({ embeds: [embed] });
            });

            collector.on('end', async (_, reason) => {
                if (reason === 'time') {
                    await interaction.editReply({ content: '⏳ Süre doldu!', embeds: [] });
                }
            });
        }
    }
};
