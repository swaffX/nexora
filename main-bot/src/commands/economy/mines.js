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
                .setDescription('Kaç adet bomba olsun? (1-15)')
                .setMinValue(1)
                .setMaxValue(15) // 20 kutuya indirdiğimiz için bombayı da azaltalım güvenli olsun
                .setRequired(true)),

    async execute(interaction) {
        const betInput = interaction.options.getString('bahis');
        let bombCount = interaction.options.getInteger('bombalar');
        const userId = interaction.user.id;
        const guildId = interaction.guild.id;

        // Validasyon: Bomba sayısı
        if (!bombCount || isNaN(bombCount) || bombCount < 1 || bombCount > 15) {
            return interaction.reply({ content: '❌ Bomba sayısı 1 ile 15 arasında olmalıdır.', flags: MessageFlags.Ephemeral });
        }

        // User Check
        let userCheck = await User.findOne({ odasi: userId, odaId: guildId });
        if (!userCheck) return interaction.reply({ content: '❌ Kaydınız yok.', flags: MessageFlags.Ephemeral });

        let amount = 0; // Check "all" logic
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
        // 5x5 = 25 Buton (Discord Max: 5 Row x 5 Components = 25)
        // ANCAK: Biz Cashout butonu da ekleyeceğiz. Bu yüzden 5. satırı feda etmeliyiz.
        // Yeni Grid: 5x4 = 20 Kutu. 1 Satır kontroller için.

        const gridSize = 20; // 5 columns x 4 rows
        const maxClicks = gridSize - bombCount;
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

        const calculateNextMultiplier = (step) => {
            // (Total - Bomb) / Total -> Kazanma şansı
            // Örn: 20 kutu, 5 bomba.
            // 1. adım: 15/20 şans.
            // Payout = 1 / Probability * 0.95 edge

            let probability = 1;
            // Kümülatif şans:
            // 1. elmas: (20-N)/20
            // 2. elmas: (19-N)/19 ...

            for (let i = 0; i <= step; i++) {
                probability *= (gridSize - bombCount - i) / (gridSize - i);
            }
            return (0.95 / probability);
        };

        // Butonları Oluştur
        const generateComponents = (revealMask = [], revealAll = false) => {
            const rows = [];
            // 4 Satır Kutu (0-19)
            for (let i = 0; i < 4; i++) {
                const row = new ActionRowBuilder();
                for (let j = 0; j < 5; j++) {
                    const index = i * 5 + j;
                    const btn = new ButtonBuilder().setCustomId(`mine_${index}`);

                    if (revealAll) {
                        btn.setDisabled(true);
                        if (grid[index] === 'bomb') {
                            btn.setStyle(ButtonStyle.Danger).setEmoji('💣');
                        } else if (revealMask.includes(index)) {
                            btn.setStyle(ButtonStyle.Success).setEmoji('💎');
                        } else {
                            btn.setStyle(ButtonStyle.Secondary).setEmoji('🟦');
                            btn.setDisabled(true);
                        }
                    } else if (revealMask.includes(index)) {
                        btn.setStyle(ButtonStyle.Success).setEmoji('💎').setDisabled(true);
                    } else {
                        btn.setStyle(ButtonStyle.Secondary).setEmoji('🟦');
                    }
                    row.addComponents(btn);
                }
                rows.push(row);
            }

            // 5. Satır: Kontrol (Cashout)
            const controlRow = new ActionRowBuilder();

            const nextMult = calculateNextMultiplier(revealedCount - 1);
            // revealedCount 0 iken cashout yok
            // revealedCount 1 iken step 0 çarpanını alırız

            const potentialWin = Math.floor(amount * nextMult);

            controlRow.addComponents(
                new ButtonBuilder()
                    .setCustomId('mines_cashout')
                    .setLabel(gameOver ? 'Oyun Bitti' : `Nakit Çek: ${potentialWin}`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('💰')
                    .setDisabled(revealedCount === 0 || gameOver || revealAll)
            );

            rows.push(controlRow);
            return rows;
        };

        let revealedIndices = [];

        const embed = new EmbedBuilder()
            .setColor('#2ecc71')
            .setTitle(`💣 MINES [${bombCount} Bomba]`)
            .setDescription(`**Bahis:** ${amount}\n**Çarpan:** 1.00x\n\nKutulara tıkla, elmasları bul!`)
            .setFooter({ text: 'House Edge: %5' });

        await interaction.reply({
            embeds: [embed],
            components: generateComponents(revealedIndices, false)
        });

        const msg = await interaction.fetchReply();

        const collector = msg.createMessageComponentCollector({
            filter: i => i.user.id === userId,
            time: 120000
        });

        collector.on('collect', async i => {
            if (i.customId === 'mines_cashout') {
                gameOver = true;
                const finalMult = calculateNextMultiplier(revealedCount - 1);
                const winAmt = Math.floor(amount * finalMult);

                await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmt } });

                embed.setTitle('💰 NAKİT ÇEKİLDİ!');
                embed.setDescription(`**Kazanılan:** ${winAmt} NexCoin\n**Çarpan:** ${finalMult.toFixed(2)}x`);
                embed.setColor('#f1c40f');

                await i.update({ embeds: [embed], components: generateComponents(revealedIndices, true) });
                collector.stop();
                return;
            }

            // Kutu Tıklama
            const index = parseInt(i.customId.split('_')[1]);

            if (grid[index] === 'bomb') {
                gameOver = true;
                embed.setTitle('💥 PATLADI!');
                embed.setDescription(`Malesef bombaya bastın ve **${amount}** NexCoin kaybettin.`);
                embed.setColor('#e74c3c');

                await i.update({ embeds: [embed], components: generateComponents(revealedIndices, true) });
                collector.stop();
            } else {
                revealedIndices.push(index);
                revealedCount++;

                // Calculate logic for display
                currentMultiplier = calculateNextMultiplier(revealedCount - 1);

                embed.setDescription(`**Bahis:** ${amount}\n**Çarpan:** ${currentMultiplier.toFixed(2)}x\n**Potansiyel:** ${Math.floor(amount * currentMultiplier)}`);

                // Auto Win if clear
                if (revealedCount === (gridSize - bombCount)) {
                    gameOver = true;
                    const winAmt = Math.floor(amount * currentMultiplier);
                    await User.findOneAndUpdate({ odasi: userId, odaId: guildId }, { $inc: { balance: winAmt } });

                    embed.setTitle('🏆 MÜKEMMEL!');
                    embed.setDescription(`Tüm elmasları buldun!\n**Kazanılan:** ${winAmt}`);
                    embed.setColor('#f1c40f');

                    await i.update({ embeds: [embed], components: generateComponents(revealedIndices, true) });
                    collector.stop();
                } else {
                    await i.update({ embeds: [embed], components: generateComponents(revealedIndices, false) });
                }
            }
        });
    }
};
