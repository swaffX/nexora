const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mind-duel')
        .setDescription('Akıl Oyunları: Sayı tut ve tahminde bulun!')
        .addUserOption(option =>
            option.setName('user')
                .setDescription('Meydan okuyacağın kişi')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Bahis miktarı')
                .setMinValue(50)
                .setRequired(true)),

    async execute(interaction) {
        const targetUser = interaction.options.getUser('user');
        const amount = interaction.options.getInteger('amount');
        const author = interaction.user;

        // Validasyonlar
        if (targetUser.id === author.id) return interaction.reply({ content: '❌ Kendinle oynayamazsın.', flags: MessageFlags.Ephemeral });
        if (targetUser.bot) return interaction.reply({ content: '❌ Botlarla oynayamazsın.', flags: MessageFlags.Ephemeral });

        // Database Kontrolleri
        const p1 = await User.findOne({ odasi: author.id, odaId: interaction.guild.id });
        const p2 = await User.findOne({ odasi: targetUser.id, odaId: interaction.guild.id });

        if (!p1 || p1.balance < amount) return interaction.reply({ content: '❌ Senin yeterli paran yok.', flags: MessageFlags.Ephemeral });
        if (!p2 || p2.balance < amount) return interaction.reply({ content: `❌ **${targetUser.username}** kullanıcısının yeterli parası yok.`, flags: MessageFlags.Ephemeral });

        // --- Davet Aşaması ---
        const inviteEmbed = new EmbedBuilder()
            .setColor('#9b59b6')
            .setTitle('🧠 AKIL OYUNLARI (MIND DUEL)')
            .setDescription(`<@${targetUser.id}>, **${author.username}** seni **${amount}** NexCoin bahisli bir zeka savaşına çağırıyor!\n\n**Nasıl Oynanır?**\n1. 1-100 arası bir sayı tut.\n2. Rakibin sayısının seninkinden Büyük mü / Küçük mü olduğunu tahmin et.\n3. Sadece bir kişi doğru bilene kadar devam eder!`)
            .setFooter({ text: 'Kabul etmek için 30 saniyen var.' });

        const inviteRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('accept_mind').setLabel('Kabul Et').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId('decline_mind').setLabel('Reddet').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        const reply = await interaction.reply({ content: `<@${targetUser.id}>`, embeds: [inviteEmbed], components: [inviteRow] });
        const msg = await interaction.fetchReply();

        const inviteCollector = msg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 30000
        });

        inviteCollector.on('collect', async i => {
            if (i.user.id !== targetUser.id && i.user.id !== author.id) return i.reply({ content: 'Bu oyun senin değil.', flags: MessageFlags.Ephemeral });

            if (i.customId === 'decline_mind') {
                await i.update({ content: '❌ Oyun reddedildi.', embeds: [], components: [] });
                inviteCollector.stop('declined');
                return;
            }

            if (i.customId === 'accept_mind') {
                if (i.user.id !== targetUser.id) return i.reply({ content: 'Sadece rakip kabul edebilir.', flags: MessageFlags.Ephemeral });
                inviteCollector.stop('accepted');

                // Bakiyeleri Çek
                const doc1 = await User.findOne({ odasi: author.id, odaId: interaction.guild.id });
                const doc2 = await User.findOne({ odasi: targetUser.id, odaId: interaction.guild.id });
                doc1.balance -= amount;
                doc2.balance -= amount;
                await doc1.save();
                await doc2.save();

                // OYUN DÖNGÜSÜNÜ BAŞLAT
                const gameMsg = await interaction.fetchReply();
                runGamePhase1_Input(gameMsg, author, targetUser, amount, interaction.guild.id, 1);
            }
        });
    }
};

