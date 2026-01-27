const { SlashCommandBuilder, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const path = require('path');
const { User } = require(path.join(__dirname, '..', '..', '..', '..', 'shared', 'models'));

module.exports = {
    data: new SlashCommandBuilder()
        .setName('mines')
        .setDescription('Mayın Tarlası: Elmasları bul, bombadan kaç!')
        .addStringOption(option =>
            option.setName('bahis')
                .setDescription('Bahis miktarı')
                .setRequired(true))
        .addIntegerOption(option =>
            option.setName('bombalar')
                .setDescription('Kaç adet bomba olsun? (1-24)')
                .setMinValue(1)
                .setMaxValue(24)
                .setRequired(true)),

    async execute(interaction) {
        const betInput = interaction.options.getString('bahis');
        const bombCount = interaction.options.getInteger('bombalar');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // User Check
        let userCheck = await User.findOne({ odasi: userId, odaId: guildId });
        if (!userCheck) return interaction.reply({ content: '❌ Kaydınız yok.', flags: MessageFlags.Ephemeral });

        let amount = 0;
        if (['all', 'hepsi', 'tümü'].includes(betInput.toLowerCase())) {
            amount = userCheck.balance;
        } else {
            amount = parseInt(betInput);
            if (isNaN(amount) || amount < 50) return interaction.reply({ content: '❌ Min 50 NexCoin.', flags: MessageFlags.Ephemeral });
        }

        // Bakiye Düş
        const user = await User.findOneAndUpdate(
            { odasi: userId, odaId: guildId, balance: { $gte: amount } },
            { $inc: { balance: -amount } },
            { new: true }
        );

        if (!user) return interaction.reply({ content: '❌ Yetersiz bakiye!', flags: MessageFlags.Ephemeral });

        // OYUN MANTIĞI START
        const gridSize = 25; // 5x5
        let grid = Array(gridSize).fill('safe');

        // Bombaları yerleştir
        let placedBombs = 0;
        while (placedBombs < bombCount) {
            const r = Math.floor(Math.random() * gridSize);
            if (grid[r] === 'safe') {
                grid[r] = 'bomb';
                placedBombs++;
            }
        }

        let revealedCount = 0;
        let gameOver = false;
        let currentMultiplier = 1.0;

        // Çarpan Hesaplama Fonksiyonu
        // Formül: Multiplier = Multiplier * (TotalRemaining / SafeRemaining)
        // Basitleştirilmiş versiyon: Her adımda sabit veya artan oran
        // Daha güvenli: House Edge (%1) ile hesapla

        const calculateNextMultiplier = (step) => {
            // Basit Kümulatif Olasılık
            // (25 - bomb) / 25 -> şans
            // Adım başı risk artar
            // Şimdilik basit bir artış kullanalım:
            // 1 bomba için her adım x1.03, 10 bomba için x1.3 gibi.

            // Gerçekçi olması için:
            // 25 kutu, N bomba.
            // 1. adım şansı: (25-N)/25. Fair Payout: 1 / Şans
            // x0.95 House Edge

            let probability = 1;
            for (let i = 0; i <= step; i++) {
                probability *= (25 - bombCount - i) / (25 - i);
            }
            return (0.95 / probability);
        };

        // Butonları Oluştur
        const generateRows = (revealMask = [], revealAll = false) => {
            const rows = [];
            for (let i = 0; i < 5; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    const index = i * 5 + j;
                    const btn = new ButtonBuilder().setCustomId(`mine_${index}`);

                    if (revealAll) {
                        // Oyun bitti, hepsini göster
                        btn.setDisabled(true);
                        if (grid[index] === 'bomb') {
                            btn.setStyle(ButtonStyle.Danger).setEmoji('💣');
                        } else if (revealMask.includes(index)) {
                            btn.setStyle(ButtonStyle.Success).setEmoji('💎');
                        } else {
                            btn.setStyle(ButtonStyle.Secondary).setEmoji('🟦'); // Açılmamış safe
                            btn.setDisabled(true); // Disable
                        }
                    } else if (revealMask.includes(index)) {
                        // Açılmış kutu
                        btn.setStyle(ButtonStyle.Success).setEmoji('💎').setDisabled(true);
                    } else {
                        // Kapalı kutu
                        btn.setStyle(ButtonStyle.Secondary).setEmoji('🟦');
                    }
                    row.addComponents(btn);
                }
                rows.push(row);
            }

            // Cashout Butonu (Extra Row)
            if (!revealAll) {
                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('mines_cashout')
                        .setLabel(`Nakit Çek (${(amount * calculateNextMultiplier(revealedCount - 1)).toFixed(0)})`) // Prediction calculation fix needed in display
                        .setStyle(ButtonStyle.Primary)
                        .setDisabled(revealedCount === 0) // Hiç açmadan çekemezsin
                );
                return [...rows, actionRow];
            }
            return rows;
        };

        let revealedIndices = [];

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`💣 MINES [${bombCount} Bomba]`)
            .setDescription(`Bahis: **${amount}** | Çarpan: **1.00x**\nKutulara tıkla, elmasları bul!`)
            .setFooter({ text: 'Dilediğin zaman çekilebilirsin.' });

        const msg = await interaction.reply({
            embeds: [embed],
            components: generateRows(revealedIndices, false),
            fetchReply: true
        });

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 120000
        });

        collector.on('collect', async i => {
            if (i.customId === 'mines_cashout') {
                gameOver = true;
                const winAmt = Math.floor(amount * currentMultiplier);

                await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmt } });

                embed.setTitle('💰 KAZANDIN!');
                embed.setDescription(`Tebrikler! **${winAmt}** NexCoin hesabına eklendi.\nÇarpan: **${currentMultiplier.toFixed(2)}x**`);
                embed.setColor('#f1c40f');

                await i.update({ embeds: [embed], components: generateRows(revealedIndices, true) });
                collector.stop();
                return;
            }

            // Kutu Tıklama
            const index = parseInt(i.customId.split('_')[1]);

            if (grid[index] === 'bomb') {
                // BOM!
                gameOver = true;
                embed.setTitle('💥 BOOOOM!');
                embed.setDescription(`Bombaya bastın! **${amount}** NexCoin kül oldu...`);
                embed.setColor('#e74c3c');

                await i.update({ embeds: [embed], components: generateRows(revealedIndices, true) }); // Reveal all
                collector.stop();
            } else {
                // ELMAS
                revealedIndices.push(index);
                revealedCount++;

                // Yeni çarpan hesapla
                // index count starts 0 in math logic above, but revealedCount is 1 now.
                // call with revealedCount-1 to match 0-based step if needed, or just adjust formula.
                // Basit mantık: Her güvenli adımda çarpanı güncelle
                currentMultiplier = calculateNextMultiplier(revealedCount - 1);

                embed.setDescription(`Bahis: **${amount}** | Çarpan: **${currentMultiplier.toFixed(2)}x**\nKazanç: **${Math.floor(amount * currentMultiplier)}**`);

                // Eğer tüm elmaslar bulunduysa auto-win
                if (revealedCount === (25 - bombCount)) {
                    gameOver = true;
                    // Auto Cashout
                    const winAmt = Math.floor(amount * currentMultiplier);
                    await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmt } });

                    embed.setTitle('🏆 TÜMÜNÜ BULDUN!');
                    embed.setColor('#f1c40f');

                    await i.update({ embeds: [embed], components: generateRows(revealedIndices, true) });
                    collector.stop();
                } else {
                    // Devam
                    await i.update({ embeds: [embed], components: generateRows(revealedIndices, false) });
                }
            }
        });
    }
};
