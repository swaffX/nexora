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
                startGameLoop(i, author, targetUser, amount, interaction.guild.id);
            }
        });
    }
};

async function startGameLoop(interaction, p1, p2, amount, guildId) {
    let round = 1;
    let winner = null;

    // Ana döngü yerine rekürsif fonksiyon kullanalım çünkü interaction/modal wait yapısı karmaşık
    // Ancak burada tek bir akış içinde state yönetmek daha temiz.

    // Mesaj referansı
    let gameMsg = await interaction.update({ content: `🎲 **TUR ${round} BAŞLIYOR!**\nSayılarınızı tutmanız bekleniyor...`, embeds: [], components: [createNumberInputRow()] });
    // fetchReply gerekebilir update sonrası
    gameMsg = await interaction.fetchReply();

    // Oyun State
    const gameState = {
        p1: { id: p1.id, number: null, guess: null },
        p2: { id: p2.id, number: null, guess: null }
    };

    // 1. INPUT PHASE (Sayı Tutma)
    // Butona basınca Modal açılacak.
    const inputCollector = gameMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    inputCollector.on('collect', async btn => {
        if (btn.user.id !== p1.id && btn.user.id !== p2.id) return btn.reply({ content: 'Sen oyuncu değilsin.', flags: MessageFlags.Ephemeral });

        // Eğer zaten sayı tuttuysa uyar
        const playerState = btn.user.id === p1.id ? gameState.p1 : gameState.p2;
        if (playerState.number !== null) return btn.reply({ content: 'Zaten bir sayı tuttun!', flags: MessageFlags.Ephemeral });

        // Modal Aç
        const modal = new ModalBuilder()
            .setCustomId(`mind_input_${btn.user.id}`)
            .setTitle('Bir Sayı Tut (1-100)');

        const input = new TextInputBuilder()
            .setCustomId('secret_num')
            .setLabel('Sayın kaç olsun?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('1 ile 100 arasında bir sayı gir')
            .setRequired(true)
            .setMaxLength(3);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await btn.showModal(modal);

        // Modal Cevabını Bekle (Global event handler kullanmadan burada bekleyebiliriz: awaitModalSubmit)
        try {
            const modalSubmit = await btn.awaitModalSubmit({ time: 30000, filter: m => m.customId === `mind_input_${btn.user.id}` });

            const num = parseInt(modalSubmit.fields.getTextInputValue('secret_num'));
            if (isNaN(num) || num < 1 || num > 100) {
                await modalSubmit.reply({ content: '❌ Geçersiz sayı! 1-100 arası olmalı. Tekrar butona bas.', flags: MessageFlags.Ephemeral });
                return;
            }

            playerState.number = num;
            await modalSubmit.reply({ content: `🔒 Sayını **${num}** olarak tuttun. Rakip bekleniyor...`, flags: MessageFlags.Ephemeral });

            // İkisi de tuttu mu?
            if (gameState.p1.number !== null && gameState.p2.number !== null) {
                inputCollector.stop();
                startGuessPhase(gameMsg, gameState, p1, p2, amount, guildId, round);
            }

        } catch (e) {
            // Zaman aşımı vs.
            console.error(e);
        }
    });
}

function createNumberInputRow() {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('pick_num').setLabel('Bir Sayı Tut').setStyle(ButtonStyle.Primary).setEmoji('🔢')
    );
}