// 1. FAZ: SAYI TUTMA (Kişiye Özel Rastgele Aralıklar)
async function runGamePhase1_Input(message, p1, p2, amount, guildId, round) {
    try {
        // Her oyuncu için FARKLI ve RASTGELE aralıklar oluşturuyoruz.

        // Yardımcı Fonksiyon: Aralık Üret (Kaotik ve Kesişen)
        const generateRanges = () => {
            // Anti-Exploit Logic:
            // Aralıklar artık 0-50 gibi sabit değil.
            // Birbirine geçen, riskli bölgeler.

            // Low: Genelde 1-45 arası ama bazen 15-55'e kayabilir.
            const low_center = Math.floor(Math.random() * 30) + 15; // 15-45 arası merkez
            const low_span = Math.floor(Math.random() * 10) + 10;   // +/- 10-20
            const low_min = Math.max(1, low_center - low_span);
            const low_max = Math.min(100, low_center + low_span);

            // High: Genelde 55-100 arası ama bazen 45-85'e inebilir.
            const high_center = Math.floor(Math.random() * 30) + 55; // 55-85 arası merkez
            const high_span = Math.floor(Math.random() * 10) + 10;
            const high_min = Math.max(1, high_center - high_span);
            const high_max = Math.min(100, high_center + high_span);

            return {
                low: { min: low_min, max: low_max },
                high: { min: high_min, max: high_max }
            };
        };

        const p1_ranges = generateRanges();
        const p2_ranges = generateRanges();

        const gameState = {
            p1: { id: p1.id, name: p1.username, number: null, ranges: p1_ranges },
            p2: { id: p2.id, name: p2.username, number: null, ranges: p2_ranges }
        };

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('view_ranges').setLabel('Kartlarına Bak (Gizli)').setStyle(ButtonStyle.Secondary).setEmoji('👁️'),
            new ButtonBuilder().setCustomId('path_low').setLabel('Düşük Seç').setStyle(ButtonStyle.Primary).setEmoji('📉'),
            new ButtonBuilder().setCustomId('path_high').setLabel('Yüksek Seç').setStyle(ButtonStyle.Danger).setEmoji('📈')
        );

        await message.edit({
            content: `🏁 **TUR ${round} BAŞLIYOR!**\n\nSistem her iki oyuncuya da **farklı ve rastgele** sayı aralıkları atadı.\n\n👁️ **Önce:** "Kartlarına Bak" diyerek seçeneklerini gör.\n👉 **Sonra:** Stratejine uygun rotayı seç!`,
            embeds: [],
            components: [row]
        });

        // Butonları dinle
        const filter = i => ['path_low', 'path_high', 'view_ranges'].includes(i.customId);
        const collector = message.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async btn => {
            if (btn.user.id !== p1.id && btn.user.id !== p2.id) {
                return btn.reply({ content: '❌ Bu oyun senin değil.', flags: MessageFlags.Ephemeral });
            }

            const player = btn.user.id === p1.id ? gameState.p1 : gameState.p2;

            // KARTLARA BAKMA (GİZLİ BİLGİ)
            if (btn.customId === 'view_ranges') {
                return btn.reply({
                    content: `🕵️ **Senin Gizli Seçeneklerin:**\n\n📉 **Düşük Yol:** ${player.ranges.low.min} - ${player.ranges.low.max}\n📈 **Yüksek Yol:** ${player.ranges.high.min} - ${player.ranges.high.max}\n\n*Rakibin bu aralıkları bilmiyor. Birini seç ve şaşırt!*`,
                    flags: MessageFlags.Ephemeral
                });
            }

            if (player.number !== null) {
                return btn.reply({ content: '✅ Sen zaten seçimini yaptın ve sayını tuttun.', flags: MessageFlags.Ephemeral });
            }

            // Seçilen Yola göre Kişiye Özel Limitleri Belirle
            const isHigh = btn.customId === 'path_high';
            const rangeObj = isHigh ? player.ranges.high : player.ranges.low;
            const min = rangeObj.min;
            const max = rangeObj.max;

            // MODAL AÇ
            const modal = new ModalBuilder()
                .setCustomId(`md_input_${btn.user.id}_r${round}`)
                .setTitle(`${isHigh ? 'YÜKSEK' : 'DÜŞÜK'} ROTA (${min}-${max})`);

            const input = new TextInputBuilder()
                .setCustomId('secret_num')
                .setLabel(`Sayı Gir (${min}-${max})`)
                .setStyle(TextInputStyle.Short)
                .setPlaceholder(`Bu aralıkta bir sayı tut...`)
                .setRequired(true)
                .setMaxLength(3);

            modal.addComponents(new ActionRowBuilder().addComponents(input));

            try {
                await btn.showModal(modal);
                const submit = await btn.awaitModalSubmit({ time: 30000, filter: m => m.customId === `md_input_${btn.user.id}_r${round}` });
                const num = parseInt(submit.fields.getTextInputValue('secret_num'));

                // VALIDATION
                if (isNaN(num) || num < min || num > max) {
                    await submit.reply({ content: `❌ **HATA!** Sana verilen aralığa sadık kalmalısın: **${min} - ${max}** arası gir!`, flags: MessageFlags.Ephemeral });
                    return;
                }

                player.number = num;
                await submit.reply({ content: `🔒 Rota: **${isHigh ? 'YÜKSEK' : 'DÜŞÜK'}** | Sayı: **${num}** kilitlendi.`, flags: MessageFlags.Ephemeral });

                // İkisi de Hazır mı?
                if (gameState.p1.number !== null && gameState.p2.number !== null) {
                    collector.stop();

                    if (gameState.p1.number === gameState.p2.number) {
                        return finishGameDraw(message, gameState, p1, p2, amount, guildId);
                    }
                    runGamePhase2_Guess(message, gameState, p1, p2, amount, guildId, round);
                }

            } catch (err) { }
        });

    } catch (e) { console.error(e); }
}

// 2. FAZ: TAHMİN ETME
async function runGamePhase2_Guess(message, gameState, p1, p2, amount, guildId, round) {
    try {
        // State'e tahminleri ekle
        gameState.p1.guess = null;
        gameState.p2.guess = null;

        const embed = new EmbedBuilder()
            .setColor('#3498db')
            .setTitle(`🤔 TAHMİN ZAMANI (Tur ${round})`)
            .setDescription(`İki taraf da sayısını tuttu!\n\n**Soru:** Rakibinin sayısı, senin sayından **BÜYÜK (⬆️)** mü **KÜÇÜK (⬇️)** mü?`)
            .setFooter({ text: 'Doğru bilen kazanır, ikiniz de bilirseniz yeni tur!' });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('guess_higher').setLabel('Daha BÜYÜK').setStyle(ButtonStyle.Success).setEmoji('⬆️'),
            new ButtonBuilder().setCustomId('guess_lower').setLabel('Daha KÜÇÜK').setStyle(ButtonStyle.Danger).setEmoji('⬇️')
        );

        await message.edit({ content: '', embeds: [embed], components: [row] });

        // Sadece tahmin butonlarını dinle
        const filter = i => ['guess_higher', 'guess_lower'].includes(i.customId);
        const collector = message.createMessageComponentCollector({ filter, componentType: ComponentType.Button, time: 60000 });

        collector.on('collect', async btn => {
            if (btn.user.id !== p1.id && btn.user.id !== p2.id) return btn.reply({ content: 'Sıranı bekle.', flags: MessageFlags.Ephemeral });

            const player = btn.user.id === p1.id ? gameState.p1 : gameState.p2;

            if (player.guess) return btn.reply({ content: 'Zaten tahmin yaptın.', flags: MessageFlags.Ephemeral });

            // Hızlı işlem için defer (Unknown interaction fix)
            await btn.deferUpdate();

            player.guess = btn.customId === 'guess_higher' ? 'higher' : 'lower';
            await btn.followUp({ content: `✅ Tahminin alındı: **${player.guess === 'higher' ? 'BÜYÜK' : 'KÜÇÜK'}**`, flags: MessageFlags.Ephemeral });

            // İkisi de Tahmin Yaptı mı?
            if (gameState.p1.guess && gameState.p2.guess) {
                collector.stop(); // Faz bitti
                resolveRound(message, gameState, p1, p2, amount, guildId, round);
            }
        });

    } catch (e) { console.error(e); }
}