async function startGuessPhase(message, gameState, p1, p2, amount, guildId, round) {
    // 2. GUESS PHASE
    const embed = new EmbedBuilder()
        .setColor('#3498db')
        .setTitle(`🤔 TAHMİN ZAMANI (Tur ${round})`)
        .setDescription(`İki taraf da sayısını tuttu!\n\n**Soru:** Rakibinin sayısı, senin sayından **BÜYÜK** mü **KÜÇÜK** mü?`)
        .setFooter({ text: 'Stratejik düşün...' });

    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('guess_higher').setLabel('Daha BÜYÜK (⬆️)').setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId('guess_lower').setLabel('Daha KÜÇÜK (⬇️)').setStyle(ButtonStyle.Danger)
    );

    await message.edit({ content: '', embeds: [embed], components: [row] });

    const guessCollector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    guessCollector.on('collect', async btn => {
        if (btn.user.id !== p1.id && btn.user.id !== p2.id) return btn.reply({ content: 'Sıranı bekle.', flags: MessageFlags.Ephemeral });

        const playerState = btn.user.id === p1.id ? gameState.p1 : gameState.p2;
        if (playerState.guess) return btn.reply({ content: 'Zaten tahmin yaptın.', flags: MessageFlags.Ephemeral });

        playerState.guess = btn.customId === 'guess_higher' ? 'higher' : 'lower';

        await btn.reply({ content: `Tahminin alındı: **${playerState.guess === 'higher' ? 'BÜYÜK' : 'KÜÇÜK'}**`, flags: MessageFlags.Ephemeral });

        if (gameState.p1.guess && gameState.p2.guess) {
            guessCollector.stop();
            resolveRound(message, gameState, p1, p2, amount, guildId, round);
        }
    });
}

async function resolveRound(message, gameState, p1, p2, amount, guildId, round) {
    // Logic
    // P1 Guess: Does P2 > P1 ?
    const p1_is_correct = (gameState.p1.guess === 'higher' && gameState.p2.number > gameState.p1.number) ||
        (gameState.p1.guess === 'lower' && gameState.p2.number < gameState.p1.number);

    // P2 Guess: Does P1 > P2 ?
    const p2_is_correct = (gameState.p2.guess === 'higher' && gameState.p1.number > gameState.p2.number) ||
        (gameState.p2.guess === 'lower' && gameState.p1.number < gameState.p2.number);

    // Eşitlik durumu? "Eşit" butonu yok, yani eşitse ikisi de bilememiş sayılır (veya özel kural).
    // Basitlik için: Eşitse Lower da Higher da yanlıştır.

    let resultEmbed = new EmbedBuilder()
        .setTitle(`⚖️ TUR ${round} SONUCU`)
        .addFields(
            { name: `${p1.username}`, value: `Sayı: **${gameState.p1.number}**\nTahmin: ${gameState.p1.guess === 'higher' ? '⬆️' : '⬇️'}\n**${p1_is_correct ? '✅ BİLDİ' : '❌ BİLEMEDİ'}**`, inline: true },
            { name: `${p2.username}`, value: `Sayı: **${gameState.p2.number}**\nTahmin: ${gameState.p2.guess === 'higher' ? '⬆️' : '⬇️'}\n**${p2_is_correct ? '✅ BİLDİ' : '❌ BİLEMEDİ'}**`, inline: true }
        );

    // Kazanan Belirle
    if (p1_is_correct && !p2_is_correct) {
        // P1 WINS
        const winAmount = amount * 2;
        await User.findOneAndUpdate({ odasi: p1.id, odaId: guildId }, { $inc: { balance: winAmount } });

        resultEmbed.setColor('#2ecc71').setDescription(`🎉 **KAZANAN:** <@${p1.id}>\n💰 **Ödül:** ${winAmount} NexCoin`);
        await message.edit({ embeds: [resultEmbed], components: [] });

    } else if (p2_is_correct && !p1_is_correct) {
        // P2 WINS
        const winAmount = amount * 2;
        await User.findOneAndUpdate({ odasi: p2.id, odaId: guildId }, { $inc: { balance: winAmount } });

        resultEmbed.setColor('#2ecc71').setDescription(`🎉 **KAZANAN:** <@${p2.id}>\n💰 **Ödül:** ${winAmount} NexCoin`);
        await message.edit({ embeds: [resultEmbed], components: [] });

    } else {
        // DRAW (Both correct or Both wrong)
        resultEmbed.setColor('#e67e22').setDescription('🤝 **BERABERE!** Kimse (veya herkes) bildi.\n\n🔄 **Yeni tur başlıyor...**');
        await message.edit({ embeds: [resultEmbed], components: [] });

        setTimeout(() => {
            // Restart Loop
            // Reset State for next round
            // Fonksiyonu tekrar çağırmak yerine, döngüyü yeniden başlatacak bir yapı lazım.
            // Ancak JS'de recursion ile yapalım.
            startGameLoop({ update: async (opts) => await message.edit(opts), fetchReply: async () => message, guild: { id: guildId } }, p1, p2, amount, guildId);
            // Note: interaction mockluyoruz çünkü startGameLoop interaction.update bekliyor.
            // message.edit interaction.update ile benzer işlev görür (eğer reply ise).
            // En temizi sıfırdan "startGuessPhase" değil "startGameLoop" çağırmak.
            // Ama startGameLoop'da "createMessageComponentCollector" message üzerinden çağrılıyor.
            // Mock obje biraz sakat olabilir. 
            // Direct message referansıyla devam edelim.

            // YENİ TUR LOGIC (Refactored for recursion)
            restartGame(message, p1, p2, amount, guildId, round + 1);

        }, 3000);
    }
}