// SONUÇLAMA
async function resolveRound(message, gameState, p1, p2, amount, guildId, round) {
    // P1 Doğru mu? (P2'nin sayısı P1'e göre ne?)
    // Eğer P1 'higher' dediyse ve P2 > P1 ise DOĞRU.
    const p1_real_relation = gameState.p2.number > gameState.p1.number ? 'higher' : 'lower';
    const p1_won = gameState.p1.guess === p1_real_relation;

    // P2 Doğru mu?
    const p2_real_relation = gameState.p1.number > gameState.p2.number ? 'higher' : 'lower';
    const p2_won = gameState.p2.guess === p2_real_relation;

    const resultEmbed = new EmbedBuilder()
        .setTitle(`⚖️ TUR ${round} SONUCU`)
        .addFields(
            {
                name: `${gameState.p1.name}`,
                value: `Sayı: **${gameState.p1.number}**\nTahmin: ${gameState.p1.guess === 'higher' ? '⬆️' : '⬇️'}\nSonuç: ${p1_won ? '✅ BİLDİ' : '❌ BİLEMEDİ'}`,
                inline: true
            },
            {
                name: `${gameState.p2.name}`,
                value: `Sayı: **${gameState.p2.number}**\nTahmin: ${gameState.p2.guess === 'higher' ? '⬆️' : '⬇️'}\nSonuç: ${p2_won ? '✅ BİLDİ' : '❌ BİLEMEDİ'}`,
                inline: true
            }
        );

    // KAZANAN VAR MI?
    if (p1_won && !p2_won) {
        finishGameWin(message, p1, amount, guildId, resultEmbed);
    } else if (p2_won && !p1_won) {
        finishGameWin(message, p2, amount, guildId, resultEmbed);
    } else {
        // BERABERE (İkisi de bildi veya ikisi de bilemedi) -> YENİ TUR
        resultEmbed.setColor('#e67e22').setDescription('🤝 **BERABERE!** Yeni tur başlıyor... 🔄');
        await message.edit({ embeds: [resultEmbed], components: [] });

        // 3 sn bekle ve yeni tura (FAZ 1) dön
        setTimeout(() => {
            runGamePhase1_Input(message, p1, p2, amount, guildId, round + 1);
        }, 3000);
    }
}

// BİTİŞ: BERABERE (AYNI SAYI)
async function finishGameDraw(message, gameState, p1, p2, amount, guildId) {
    // Paraları İade Et
    await User.findOneAndUpdate({ odasi: p1.id, odaId: guildId }, { $inc: { balance: amount } });
    await User.findOneAndUpdate({ odasi: p2.id, odaId: guildId }, { $inc: { balance: amount } });

    const embed = new EmbedBuilder()
        .setColor('#95a5a6')
        .setTitle('🤝 OYUN BİTTİ - BERABERE!')
        .setDescription(`İkiniz de **${gameState.p1.number}** sayısını tuttunuz!\n\n💸 **Paralar iade edildi.**`);

    await message.edit({ content: '', embeds: [embed], components: [] });
}

// BİTİŞ: KAZANAN
async function finishGameWin(message, winner, amount, guildId, resultEmbed) {
    const winAmount = amount * 2;
    await User.findOneAndUpdate({ odasi: winner.id, odaId: guildId }, { $inc: { balance: winAmount } });

    resultEmbed.setColor('#2ecc71')
        .setDescription(`🎉 **KAZANAN:** <@${winner.id}>\n💰 **Ödül:** ${winAmount} NexCoin`);

    await message.edit({ embeds: [resultEmbed], components: [] });

    // Quest
    try {
        const { updateQuestProgress } = require('../../utils/questManager');
        await updateQuestProgress({ odasi: winner.id, odaId: guildId }, 'gamble', 1);
    } catch (e) { }
}