async function restartGame(message, p1, p2, amount, guildId, round) {
    // Reset state and show inputs again
    const gameState = {
        p1: { id: p1.id, number: null, guess: null },
        p2: { id: p2.id, number: null, guess: null }
    };

    await message.edit({ content: `🎲 **TUR ${round} BAŞLIYOR!**\nSayılarınızı tekrar tutun...`, embeds: [], components: [createNumberInputRow()] });

    // Re-bind Input Collector logic...
    // Kod tekrarını önlemek için input collector logic'ini ayrıştırabilirdik ama 
    // şimdilik kopyalayalım veya startGameLoop'u modifiye edelim.
    // En iyisi startGameLoop'u parametre olarak 'message' alacak hale getirmek.

    // Basitlik adina: startGameLoop logic'ini buraya duplicate etmek yerine,
    // execute içindeki çağrıyı da buna yönlendirelim.
    // Ancak interaction vs message farkı var.

    // ÇÖZÜM: Input collectoru tekrar tanımlıyoruz (Hızlı çözüm)
    const inputCollector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

    inputCollector.on('collect', async btn => {
        if (btn.user.id !== p1.id && btn.user.id !== p2.id) return btn.reply({ content: 'Sen oyuncu değilsin.', flags: MessageFlags.Ephemeral });

        const playerState = btn.user.id === p1.id ? gameState.p1 : gameState.p2;
        if (playerState.number !== null) return btn.reply({ content: 'Zaten bir sayı tuttun!', flags: MessageFlags.Ephemeral });

        const modal = new ModalBuilder()
            .setCustomId(`mind_input_${btn.user.id}_r${round}`) // Unique ID per round
            .setTitle(`Tur ${round}: Sayı Tut (1-100)`);

        const input = new TextInputBuilder()
            .setCustomId('secret_num')
            .setLabel('Sayın kaç olsun?')
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(3);

        modal.addComponents(new ActionRowBuilder().addComponents(input));
        await btn.showModal(modal);

        try {
            const modalSubmit = await btn.awaitModalSubmit({ time: 30000, filter: m => m.customId === `mind_input_${btn.user.id}_r${round}` });
            const num = parseInt(modalSubmit.fields.getTextInputValue('secret_num'));

            if (isNaN(num) || num < 1 || num > 100) {
                await modalSubmit.reply({ content: 'Geçersiz sayı.', flags: MessageFlags.Ephemeral });
                return;
            }

            playerState.number = num;
            await modalSubmit.reply({ content: `🔒 Sayını **${num}** olarak tuttun.`, flags: MessageFlags.Ephemeral });

            if (gameState.p1.number !== null && gameState.p2.number !== null) {
                inputCollector.stop();
                startGuessPhase(message, gameState, p1, p2, amount, guildId, round);
            }
        } catch (e) { }
    });
}
